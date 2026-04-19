"""
일일 수집 진입점 (GitHub Actions: collect.yml)
- active/collecting 상태인 모든 게임의 리뷰 + 뉴스 수집
- RAW 시트 생성은 GAS 웹앱에 위임 (서비스 계정 Drive 할당량 0 문제 우회)
- collecting 완료 시 active로 상태 전환
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from sheets.master_sheet import get_spreadsheet, get_all_games, update_game, ensure_games_headers
from sheets.raw_reviews import get_or_create_raw_spreadsheet, append_reviews
from collectors.steam_reviews import collect_reviews_batch, get_total_review_count
from collectors.steam_news import fetch_news, fetch_store_events, classify_news, parse_news_item, parse_store_event
from collectors.steam_meta import fetch_app_details, parse_game_meta
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


def _dispatch_analyze():
    """
    collect 완료 후 analyze.yml을 자동 트리거합니다.
    repository_dispatch(analyze-game) 방식 사용 — register-game과 동일한 API 경로.
    workflow_dispatch는 Actions 권한 범위가 달라 실패할 수 있어 사용하지 않음.
    """
    import requests as _req
    token = os.environ.get("GH_PAT", "")
    repo  = os.environ.get("GITHUB_REPO", "Kimmugil/Steam-Pickaxe")
    if not token:
        print("[WARN] GH_PAT 미설정 — analyze.yml 자동 트리거 생략")
        return
    r = _req.post(
        f"https://api.github.com/repos/{repo}/dispatches",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
        json={"event_type": "analyze-game"},
        timeout=15,
    )
    if r.status_code in (204, 200):
        print("[AUTO] analyze-game 디스패치 완료 → analyze.yml 트리거")
    else:
        print(f"[WARN] analyze-game 디스패치 실패: {r.status_code} {r.text[:100]}")


def run():
    ss = get_spreadsheet()
    # 누락 컬럼 자동 마이그레이션 (genres/developer/publisher/price 등)
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

    # 신규 활성화 게임이 있으면 AI 분석 자동 트리거
    if newly_activated:
        print(f"\n[AUTO] 신규 활성화 게임 {len(newly_activated)}개 — analyze.yml 트리거")
        _dispatch_analyze()


def _process_game(ss, game: dict, appid: str, status: str) -> bool:
    newly_activated = False
    final_status = status

    # 1. 메타데이터 갱신
    app_data = fetch_app_details(appid)
    name = game.get("name", appid)
    if app_data:
        meta = parse_game_meta(appid, app_data)
        name = meta["name"]
        peak_ccu = fetch_peak_ccu(appid)
        update_game(ss, appid, {
            "name":           meta["name"],
            "is_free":        meta["is_free"],
            "is_early_access": meta["is_early_access"],
            "metacritic_score": meta["metacritic_score"],
            "release_date":   meta["release_date"],
            "genres":         meta["genres"],
            "developer":      meta["developer"],
            "publisher":      meta["publisher"],
            "price":          meta["price"],
            "peak_ccu":       peak_ccu,
        })
        print("메타데이터 갱신 완료")

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

        reviews, next_cursor, _ = collect_reviews_batch(
            appid, last_cursor, max_pages=MAX_PAGES_PER_RUN
        )

        if reviews:
            # RAW 시트 가져오기 (없으면 GAS 웹앱으로 자동 생성)
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
                update_game(ss, appid, {"status": "active", "last_cursor": ""})
                print("수집 완료 (신규 없음) → active 전환")
                newly_activated = True
                final_status = "active"

    # 3. 뉴스/패치노트 수집 (active 상태에서만, game_sheet_id 보장 후)
    if final_status == "active":
        _collect_news(ss, appid, name, game_sheet_id)

    return newly_activated


def _steam_gid(url: str) -> str | None:
    """Steam 뉴스 URL에서 GID 추출: .../view/{gid} → gid 문자열, 없으면 None"""
    import re as _re
    if not url:
        return None
    m = _re.search(r"/view/(\d+)", url)
    return m.group(1) if m else None


def _collect_news(ss, appid: str, game_name: str, game_sheet_id: str):
    from sheets.game_sheet import (
        open_game_sheet, get_timeline as gs_get_timeline,
        append_timeline_row as gs_append, update_timeline_row as gs_update,
    )

    if not game_sheet_id:
        print(f"[WARN] game_sheet_id 없음 ({appid}), 뉴스 수집 건너뜀")
        return

    game_ss = open_game_sheet(game_sheet_id)
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
    news_items = fetch_news(appid)
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
    store_events = fetch_store_events(appid)
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
        if gid:   existing_gids.add(gid)
        if url:   existing_urls.add(url)
        if title: existing_titles.add(title)
        added += 1

    if backfilled:
        print(f"뉴스/패치 {backfilled}건 content 백필 완료")

    if added:
        print(f"뉴스/패치 {added}건 추가 (GetNewsForApp + StoreEvents 합산)")
        all_official = [
            r for r in gs_get_timeline(game_ss)
            if r.get("event_type") in ("official", "manual") and r.get("date")
        ]
        if all_official:
            last_date = max(r["date"] for r in all_official)
            update_game(ss, appid, {"last_event_date": last_date})


if __name__ == "__main__":
    run()
