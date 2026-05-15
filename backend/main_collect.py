"""
일일 수집 진입점 (GitHub Actions: collect.yml)
- active/collecting 상태인 모든 게임의 리뷰 + 뉴스 수집
- RAW 시트 생성은 GAS 웹앱에 위임 (서비스 계정 Drive 할당량 0 문제 우회)
- collecting 완료 시 active로 상태 전환
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from sheets.master_sheet import get_spreadsheet, get_all_games, update_game, ensure_games_headers
from sheets.raw_reviews import get_or_create_raw_spreadsheet, open_raw_spreadsheet, append_reviews, get_all_existing_ids
from collectors.steam_reviews import collect_reviews_batch, get_total_review_count
from collectors.steam_news import fetch_news, fetch_store_events, classify_news, parse_news_item, parse_store_event
from collectors.steam_meta import fetch_app_details, parse_game_meta, fetch_steam_positive_rate
from collectors.steam_ccu import fetch_peak_ccu
from datetime import datetime, timezone
from config import MASTER_SPREADSHEET_ID

GDRIVE_FOLDER_ID = os.environ.get("GDRIVE_FOLDER_ID", "")
MAX_PAGES_PER_RUN = 3000  # 약 240,000건 / 6시간 GitHub Actions 제한 이내 (약 25분 소요)

# ── 실행 모드 제어 (GitHub Actions client_payload 또는 직접 환경변수로 주입) ──
# TARGET_APPID: 설정 시 해당 게임만 처리 (미설정 = 전체)
# NEWS_ONLY:    "true" 설정 시 리뷰 수집을 건너뛰고 뉴스·패치 수집만 실행
TARGET_APPID = os.environ.get("TARGET_APPID", "").strip()
NEWS_ONLY    = os.environ.get("NEWS_ONLY",    "").strip().lower() in ("1", "true", "yes")




def run():
    ss = get_spreadsheet()
    # 누락 컬럼 자동 마이그레이션 — SKIP_SCHEMA_CHECK=true 시 생략 (일일 운영 중 불필요)
    if not os.environ.get("SKIP_SCHEMA_CHECK", "").strip().lower() in ("1", "true", "yes"):
        ensure_games_headers(ss)
    games = get_all_games(ss)
    newly_activated = []

    if TARGET_APPID:
        print(f"[TARGET] 게임 필터: {TARGET_APPID}")
    if NEWS_ONLY:
        print("[MODE] NEWS_ONLY — 리뷰 수집 건너뜀, 뉴스·패치 수집만 실행")

    for game in games:
        status = game.get("status", "")
        appid = str(game.get("appid", ""))
        if status not in ("active", "collecting"):
            continue
        if TARGET_APPID and appid != TARGET_APPID:
            continue
        print(f"\n{'='*50}")
        print(f"처리 중: {game.get('name')} (AppID: {appid}, status: {status})")
        try:
            activated = _process_game(ss, game, appid, status)
            if activated:
                newly_activated.append(appid)
        except Exception as e:
            import traceback
            print(f"[ERROR] {game.get('name')} ({appid}) 처리 중 예외 발생 — 다음 게임으로 계속")
            print(traceback.format_exc())
            continue

    print("\n전체 수집 완료")

    if newly_activated:
        print(f"\n[INFO] 신규 활성화 게임 {len(newly_activated)}개 — 관리자 승인 후 AI 분석 가능: {newly_activated}")


def _process_game(ss, game: dict, appid: str, status: str) -> bool:
    newly_activated = False
    final_status = status

    # 1. 메타데이터 갱신
    # 주간(월요일) 또는 필수 필드 누락 시 → 전체 갱신 (appdetails + 스크래핑 + positive_rate + peak_ccu)
    # 평일(화~일)                         → 긍정률만 갱신 (HTTP 1회)
    today_utc = datetime.now(tz=timezone.utc)
    is_full_meta_day = today_utc.weekday() == 0 or not str(game.get("genres", "")).strip()

    name = game.get("name", appid)
    positive_rate = None

    if is_full_meta_day:
        app_data = fetch_app_details(appid)
        if app_data:
            meta = parse_game_meta(appid, app_data)
            name = meta["name"]
            peak_ccu = fetch_peak_ccu(appid)
            raw_rate = meta.get("steam_positive_rate", "")
            positive_rate = float(raw_rate) if raw_rate not in ("", None) else None
            update_game(ss, appid, {
                "name":                meta["name"],
                "is_free":             meta["is_free"],
                "is_early_access":     meta["is_early_access"],
                "metacritic_score":    meta["metacritic_score"],
                "release_date":        meta["release_date"],
                "genres":              meta["genres"],
                "developer":           meta["developer"],
                "publisher":           meta["publisher"],
                "price":               meta["price"],
                "peak_ccu":            peak_ccu,
                "steam_positive_rate": meta["steam_positive_rate"],
            })
            print("메타데이터 전체 갱신 완료 (주간)")
    else:
        # 평일: 긍정률만 갱신 (HTTP 1회, 스크래핑 생략)
        positive_rate = fetch_steam_positive_rate(appid)
        if positive_rate is not None:
            update_game(ss, appid, {"steam_positive_rate": positive_rate})
        print(f"긍정률 갱신 완료: {positive_rate}%")

    # 2. 리뷰 수집 (NEWS_ONLY 모드 시 건너뜀)
    game_sheet_id = game.get("game_sheet_id", "")

    if NEWS_ONLY:
        print("리뷰 수집 건너뜀 (NEWS_ONLY 모드)")
    else:
        # cursor 일관성 검사:
        # game_sheet_id가 없는데 cursor가 *이 아니면 이전 실패로 인한 불일치 → 초기화
        last_cursor = game.get("last_cursor", "") or "*"
        if not game_sheet_id and last_cursor != "*":
            print(f"[WARN] game_sheet_id 없는데 cursor={last_cursor} → * 로 초기화")
            last_cursor = "*"
            update_game(ss, appid, {"last_cursor": "*", "collected_reviews_count": 0})

        total_count = int(game.get("total_reviews_count", 0) or 0)
        if total_count == 0:
            total_count = get_total_review_count(appid)
            update_game(ss, appid, {"total_reviews_count": total_count})

        # active 게임은 매 실행마다 cursor=""에서 재시작하므로
        # 기존 저장된 리뷰 ID를 미리 로드하여 per-page 조기 종료에 활용
        raw_ss = None
        known_ids = None
        if status == "active" and game_sheet_id:
            try:
                raw_ss = open_raw_spreadsheet(game_sheet_id)
                known_ids = get_all_existing_ids(raw_ss)
                print(f"[reviews] 기존 리뷰 ID {len(known_ids)}건 로드 (조기 종료 판단용)")
            except Exception as e:
                print(f"[WARN] 기존 리뷰 ID 로드 실패 ({e}) — 조기 종료 없이 전체 수집 진행")
                raw_ss = None
                known_ids = None

        reviews, next_cursor, _ = collect_reviews_batch(
            appid, last_cursor, max_pages=MAX_PAGES_PER_RUN, known_ids=known_ids
        )

        if reviews:
            # RAW 시트 가져오기:
            # - active 게임: pre-open된 raw_ss 재사용 (API 호출 절감)
            # - collecting 게임 또는 pre-open 실패: GAS 웹앱으로 생성/재사용
            if raw_ss is None:
                try:
                    raw_ss = get_or_create_raw_spreadsheet(
                        GDRIVE_FOLDER_ID, appid, game.get("name", appid)
                    )
                except RuntimeError as e:
                    print(f"[ERROR] RAW 시트 준비 실패: {e}")
                    print("[ERROR] GAS_WEBAPP_URL이 올바르게 설정되었는지 확인하세요.")
                    return newly_activated  # 이 게임은 건너뜀

            # 개별 게임 시트 ID를 master sheet에 저장 (아직 없을 때만)
            if not game_sheet_id:
                update_game(ss, appid, {"game_sheet_id": raw_ss.id})
                game_sheet_id = raw_ss.id

            # RAW 시트에 실제로 저장된 리뷰 수 확인
            actual_collected = int(game.get("collected_reviews_count", 0) or 0)

            added = append_reviews(raw_ss, reviews)
            print(f"리뷰 {added}건 신규 추가")

            collected = actual_collected + added
            updates = {
                "last_cursor": next_cursor,
                "collected_reviews_count": collected,
            }

            # 수집 완료 판정
            # 조건 1: 커서 동일(자연 고갈) 또는 초기 커서("*") 반환
            #   collect_reviews_batch는 자연 고갈 시 입력 cursor 그대로 반환하므로 항상 True
            # 조건 2: 누적 수집 건수 ≥ 전체 리뷰 수
            # 조건 3: Steam이 리뷰를 반환했으나 모두 이미 적재된 중복 (added=0, 루프 방지)
            cursor_done = next_cursor == last_cursor or next_cursor == "*"
            count_done  = total_count > 0 and collected >= total_count
            dupe_done   = added == 0 and len(reviews) > 0  # 반환 리뷰가 전부 중복 → 더 가져올 것 없음
            if cursor_done or count_done or dupe_done:
                updates["status"] = "active"
                updates["last_cursor"] = ""
                reason = (
                    "커서 일치" if cursor_done
                    else f"수집 완료({collected}/{total_count}건)" if count_done
                    else f"중복만 반환됨({len(reviews)}건) — Steam 카운트 불일치 처리"
                )
                print(f"수집 완료({reason}) → active 전환")
                if status == "collecting":
                    newly_activated = True
                    final_status = "active"

            update_game(ss, appid, updates)

        else:
            # 리뷰 없음 = 이미 최신
            if status == "collecting":
                # 리뷰가 없어도 game_sheet_id가 없으면 게임 시트를 먼저 생성한다.
                # (뉴스/CCU 수집에 game_sheet_id 필수 — 없으면 이후 모든 수집이 영구 스킵됨)
                if not game_sheet_id:
                    try:
                        raw_ss = get_or_create_raw_spreadsheet(
                            GDRIVE_FOLDER_ID, appid, game.get("name", appid)
                        )
                        game_sheet_id = raw_ss.id
                        update_game(ss, appid, {"game_sheet_id": game_sheet_id})
                        print(f"[INFO] 게임 시트 생성 완료 (리뷰 없음): {game_sheet_id}")
                    except Exception as e:
                        print(f"[WARN] 게임 시트 생성 실패 — 뉴스 수집 건너뜀: {e}")
                update_game(ss, appid, {"status": "active", "last_cursor": ""})
                print("수집 완료 (신규 없음) → active 전환")
                newly_activated = True
                final_status = "active"

    # 3. 뉴스/패치노트 수집 (active 상태에서만, game_sheet_id 보장 후)
    if final_status == "active":
        _collect_news(ss, appid, name, game_sheet_id, positive_rate=positive_rate)

    return newly_activated


def _steam_gid(url: str) -> str | None:
    """Steam 뉴스 URL에서 GID 추출: .../view/{gid} → gid 문자열, 없으면 None"""
    import re as _re
    if not url:
        return None
    m = _re.search(r"/view/(\d+)", url)
    return m.group(1) if m else None


def _collect_news(ss, appid: str, game_name: str, game_sheet_id: str, positive_rate=None):
    from sheets.game_sheet import (
        open_game_sheet, get_timeline as gs_get_timeline,
        append_timeline_row as gs_append, update_timeline_row as gs_update,
        append_rate_history,
    )

    if not game_sheet_id:
        print(f"[WARN] game_sheet_id 없음 ({appid}), 뉴스 수집 건너뜀")
        return

    game_ss = open_game_sheet(game_sheet_id)

    # 당일 공식 긍정율 rate_history에 기록
    if positive_rate is not None:
        today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
        try:
            append_rate_history(game_ss, today, positive_rate)
        except Exception as e:
            print(f"[WARN] rate_history 기록 실패: {e}")
    existing = gs_get_timeline(game_ss)

    # 기존 시트 인덱스: GID / URL / 제목 세 가지 키로 O(1) 중복 확인
    existing_gids:   set[str] = {gid for r in existing if (gid := _steam_gid(r.get("url", "")))}
    existing_urls:   set[str] = {r.get("url")   for r in existing if r.get("url")}
    existing_titles: set[str] = {r.get("title") for r in existing if r.get("title")}

    # content 백필 대상: URL이 있고 content가 비어있는 기존 행
    # (이전 수집 시 content 컬럼이 없었던 경우)
    url_to_existing_row = {
        r.get("url"): r for r in existing
        if r.get("url") and not str(r.get("content", "")).strip()
        and r.get("language_scope") == "all"
    }

    # ── 1. GetNewsForApp (enddate 페이지네이션, 최대 10,000건) ──────────────
    # existing_gids를 전달해 이미 저장된 GID 도달 시 조기 종료
    news_items = fetch_news(appid, known_gids=existing_gids)
    official, external = classify_news(news_items, app_author=game_name)

    # GetNewsForApp 결과 파싱 — GID/URL/제목 집합으로 인덱싱 (O(1) 교차 중복 체크용)
    candidate_rows:   list[dict] = []
    candidate_gids:   set[str]   = set()
    candidate_urls:   set[str]   = set()
    candidate_titles: set[str]   = set()

    def _add_candidate(parsed: dict) -> None:
        url   = parsed.get("url", "")
        title = parsed.get("title", "")
        gid   = _steam_gid(url)
        candidate_rows.append(parsed)
        if gid:   candidate_gids.add(gid)
        if url:   candidate_urls.add(url)
        if title: candidate_titles.add(title)

    for item in official:
        _add_candidate(parse_news_item(item, "official"))
    for item in external:
        _add_candidate(parse_news_item(item, "news"))

    # ── 2. Steam Store Events API (cursor 페이지네이션) ────────────────────
    # GetNewsForApp이 누락하는 오래된 이벤트를 보완
    # GID / URL / 제목 기준으로 O(1) 교차 중복 체크
    store_events = fetch_store_events(appid, known_gids=existing_gids)
    for ev in store_events:
        parsed = parse_store_event(ev, appid)
        if parsed is None:
            continue
        url   = parsed.get("url", "")
        title = parsed.get("title", "")
        gid   = _steam_gid(url)
        if (
            (gid   and gid   in candidate_gids)   or
            (url   and url   in candidate_urls)   or
            (title and title in candidate_titles)
        ):
            continue
        _add_candidate(parsed)

    # ── 3. 시트에 저장 (GID/URL/제목 중복 제거) + content 백필 ─────────────
    added = 0
    backfilled = 0
    added_rows: list[dict] = []
    for parsed in candidate_rows:
        url     = parsed.get("url", "")
        title   = parsed.get("title", "")
        content = parsed.get("content", "")
        gid     = _steam_gid(url)

        # content 백필: 이미 시트에 있지만 content가 비어있는 행 → content만 업데이트
        if url and url in url_to_existing_row and content:
            existing_row = url_to_existing_row[url]
            gs_update(game_ss, existing_row["event_id"], "all", {"content": content})
            del url_to_existing_row[url]  # 중복 처리 방지
            backfilled += 1
            continue

        # 신규 이벤트: GID → URL → 제목 순으로 중복 확인 (GID가 가장 신뢰도 높음)
        if gid and gid in existing_gids:
            continue
        if url and url in existing_urls:
            continue
        if title and title in existing_titles:
            continue

        gs_append(game_ss, {**parsed, "language_scope": "all"})
        added_rows.append(parsed)
        if gid:   existing_gids.add(gid)
        if url:   existing_urls.add(url)
        if title: existing_titles.add(title)
        added += 1

    if backfilled:
        print(f"뉴스/패치 {backfilled}건 content 백필 완료")

    # 기존 + 신규 전체에서 최신 공식 이벤트를 master sheet에 요약 저장
    all_official = [
        r for r in (list(existing) + added_rows)
        if r.get("event_type") == "official" and r.get("date")
    ]
    if all_official:
        latest_ev = max(all_official, key=lambda r: r.get("date", ""))
        try:
            update_game(ss, appid, {
                "latest_official_event_date":  str(latest_ev.get("date", "")),
                "latest_official_event_title": str(latest_ev.get("title_kr") or latest_ev.get("title", "")),
                "latest_official_event_url":   str(latest_ev.get("url", "")),
            })
        except Exception as e:
            print(f"[WARN] latest_official_event 업데이트 실패: {e}")

    if added:
        print(f"뉴스/패치 {added}건 추가 (GetNewsForApp + StoreEvents 합산)")
        # 두 번째 gs_get_timeline 호출 없이 기존 + 신규 행으로 last_event_date 계산
        new_official_dates = [
            r["date"] for r in added_rows
            if r.get("event_type") in ("official", "manual") and r.get("date")
        ]
        old_official_dates = [
            r["date"] for r in existing
            if r.get("event_type") in ("official", "manual") and r.get("date")
        ]
        all_dates = new_official_dates + old_official_dates
        if all_dates:
            update_game(ss, appid, {"last_event_date": max(all_dates)})


if __name__ == "__main__":
    run()
