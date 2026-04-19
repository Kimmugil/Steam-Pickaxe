"""
AI 분석 진입점 (GitHub Actions: analyze.yml — 일 단위)
- 미분석 구간의 AI 분석 실행
- 전체 AI 브리핑 갱신
- 챗봇 카운터 초기화
"""
import sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))

from sheets.master_sheet import (
    get_spreadsheet, get_all_games, update_game,
)
from sheets.game_sheet import (
    open_game_sheet, get_timeline as gs_get_timeline,
    append_timeline_row as gs_append_timeline,
    update_timeline_row as gs_update_timeline,
    update_timeline_event_field as gs_update_event_field,
    cleanup_stale_launch_buckets,
    get_ccu_data,
)
from sheets.raw_reviews import open_raw_spreadsheet, get_reviews_in_range, get_language_counts
from analyzers.bucketer import build_buckets, filter_reviews_for_bucket, sample_reviews
from analyzers.gemini_analyzer import (
    analyze_bucket, analyze_patch_summary, generate_event_title_kr,
    generate_ai_briefing, generate_sentiment_trend_comment,
    generate_ccu_peaktime_comment, generate_language_cross_analysis, LANGUAGE_NAMES
)
from datetime import datetime, timezone

GDRIVE_FOLDER_ID = os.environ.get("GDRIVE_FOLDER_ID", "")
TOP_LANGUAGES_COUNT = 3


def run():
    ss = get_spreadsheet()
    today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")

    games = get_all_games(ss)
    for game in games:
        if game.get("status") != "active":
            continue

        appid = str(game.get("appid", ""))
        name = game.get("name", appid)
        game_sheet_id = game.get("game_sheet_id", "")

        if not game_sheet_id:
            print(f"[SKIP] game_sheet_id 없음: {name} ({appid})")
            continue

        print(f"\n{'='*50}\n분석 시작: {name} ({appid})")

        # ── top_languages 재계산 (language_distribution 기반) ──────────────
        # 초기 분석 이후 리뷰 분포가 바뀌어도 top_languages가 stale해지는 문제 방지
        lang_dist_raw = game.get("language_distribution", "")
        if lang_dist_raw:
            try:
                lang_dist = json.loads(lang_dist_raw)
                new_top = [
                    l for l, _ in sorted(lang_dist.items(), key=lambda x: x[1], reverse=True)
                    [:TOP_LANGUAGES_COUNT]
                ]
                stored_top = [l.strip() for l in game.get("top_languages", "").split(",") if l.strip()]
                if new_top and new_top != stored_top:
                    update_game(ss, appid, {"top_languages": ",".join(new_top)})
                    game = dict(game)
                    game["top_languages"] = ",".join(new_top)
                    print(f"  [top_languages] 재계산 갱신: {new_top}")
            except Exception as _e:
                print(f"  [top_languages] 재계산 실패: {_e}")

        game_ss = open_game_sheet(game_sheet_id)
        timeline_rows = gs_get_timeline(game_ss)
        buckets = build_buckets(timeline_rows)

        # 공식 이벤트가 존재하면 구형 랜덤 UUID 런칭 버킷 잔여 행 정리
        has_officials = any(
            r.get("event_type") in ("official", "manual")
            for r in timeline_rows
        )
        if has_officials:
            cleanup_stale_launch_buckets(game_ss)
            # 정리 후 재조회
            timeline_rows = gs_get_timeline(game_ss)

        # 미분석 구간 식별 (language_scope=all, sentiment_rate가 없는 행)
        # 예외: sparse인데 공식 이벤트이고 ai_patch_summary가 없으면 재처리 (패치 요약 생성)
        analyzed_ids = {
            r["event_id"]
            for r in timeline_rows
            if r.get("language_scope") == "all" and r.get("sentiment_rate") != ""
            and not (
                str(r.get("sentiment_rate")) == "sparse"
                and r.get("event_type") == "official"
                and not r.get("ai_patch_summary", "").strip()
            )
        }

        # ── 직전 이벤트 재분석 조건 ─────────────────────────────
        # 마지막 버킷이 미분석(새 이벤트 추가)이거나,
        # 마지막 버킷의 수집 리뷰가 0건인 경우
        # → 바로 앞 버킷을 재분석 대상에 포함
        # (직전 이벤트의 end_ts가 새 이벤트 날짜로 잘려 리뷰 수가 달라지기 때문)
        if len(buckets) >= 2:
            last_id = buckets[-1]["event_id"]
            last_is_new = last_id not in analyzed_ids

            # 마지막 버킷 리뷰 수 확인 (0건이면 재분석 필요)
            last_review_count = next(
                (int(r.get("review_count", 0) or 0)
                 for r in timeline_rows
                 if r.get("event_id") == last_id and r.get("language_scope") == "all"),
                -1,  # 행 자체가 없으면 -1 (미분석)
            )
            last_has_no_reviews = last_review_count == 0

            if last_is_new or last_has_no_reviews:
                preceding_id = buckets[-2]["event_id"]
                if preceding_id in analyzed_ids:
                    analyzed_ids.discard(preceding_id)
                    print(f"  [재분석 예약] 직전 이벤트: {buckets[-2]['title']}")

        # ── title_kr 백필 ────────────────────────────────────────────
        # 이미 분석 완료된 이벤트 중 title_kr이 비어 있는 것만 경량 호출로 채움.
        # analyze_bucket 재실행 없이 generate_event_title_kr 1회 호출만 사용.
        # (기존 ai_patch_summary를 컨텍스트로 활용하므로 품질도 충분히 보장)
        rows_needing_title_kr = [
            r for r in timeline_rows
            if r.get("language_scope") == "all"
            and r.get("sentiment_rate") not in ("", None)
            and not r.get("title_kr", "").strip()
        ]
        if rows_needing_title_kr:
            print(f"  [title_kr 백필] {len(rows_needing_title_kr)}건 시작")
            for r in rows_needing_title_kr:
                try:
                    tkr = generate_event_title_kr(
                        name,
                        r.get("title", ""),
                        r.get("event_type", ""),
                        r.get("ai_patch_summary", ""),
                    )
                    # 동일 event_id의 모든 스코프 행(all/koreana/english)에 한꺼번에 반영
                    gs_update_event_field(game_ss, r["event_id"], "title_kr", tkr)
                    print(f"    [{r.get('date')}] {r.get('title')} → {tkr}")
                    time.sleep(1)  # Sheets API 레이트 리밋 방지
                except Exception as e:
                    print(f"    [title_kr 백필 오류] {r.get('title')}: {e}")
            print(f"  [title_kr 백필] 완료")
            # 시트 상태 반영을 위해 재조회
            timeline_rows = gs_get_timeline(game_ss)

        # game_sheet_id IS the raw spreadsheet — open directly, no GAS needed
        raw_ss = open_raw_spreadsheet(game_sheet_id)
        top_languages = _get_top_languages(game, timeline_rows, raw_ss)

        # 언어 분포 저장 (전체 RAW 리뷰 기반 — 프론트엔드 파이 차트용)
        try:
            raw_counts = get_language_counts(raw_ss)
            if raw_counts:
                lang_dist_str = json.dumps(
                    {l: c for l, c in sorted(raw_counts.items(), key=lambda x: x[1], reverse=True)},
                    ensure_ascii=False,
                )
                update_game(ss, appid, {"language_distribution": lang_dist_str})
                print(f"  [lang_dist] 저장 완료 ({len(raw_counts)}개 언어)")
        except Exception as e:
            print(f"  [lang_dist] 저장 실패: {e}")

        # 스파스 버킷(리뷰 ≤5건)의 리뷰를 다음 버킷으로 이월
        carry_over_reviews: list = []

        for bucket in buckets:
            event_id = bucket["event_id"]
            if event_id in analyzed_ids:
                # 이미 분석 완료된 버킷이면 carry-over 초기화 (데이터 일관성)
                carry_over_reviews = []
                continue

            print(f"  구간 분석: {bucket['title']} ({bucket['date']})")

            # RAW 리뷰 필터링
            from datetime import datetime as dt
            years = list(range(
                dt.utcfromtimestamp(max(bucket["start_ts"], 1)).year,
                dt.utcnow().year + 1
            ))
            own_reviews = get_reviews_in_range(raw_ss, bucket["start_ts"], bucket["end_ts"], years)
            combined_reviews = carry_over_reviews + own_reviews

            # 기존 시트에서 이 버킷의 기존 title_kr 확인 (사용자가 직접 수정했을 수도 있음)
            existing_title_kr = next(
                (r.get("title_kr", "") for r in timeline_rows
                 if r.get("event_id") == event_id and r.get("language_scope") == "all"),
                ""
            )

            # ── 스파스 버킷 처리 (리뷰 5건 이하) ─────────────────────
            SPARSE_THRESHOLD = 5
            if len(combined_reviews) <= SPARSE_THRESHOLD:
                carry_over_reviews = combined_reviews  # 다음 버킷에 이월
                print(f"    → 리뷰 {len(combined_reviews)}건 — 스파스 버킷, 다음 구간에 합산")

                # title_kr 생성 (제목은 표시되므로)
                title_kr = existing_title_kr.strip() or generate_event_title_kr(
                    name, bucket["title"], bucket.get("event_type", ""), ""
                )
                print(f"    title_kr: {title_kr}")

                # 공식 이벤트의 경우 본문 기반 패치 요약 생성 (리뷰 없어도 패치 내용은 있음)
                sparse_patch_summary = ""
                if bucket.get("event_type") == "official":
                    sparse_patch_summary = analyze_patch_summary(
                        name, bucket["title"],
                        bucket.get("url", ""), bucket.get("content", "")
                    )
                    print(f"    [sparse] 패치 요약 생성 완료")

                # 스파스 마커 행 기록 (재실행 시 재처리 방지)
                sparse_row = {
                    "event_id": event_id,
                    "event_type": bucket["event_type"],
                    "date": bucket["date"],
                    "title": bucket["title"],
                    "language_scope": "all",
                    "sentiment_rate": "sparse",
                    "review_count": len(combined_reviews),
                    "ai_patch_summary": sparse_patch_summary,
                    "ai_reaction_summary": "",
                    "top_keywords": "[]",
                    "top_reviews": "[]",
                    "url": bucket.get("url", ""),
                    "is_sale_period": bucket.get("is_sale_period", False),
                    "sale_text": bucket.get("sale_text", ""),
                    "is_free_weekend": bucket.get("is_free_weekend", False),
                    "title_kr": title_kr,
                }
                existing_scope_ids = {
                    (r["event_id"], r["language_scope"]) for r in timeline_rows
                }
                if (event_id, "all") in existing_scope_ids:
                    gs_update_timeline(game_ss, event_id, "all", sparse_row)
                else:
                    gs_append_timeline(game_ss, sparse_row)
                time.sleep(1)
                continue  # 언어별 분석 생략

            # 스파스가 아닌 정상 버킷: carry-over 해소
            carry_over_reviews = []

            # 패치 요약 — 스코프 루프 바깥에서 1회만 생성 (API 호출 최소화)
            patch_summary = ""
            if bucket.get("event_type") == "official":
                patch_summary = analyze_patch_summary(
                    name, bucket["title"],
                    bucket.get("url", ""), bucket.get("content", "")
                )

            # AI 한국어 제목 — 사용자가 이미 수정한 경우 보존, 없으면 새로 생성
            if existing_title_kr.strip():
                title_kr = existing_title_kr.strip()
                print(f"    title_kr (기존 유지): {title_kr}")
            else:
                title_kr = generate_event_title_kr(
                    name,
                    bucket["title"],
                    bucket.get("event_type", ""),
                    patch_summary,
                )
                print(f"    title_kr: {title_kr}")

            # 언어별 분석
            scopes = ["all"] + top_languages
            existing_scope_ids = {
                (r["event_id"], r["language_scope"]) for r in timeline_rows
            }
            for scope in scopes:
                if scope == "all":
                    scope_reviews = combined_reviews  # carry-over 포함
                else:
                    scope_reviews = [r for r in combined_reviews if r.get("language") == scope]

                sampled = sample_reviews(scope_reviews)
                analysis = analyze_bucket(name, bucket["title"], sampled, scope)

                row = {
                    "event_id": event_id,
                    "event_type": bucket["event_type"],
                    "date": bucket["date"],
                    "title": bucket["title"],
                    "language_scope": scope,
                    "sentiment_rate": analysis.get("sentiment_rate", 0),
                    "review_count": len(scope_reviews),
                    "ai_patch_summary": patch_summary if scope == "all" else "",
                    "ai_reaction_summary": analysis.get("ai_reaction_summary", ""),
                    "top_keywords": json.dumps(analysis.get("top_keywords", []), ensure_ascii=False),
                    "top_reviews": json.dumps(analysis.get("top_reviews", []), ensure_ascii=False),
                    "url": bucket.get("url", ""),
                    "is_sale_period": bucket.get("is_sale_period", False),
                    "sale_text": bucket.get("sale_text", ""),
                    "is_free_weekend": bucket.get("is_free_weekend", False),
                    "title_kr": title_kr,
                }

                # 기존 행 있으면 업데이트, 없으면 추가
                if (event_id, scope) in existing_scope_ids:
                    gs_update_timeline(game_ss, event_id, scope, row)
                else:
                    gs_append_timeline(game_ss, row)
                time.sleep(2)

            print(f"  구간 분석 완료 ({bucket['title']})")

        # top_languages 확정 (최초 1회)
        if not game.get("top_languages") and top_languages:
            update_game(ss, appid, {"top_languages": ",".join(top_languages)})

        time.sleep(5)

        # 최신 타임라인 재조회 (분석 완료 후)
        final_timeline = gs_get_timeline(game_ss)

        # 전체 AI 브리핑 갱신
        briefing = _generate_briefing(name, final_timeline)

        # latest_sentiment_rate: 가장 최근 버킷(scope=all)의 긍정률
        # event_count: 공식/뉴스/수동 이벤트 고유 개수 (launch 버킷 제외)
        all_scope_rows = [
            r for r in final_timeline
            if r.get("language_scope") == "all"
            and r.get("event_type") not in ("launch",)
            and r.get("sentiment_rate") not in ("", "sparse", None)
            and not str(r.get("sentiment_rate", "")).strip() == ""
        ]
        all_scope_rows_sorted = sorted(
            all_scope_rows, key=lambda r: r.get("date", ""), reverse=True
        )
        latest_rate = ""
        if all_scope_rows_sorted:
            try:
                latest_rate = str(int(float(str(all_scope_rows_sorted[0].get("sentiment_rate", "")))))
            except (ValueError, TypeError):
                latest_rate = ""

        event_ids = {
            r["event_id"] for r in final_timeline
            if r.get("language_scope") == "all"
            and r.get("event_type") not in ("launch",)
            and r.get("event_id")
        }
        ev_count = len(event_ids)

        # ── CCU 피크타임 AI 분석 (조건부 — 주 1회 또는 최초) ───────────────
        # 매일 Gemini를 호출하면 동일한 결과가 반복되므로, 매주 월요일 또는 미생성 시만 갱신
        ccu_peaktime_comment = game.get("ccu_peaktime_comment", "")
        today_weekday = datetime.now(tz=timezone.utc).weekday()  # 0=Monday
        should_refresh_ccu = not ccu_peaktime_comment or today_weekday == 0
        if should_refresh_ccu:
            try:
                ccu_rows = get_ccu_data(game_ss)
                if ccu_rows:
                    ccu_peaktime_comment = generate_ccu_peaktime_comment(name, ccu_rows)
                    if ccu_peaktime_comment:
                        print(f"  [ccu_peaktime] 분석 완료 (갱신 사유: {'최초' if not game.get('ccu_peaktime_comment') else '주간 갱신'})")
                    time.sleep(2)
            except Exception as e:
                print(f"  [ccu_peaktime] 오류: {e}")
        else:
            print(f"  [ccu_peaktime] 기존 분석 유지 (월요일에 갱신)")

        # ── 언어권 교차 분석 ──────────────────────────────────────────
        language_cross_comment = ""
        try:
            raw_counts = get_language_counts(raw_ss)
            if raw_counts:
                total_raw = sum(raw_counts.values())
                # 타임라인에서 언어별 평균 긍정률 수집
                lang_sentiment: dict[str, list[float]] = {}
                for r in final_timeline:
                    scope = r.get("language_scope", "")
                    rate = r.get("sentiment_rate", "")
                    if scope and scope != "all" and rate not in ("", "sparse", None):
                        try:
                            lang_sentiment.setdefault(scope, []).append(float(rate))
                        except (ValueError, TypeError):
                            pass
                language_stats = []
                for lang, cnt in sorted(raw_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
                    rates = lang_sentiment.get(lang, [])
                    entry = {
                        "language": LANGUAGE_NAMES.get(lang, lang),
                        "review_count": cnt,
                        "review_pct": round(cnt / total_raw * 100, 1) if total_raw else 0,
                    }
                    if rates:
                        entry["avg_sentiment_rate"] = round(sum(rates) / len(rates), 1)
                    language_stats.append(entry)
                language_cross_comment = generate_language_cross_analysis(
                    name, language_stats, ccu_peaktime_comment
                )
                if language_cross_comment:
                    print(f"  [lang_cross] 분석 완료")
                time.sleep(2)
        except Exception as e:
            print(f"  [lang_cross] 오류: {e}")

        # ── 감성 추이 종합 분석 (2개 이상 구간이 있을 때만) ────────────────────
        sentiment_trend_comment = game.get("sentiment_trend_comment", "")
        analyzed_scope_rows = [
            r for r in final_timeline
            if r.get("language_scope") == "all"
            and r.get("event_type") not in ("launch",)
            and str(r.get("sentiment_rate", "")).strip() not in ("", "sparse")
        ]
        if len(analyzed_scope_rows) >= 2:
            trend_buckets = [
                {
                    "date":           r.get("date", ""),
                    "title":          r.get("title", ""),
                    "sentiment_rate": r.get("sentiment_rate", ""),
                    "review_count":   r.get("review_count", 0),
                }
                for r in sorted(analyzed_scope_rows, key=lambda r: r.get("date", ""))
            ]
            try:
                sentiment_trend_comment = generate_sentiment_trend_comment(name, trend_buckets)
                if sentiment_trend_comment:
                    print(f"  [sentiment_trend] 분석 완료")
                time.sleep(2)
            except Exception as e:
                print(f"  [sentiment_trend] 오류: {e}")

        update_game(ss, appid, {
            "ai_briefing":             briefing,
            "ai_briefing_date":        today,
            "latest_sentiment_rate":   latest_rate,
            "event_count":             ev_count,
            "ccu_peaktime_comment":    ccu_peaktime_comment,
            "language_cross_comment":  language_cross_comment,
            "sentiment_trend_comment": sentiment_trend_comment,
        })
        print(f"AI 브리핑 갱신 완료 (긍정률={latest_rate}%, 이벤트={ev_count}건)")

    print("\n전체 분석 완료")


def _get_top_languages(game: dict, timeline_rows: list[dict], raw_ss=None) -> list[str]:
    # 1순위: 게임 레코드에 저장된 값
    stored = game.get("top_languages", "")
    if stored:
        return [l.strip() for l in stored.split(",") if l.strip()]

    # 2순위: 기존 타임라인 행의 언어별 리뷰 수
    lang_counts: dict[str, int] = {}
    for r in timeline_rows:
        scope = r.get("language_scope", "")
        if scope and scope != "all":
            lang_counts[scope] = lang_counts.get(scope, 0) + int(r.get("review_count", 0) or 0)

    if lang_counts:
        sorted_langs = sorted(lang_counts.items(), key=lambda x: x[1], reverse=True)
        top = [l for l, _ in sorted_langs[:TOP_LANGUAGES_COUNT]]
        if top:
            return top

    # 3순위: RAW 리뷰 시트에서 직접 언어 분포 집계 (첫 분석 시)
    if raw_ss is not None:
        try:
            raw_counts = get_language_counts(raw_ss)
            if raw_counts:
                sorted_langs = sorted(raw_counts.items(), key=lambda x: x[1], reverse=True)
                top = [l for l, _ in sorted_langs[:TOP_LANGUAGES_COUNT]]
                if top:
                    print(f"  [top_languages] RAW 리뷰에서 감지: {top}")
                    return top
        except Exception as e:
            print(f"  [top_languages] RAW 집계 실패: {e}")

    # 폴백: 한국어 + 영어
    return ["koreana", "english"]


def _generate_briefing(name: str, timeline_rows: list[dict]) -> str:
    all_rows = [
        r for r in timeline_rows
        if r.get("language_scope") == "all"
        and str(r.get("sentiment_rate", "")).strip() not in ("", "sparse")
    ]
    sorted_rows = sorted(all_rows, key=lambda x: x.get("date", ""), reverse=True)

    # 추이 방향 계산 (최근 3건 vs 그 이전 3건 평균 비교)
    trend_direction = ""
    try:
        recent = [float(r.get("sentiment_rate", 0) or 0) for r in sorted_rows[:3]]
        older  = [float(r.get("sentiment_rate", 0) or 0) for r in sorted_rows[3:6]]
        if recent and older:
            r_avg = sum(recent) / len(recent)
            o_avg = sum(older) / len(older)
            if r_avg > o_avg + 5:
                trend_direction = f"상승 추세 (최근 평균 {r_avg:.0f}% vs 이전 {o_avg:.0f}%)"
            elif r_avg < o_avg - 5:
                trend_direction = f"하락 추세 (최근 평균 {r_avg:.0f}% vs 이전 {o_avg:.0f}%)"
            else:
                trend_direction = f"안정 기조 (최근 평균 {r_avg:.0f}%)"
    except (ValueError, TypeError):
        pass

    summary_parts = []
    for r in sorted_rows[:10]:
        try:
            rate = float(r.get("sentiment_rate", 0) or 0)
            summary_parts.append(
                f"- [{r.get('date')}] {r.get('title')}: 긍정률 {rate:.0f}%, "
                f"리뷰 {r.get('review_count')}건. {r.get('ai_reaction_summary', '')[:150]}"
            )
        except (ValueError, TypeError):
            pass

    summary = "\n".join(summary_parts)
    return generate_ai_briefing(name, summary, trend_direction)


if __name__ == "__main__":
    run()
