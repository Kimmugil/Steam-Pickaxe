"""
AI 분석 진입점 (GitHub Actions: analyze.yml — 월 단위)
- 미분석/현재 월의 월간 AI 분석 실행
- 전체 AI 브리핑 갱신
"""
import sys, os, json, time, re as _re
sys.path.insert(0, os.path.dirname(__file__))

from sheets.master_sheet import get_spreadsheet, get_all_games, update_game
from sheets.game_sheet import (
    open_game_sheet, get_timeline as gs_get_timeline,
    append_timeline_row as gs_append_timeline,
    update_timeline_row as gs_update_timeline,
    update_timeline_event_field as gs_update_event_field,
    deduplicate_timeline,
    build_scope_row_map,
    build_event_row_map,
    get_ccu_data,
)
from sheets.raw_reviews import open_raw_spreadsheet, get_reviews_in_range, get_language_counts
from analyzers.bucketer import build_monthly_buckets, sample_reviews
from analyzers.gemini_analyzer import (
    analyze_bucket, analyze_patch_summary, generate_event_title_kr,
    generate_ai_briefing, generate_sentiment_trend_comment,
    generate_ccu_peaktime_comment, generate_language_cross_analysis, LANGUAGE_NAMES,
)
from datetime import datetime, timezone

GDRIVE_FOLDER_ID    = os.environ.get("GDRIVE_FOLDER_ID", "")
TOP_LANGUAGES_COUNT = 3

# ── 타겟 필터 ──────────────────────────────────────────────────────────────────
# TARGET_APPID:       설정 시 해당 게임만 처리
# TARGET_YEAR_MONTH:  "YYYY-MM" 설정 시 해당 월만 분석 (미설정 = 미분석+현재 월 전체)
TARGET_APPID       = os.environ.get("TARGET_APPID",       "").strip()
TARGET_YEAR_MONTH  = os.environ.get("TARGET_YEAR_MONTH",  "").strip()


def run():
    ss = get_spreadsheet()
    today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
    now_ym = datetime.now(tz=timezone.utc).strftime("%Y-%m")

    if TARGET_APPID:
        print(f"[TARGET] 게임 필터: {TARGET_APPID}")
    if TARGET_YEAR_MONTH:
        print(f"[TARGET] 월 필터: {TARGET_YEAR_MONTH}")

    games = get_all_games(ss)
    for game in games:
        if game.get("status") != "active":
            continue

        appid         = str(game.get("appid", ""))
        name          = game.get("name", appid)
        game_sheet_id = game.get("game_sheet_id", "")

        if TARGET_APPID and appid != TARGET_APPID:
            continue
        if not game_sheet_id:
            print(f"[SKIP] game_sheet_id 없음: {name} ({appid})")
            continue

        # ai_approved 게이트 (기존 분석 게임은 통과)
        ai_briefing_exists = bool(str(game.get("ai_briefing", "")).strip())
        ai_approved = str(game.get("ai_approved", "")).strip().lower() == "true"
        if not ai_briefing_exists and not ai_approved:
            print(f"[SKIP] AI 분석 미승인 게임: {name} ({appid})")
            continue

        print(f"\n{'='*50}\n분석 시작: {name} ({appid})")

        # ── top_languages 재계산 ────────────────────────────────────────────
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
                    print(f"  [top_languages] 재계산: {new_top}")
            except Exception as _e:
                print(f"  [top_languages] 재계산 실패: {_e}")

        game_ss  = open_game_sheet(game_sheet_id)
        raw_ss   = open_raw_spreadsheet(game_sheet_id)
        top_languages = _get_top_languages(game, [], raw_ss)

        # ── 중복 이벤트 정리 ────────────────────────────────────────────────
        _dedup_removed = deduplicate_timeline(game_ss)
        if _dedup_removed:
            print(f"  [dedup] {_dedup_removed}건 중복 이벤트 제거")

        timeline_rows = gs_get_timeline(game_ss)

        # ── 언어 분포 저장 ──────────────────────────────────────────────────
        try:
            raw_counts = get_language_counts(raw_ss)
            if raw_counts:
                lang_dist_str = json.dumps(
                    {l: c for l, c in sorted(raw_counts.items(), key=lambda x: x[1], reverse=True)},
                    ensure_ascii=False,
                )
                update_game(ss, appid, {"language_distribution": lang_dist_str})
        except Exception as e:
            print(f"  [lang_dist] 실패: {e}")

        # ── title_kr 백필 (개별 이벤트) ─────────────────────────────────────
        rows_needing_title_kr = [
            r for r in timeline_rows
            if r.get("language_scope") == "all"
            and r.get("event_type") not in ("monthly_summary", "news", "launch")
            and not r.get("title_kr", "").strip()
        ]
        if rows_needing_title_kr:
            _ev_row_map = build_event_row_map(timeline_rows)
            print(f"  [title_kr 백필] {len(rows_needing_title_kr)}건")
            for r in rows_needing_title_kr:
                try:
                    tkr = generate_event_title_kr(
                        name, r.get("title", ""), r.get("event_type", ""), ""
                    )
                    gs_update_event_field(game_ss, r["event_id"], "title_kr", tkr,
                                         event_row_map=_ev_row_map)
                    print(f"    [{r.get('date')}] {r.get('title')} → {tkr}")
                    time.sleep(1)
                except Exception as e:
                    print(f"    [title_kr 오류] {r.get('title')}: {e}")
            timeline_rows = gs_get_timeline(game_ss)

        # ── ai_patch_summary 오염 정제 (기존 이벤트 행) ─────────────────────
        _bad_pattern = _re.compile(
            r"^\s*(\[\d?단계\]|UPDATE\s*[:：]|EVENT\s*[:：]|DELAY\s*[:：]"
            r"|MAINTENANCE\s*[:：]|ANNOUNCEMENT\s*[:：])"
        )
        rows_with_bad_summary = [
            r for r in timeline_rows
            if r.get("language_scope") == "all"
            and r.get("event_type") in ("official", "manual")
            and _bad_pattern.match(str(r.get("ai_patch_summary", "")))
        ]
        if rows_with_bad_summary:
            _ev_row_map_bad = build_event_row_map(timeline_rows)
            for r in rows_with_bad_summary:
                try:
                    raw_text = str(r.get("ai_patch_summary", ""))
                    fixed = _re.sub(r"^\s*\[\d?단계\][^\n]*\n?", "", raw_text, flags=_re.MULTILINE).strip()
                    fixed = _re.sub(r"^\s*(UPDATE|DELAY|MAINTENANCE|EVENT|ANNOUNCEMENT|OTHER)\s*[:：]\s*", "", fixed).strip()
                    if fixed and fixed != raw_text:
                        gs_update_event_field(game_ss, r["event_id"], "ai_patch_summary", fixed,
                                              event_row_map=_ev_row_map_bad)
                except Exception:
                    pass
            timeline_rows = gs_get_timeline(game_ss)

        # ── 월별 버킷 구성 ──────────────────────────────────────────────────
        monthly_buckets = build_monthly_buckets(timeline_rows)

        # 이미 완료된 월 (monthly_summary 행이 있고 sentiment_rate가 채워진 것)
        completed_months = {
            r["event_id"][len("monthly_"):].replace("_", "-")
            for r in timeline_rows
            if r.get("event_type") == "monthly_summary"
            and r.get("language_scope") == "all"
            and str(r.get("sentiment_rate", "")).strip() not in ("", "sparse", None)
        }

        # scope_row_map: (event_id, language_scope) → 행 번호 (UPDATE/APPEND 분기용)
        scope_row_map      = build_scope_row_map(timeline_rows)
        existing_scope_ids = {(r["event_id"], r["language_scope"]) for r in timeline_rows}

        MONTHLY_SPARSE = 5  # 월간 리뷰 이 건수 이하면 sparse

        for bucket in monthly_buckets:
            ym = bucket["year_month"]

            # TARGET_YEAR_MONTH 필터
            if TARGET_YEAR_MONTH and ym != TARGET_YEAR_MONTH:
                continue
            # 현재 월은 항상 재분석, 나머지는 완료된 것 skip
            if ym != now_ym and ym in completed_months:
                continue

            print(f"  월간 분석: {bucket['title']} ({ym})")

            # ── RAW 리뷰 수집 ────────────────────────────────────────────
            from datetime import datetime as _dt
            years = list(range(
                _dt.utcfromtimestamp(max(bucket["start_ts"], 1)).year,
                _dt.utcnow().year + 1,
            ))
            month_reviews = get_reviews_in_range(raw_ss, bucket["start_ts"], bucket["end_ts"], years)
            print(f"    → 리뷰 {len(month_reviews)}건")

            # ── 월간 패치 요약 (official 이벤트 묶음) ────────────────────
            monthly_patch_summary = ""
            if bucket["official_events"]:
                parts = []
                for ev in bucket["official_events"]:
                    content = str(ev.get("content", "")).strip()
                    if content:
                        parts.append(f"[{ev.get('date')}] {ev.get('title', '')}\n{content[:2000]}")
                    else:
                        parts.append(f"[{ev.get('date')}] {ev.get('title', '')}")
                combined_content = "\n\n---\n\n".join(parts)
                combined_title = f"{bucket['title']} 업데이트 종합 ({len(bucket['official_events'])}건)"
                monthly_patch_summary = analyze_patch_summary(
                    name, combined_title, "", combined_content
                )
                print(f"    [patch_summary] 생성 완료 ({len(bucket['official_events'])}건 이벤트 묶음)")
                time.sleep(1)

            # ── Sparse 처리 ──────────────────────────────────────────────
            if len(month_reviews) <= MONTHLY_SPARSE:
                print(f"    → sparse (리뷰 {len(month_reviews)}건)")
                sparse_row = {
                    "event_id":           bucket["event_id"],
                    "event_type":         "monthly_summary",
                    "date":               bucket["date"],
                    "title":              bucket["title"],
                    "language_scope":     "all",
                    "sentiment_rate":     "sparse",
                    "review_count":       len(month_reviews),
                    "ai_patch_summary":   monthly_patch_summary,
                    "ai_reaction_summary": "",
                    "top_keywords":       "[]",
                    "top_reviews":        "[]",
                    "url":                "",
                    "is_sale_period":     False,
                    "sale_text":          "",
                    "is_free_weekend":    False,
                    "title_kr":           bucket["title"],
                }
                if (bucket["event_id"], "all") in existing_scope_ids:
                    gs_update_timeline(game_ss, bucket["event_id"], "all", sparse_row,
                                       row_map=scope_row_map)
                else:
                    gs_append_timeline(game_ss, sparse_row)
                    scope_row_map[(bucket["event_id"], "all")] = max(scope_row_map.values(), default=1) + 1
                    existing_scope_ids.add((bucket["event_id"], "all"))
                time.sleep(1)
                continue

            # ── 언어별 AI 분석 ───────────────────────────────────────────
            scopes = ["all"] + top_languages
            for scope in scopes:
                if scope == "all":
                    scope_reviews = month_reviews
                    sampled = sample_reviews(scope_reviews)
                else:
                    scope_reviews = [r for r in month_reviews if r.get("language") == scope]
                    sampled = sample_reviews(scope_reviews, max_total=500)

                if not sampled:
                    continue

                analysis = analyze_bucket(name, bucket["title"], sampled, scope)

                row = {
                    "event_id":           bucket["event_id"],
                    "event_type":         "monthly_summary",
                    "date":               bucket["date"],
                    "title":              bucket["title"],
                    "language_scope":     scope,
                    "sentiment_rate":     analysis.get("sentiment_rate", 0),
                    "review_count":       len(scope_reviews),
                    "ai_patch_summary":   monthly_patch_summary if scope == "all" else "",
                    "ai_reaction_summary": analysis.get("ai_reaction_summary", ""),
                    "top_keywords":       json.dumps(analysis.get("top_keywords", []), ensure_ascii=False),
                    "top_reviews":        json.dumps(analysis.get("top_reviews", []), ensure_ascii=False),
                    "url":                "",
                    "is_sale_period":     False,
                    "sale_text":          "",
                    "is_free_weekend":    False,
                    "title_kr":           bucket["title"],
                }

                if (bucket["event_id"], scope) in existing_scope_ids:
                    gs_update_timeline(game_ss, bucket["event_id"], scope, row,
                                       row_map=scope_row_map)
                else:
                    gs_append_timeline(game_ss, row)
                    next_row = max(scope_row_map.values(), default=1) + 1
                    scope_row_map[(bucket["event_id"], scope)] = next_row
                    existing_scope_ids.add((bucket["event_id"], scope))
                time.sleep(2)

            print(f"  월간 분석 완료: {bucket['title']}")

        # top_languages 초기 저장
        if not game.get("top_languages") and top_languages:
            update_game(ss, appid, {"top_languages": ",".join(top_languages)})

        time.sleep(5)

        # ── 최신 타임라인 재조회 ─────────────────────────────────────────
        final_timeline = gs_get_timeline(game_ss)

        # ── 전체 AI 브리핑 ──────────────────────────────────────────────
        briefing = _generate_briefing(name, final_timeline)

        # latest_sentiment_rate: 가장 최근 monthly_summary(scope=all)의 긍정률
        # event_count: 고유 이벤트 수 (monthly_summary 제외)
        monthly_all_rows = [
            r for r in final_timeline
            if r.get("event_type") == "monthly_summary"
            and r.get("language_scope") == "all"
            and str(r.get("sentiment_rate", "")).strip() not in ("", "sparse", None)
        ]
        monthly_all_rows.sort(key=lambda r: r.get("date", ""), reverse=True)

        latest_rate = ""
        if monthly_all_rows:
            try:
                latest_rate = str(int(float(str(monthly_all_rows[0].get("sentiment_rate", "")))))
            except (ValueError, TypeError):
                pass

        event_ids = {
            r["event_id"] for r in final_timeline
            if r.get("language_scope") == "all"
            and r.get("event_type") not in ("launch", "monthly_summary")
            and r.get("event_id")
        }
        ev_count = len(event_ids)

        # ── CCU 피크타임 AI 분석 (주 1회) ─────────────────────────────
        ccu_peaktime_comment = game.get("ccu_peaktime_comment", "")
        today_weekday = datetime.now(tz=timezone.utc).weekday()
        should_refresh_ccu = not ccu_peaktime_comment or today_weekday == 0
        if should_refresh_ccu:
            try:
                ccu_rows = get_ccu_data(game_ss)
                if ccu_rows:
                    ccu_peaktime_comment = generate_ccu_peaktime_comment(name, ccu_rows)
                    if ccu_peaktime_comment:
                        print(f"  [ccu_peaktime] 갱신 완료")
                    time.sleep(2)
            except Exception as e:
                print(f"  [ccu_peaktime] 오류: {e}")

        # ── 언어권 교차 분석 ─────────────────────────────────────────
        language_cross_comment = ""
        try:
            raw_counts = get_language_counts(raw_ss)
            if raw_counts:
                total_raw = sum(raw_counts.values())
                lang_sentiment: dict[str, list[float]] = {}
                for r in final_timeline:
                    scope = r.get("language_scope", "")
                    rate  = r.get("sentiment_rate", "")
                    if scope and scope != "all" and rate not in ("", "sparse", None):
                        try:
                            lang_sentiment.setdefault(scope, []).append(float(rate))
                        except (ValueError, TypeError):
                            pass
                language_stats = []
                for lang, cnt in sorted(raw_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
                    rates = lang_sentiment.get(lang, [])
                    entry = {
                        "language":     LANGUAGE_NAMES.get(lang, lang),
                        "review_count": cnt,
                        "review_pct":   round(cnt / total_raw * 100, 1) if total_raw else 0,
                    }
                    if rates:
                        entry["avg_sentiment_rate"] = round(sum(rates) / len(rates), 1)
                    language_stats.append(entry)
                language_cross_comment = generate_language_cross_analysis(
                    name, language_stats, ccu_peaktime_comment
                )
                time.sleep(2)
        except Exception as e:
            print(f"  [lang_cross] 오류: {e}")

        # ── 감성 추이 종합 분석 ────────────────────────────────────────
        sentiment_trend_comment = game.get("sentiment_trend_comment", "")
        analyzed_monthly_rows = [
            r for r in final_timeline
            if r.get("event_type") == "monthly_summary"
            and r.get("language_scope") == "all"
            and str(r.get("sentiment_rate", "")).strip() not in ("", "sparse")
        ]
        if len(analyzed_monthly_rows) >= 2:
            trend_buckets = [
                {
                    "date":           r.get("date", ""),
                    "title":          r.get("title", ""),
                    "sentiment_rate": r.get("sentiment_rate", ""),
                    "review_count":   r.get("review_count", 0),
                }
                for r in sorted(analyzed_monthly_rows, key=lambda r: r.get("date", ""))
            ]
            try:
                sentiment_trend_comment = generate_sentiment_trend_comment(name, trend_buckets)
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
        print(f"분석 완료 (긍정률={latest_rate}%, 이벤트={ev_count}건)")

    print("\n전체 분석 완료")


def _get_top_languages(game: dict, timeline_rows: list[dict], raw_ss=None) -> list[str]:
    stored = game.get("top_languages", "")
    if stored:
        return [l.strip() for l in stored.split(",") if l.strip()]
    if raw_ss is not None:
        try:
            raw_counts = get_language_counts(raw_ss)
            if raw_counts:
                top = [l for l, _ in sorted(raw_counts.items(), key=lambda x: x[1], reverse=True)[:TOP_LANGUAGES_COUNT]]
                if top:
                    return top
        except Exception:
            pass
    return ["koreana", "english"]


def _generate_briefing(name: str, timeline_rows: list[dict]) -> str:
    # monthly_summary rows 기반으로 브리핑 생성
    monthly_rows = [
        r for r in timeline_rows
        if r.get("event_type") == "monthly_summary"
        and r.get("language_scope") == "all"
        and str(r.get("sentiment_rate", "")).strip() not in ("", "sparse")
    ]
    sorted_rows = sorted(monthly_rows, key=lambda x: x.get("date", ""), reverse=True)

    trend_direction = ""
    try:
        recent = [float(r.get("sentiment_rate", 0) or 0) for r in sorted_rows[:3]]
        older  = [float(r.get("sentiment_rate", 0) or 0) for r in sorted_rows[3:6]]
        if recent and older:
            r_avg = sum(recent) / len(recent)
            o_avg = sum(older)  / len(older)
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
                f"- [{r.get('title')}] 긍정률 {rate:.0f}%, "
                f"리뷰 {r.get('review_count')}건. {r.get('ai_reaction_summary', '')[:150]}"
            )
        except (ValueError, TypeError):
            pass

    return generate_ai_briefing(name, "\n".join(summary_parts), trend_direction)


if __name__ == "__main__":
    run()
