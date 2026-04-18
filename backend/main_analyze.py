"""
AI 분석 진입점 (GitHub Actions: analyze.yml — 일 단위)
- 미분석 구간의 AI 분석 실행
- 전체 AI 브리핑 갱신
- 챗봇 카운터 초기화
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))

from sheets.master_sheet import (
    get_spreadsheet, get_all_games, update_game, set_config_value, get_config,
)
from sheets.game_sheet import (
    open_game_sheet, get_timeline as gs_get_timeline,
    append_timeline_row as gs_append_timeline,
    update_timeline_row as gs_update_timeline,
)
from sheets.raw_reviews import open_raw_spreadsheet, get_reviews_in_range
from analyzers.bucketer import build_buckets, filter_reviews_for_bucket, sample_reviews
from analyzers.gemini_analyzer import (
    analyze_bucket, analyze_patch_summary, generate_ai_briefing,
    generate_ccu_peaktime_comment, generate_language_cross_analysis, LANGUAGE_NAMES
)
from datetime import datetime, timezone

GDRIVE_FOLDER_ID = os.environ.get("GDRIVE_FOLDER_ID", "")
TOP_LANGUAGES_COUNT = 3


def run():
    ss = get_spreadsheet()
    today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")

    # 챗봇 카운터 초기화
    config = get_config(ss)
    last_reset = config.get("chatbot_last_reset_date", "")
    if last_reset != today:
        set_config_value(ss, "chatbot_today_count", "0")
        set_config_value(ss, "chatbot_last_reset_date", today)
        print("챗봇 카운터 초기화 완료")

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

        game_ss = open_game_sheet(game_sheet_id)
        timeline_rows = gs_get_timeline(game_ss)
        buckets = build_buckets(timeline_rows)

        # 미분석 구간 식별 (language_scope=all, sentiment_rate가 없는 행)
        analyzed_ids = {
            r["event_id"]
            for r in timeline_rows
            if r.get("language_scope") == "all" and r.get("sentiment_rate") != ""
        }

        # game_sheet_id IS the raw spreadsheet — open directly, no GAS needed
        raw_ss = open_raw_spreadsheet(game_sheet_id)
        top_languages = _get_top_languages(game, timeline_rows)

        for bucket in buckets:
            event_id = bucket["event_id"]
            if event_id in analyzed_ids:
                continue

            print(f"  구간 분석: {bucket['title']} ({bucket['date']})")

            # RAW 리뷰 필터링
            from datetime import datetime as dt
            years = list(range(
                dt.utcfromtimestamp(max(bucket["start_ts"], 1)).year,
                dt.utcnow().year + 1
            ))
            raw_reviews = get_reviews_in_range(raw_ss, bucket["start_ts"], bucket["end_ts"], years)

            # 언어별 분석
            scopes = ["all"] + top_languages
            for scope in scopes:
                if scope == "all":
                    scope_reviews = raw_reviews
                else:
                    scope_reviews = [r for r in raw_reviews if r.get("language") == scope]

                sampled = sample_reviews(scope_reviews)
                analysis = analyze_bucket(name, bucket["title"], sampled, scope)

                # 패치 요약 (all 스코프 + 공식 이벤트만)
                patch_summary = ""
                if scope == "all" and bucket.get("event_type") == "official":
                    patch_summary = analyze_patch_summary(name, bucket["title"], bucket.get("url", ""))

                row = {
                    "event_id": event_id,
                    "event_type": bucket["event_type"],
                    "date": bucket["date"],
                    "title": bucket["title"],
                    "language_scope": scope,
                    "sentiment_rate": analysis["sentiment_rate"],
                    "review_count": len(scope_reviews),
                    "ai_patch_summary": patch_summary if scope == "all" else "",
                    "ai_reaction_summary": analysis["ai_reaction_summary"],
                    "top_keywords": json.dumps(analysis["top_keywords"], ensure_ascii=False),
                    "top_reviews": json.dumps(analysis["top_reviews"], ensure_ascii=False),
                    "url": bucket.get("url", ""),
                    "is_sale_period": bucket.get("is_sale_period", False),
                    "sale_text": bucket.get("sale_text", ""),
                    "is_free_weekend": bucket.get("is_free_weekend", False),
                }

                # 기존 행 있으면 업데이트, 없으면 추가
                existing_scope_ids = {
                    (r["event_id"], r["language_scope"])
                    for r in timeline_rows
                }
                if (event_id, scope) in existing_scope_ids:
                    gs_update_timeline(game_ss, event_id, scope, row)
                else:
                    gs_append_timeline(game_ss, row)

            print(f"  구간 분석 완료 ({bucket['title']})")

        # top_languages 확정 (최초 1회)
        if not game.get("top_languages") and top_languages:
            update_game(ss, appid, {"top_languages": ",".join(top_languages)})

        # 전체 AI 브리핑 갱신
        briefing = _generate_briefing(name, gs_get_timeline(game_ss))
        update_game(ss, appid, {
            "ai_briefing": briefing,
            "ai_briefing_date": today,
        })
        print(f"AI 브리핑 갱신 완료")

    print("\n전체 분석 완료")


def _get_top_languages(game: dict, timeline_rows: list[dict]) -> list[str]:
    stored = game.get("top_languages", "")
    if stored:
        return [l.strip() for l in stored.split(",") if l.strip()]

    # 리뷰 수 기준 언어 집계 (all 스코프 제외)
    lang_counts: dict[str, int] = {}
    for r in timeline_rows:
        scope = r.get("language_scope", "")
        if scope and scope != "all":
            lang_counts[scope] = lang_counts.get(scope, 0) + int(r.get("review_count", 0))

    sorted_langs = sorted(lang_counts.items(), key=lambda x: x[1], reverse=True)
    top = [l for l, _ in sorted_langs[:TOP_LANGUAGES_COUNT]]
    return top or ["koreana", "english"]


def _generate_briefing(name: str, timeline_rows: list[dict]) -> str:
    all_rows = [r for r in timeline_rows if r.get("language_scope") == "all"]
    summary_parts = []
    for r in sorted(all_rows, key=lambda x: x.get("date", ""), reverse=True)[:10]:
        summary_parts.append(
            f"- [{r.get('date')}] {r.get('title')}: 긍정률 {r.get('sentiment_rate')}%, "
            f"리뷰 {r.get('review_count')}건. {r.get('ai_reaction_summary', '')[:200]}"
        )
    summary = "\n".join(summary_parts)
    return generate_ai_briefing(name, summary)


if __name__ == "__main__":
    run()
