"""
SteamDB CSV → 게임 시트 ccu 탭 임포트 스크립트

SteamDB에서 내려받은 CCU CSV 파일을 지정 게임의 ccu 탭에 일괄 적재합니다.
Players 값이 비어있는 행(출시 전 구간)은 자동으로 건너뜁니다.

사용법:
  python import_steamdb_ccu.py <appid> <csv_path>

예시:
  python import_steamdb_ccu.py 1962700 ~/Downloads/steamdb_chart_1962700.csv

CSV 형식 (SteamDB 기본 export):
  "DateTime","Players"
  "2026-05-14 15:00:00",110891
  ...
"""
import sys, os, csv
sys.path.insert(0, os.path.dirname(__file__))


def run(appid: str, csv_path: str):
    from sheets.master_sheet import get_spreadsheet, get_all_games
    from sheets.game_sheet import open_game_sheet, get_or_create_ccu_tab, bulk_append_ccu, get_ccu_data

    # 1. master sheet에서 game_sheet_id 조회
    print("마스터 시트 로딩 중...")
    ss = get_spreadsheet()
    games = get_all_games(ss)
    game = next((g for g in games if str(g.get("appid")) == str(appid)), None)
    if not game:
        print(f"[ERROR] appid {appid} 를 games 탭에서 찾을 수 없습니다.")
        return

    game_sheet_id = str(game.get("game_sheet_id", "")).strip()
    if not game_sheet_id:
        print(f"[ERROR] game_sheet_id 없음 — collect-game.yml 먼저 실행하세요.")
        return

    print(f"게임: {game.get('name')} ({appid})")
    print(f"게임 시트: {game_sheet_id}")

    # 2. CSV 파싱
    rows_to_insert: list[list] = []
    skipped_empty = 0
    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            dt_raw   = row.get("DateTime", "").strip().strip('"')
            val_raw  = row.get("Players",  "").strip().strip('"')

            if not val_raw:          # 플레이어 수 없는 행(출시 전) 건너뜀
                skipped_empty += 1
                continue

            try:
                ccu_value = int(val_raw)
            except ValueError:
                skipped_empty += 1
                continue

            # SteamDB timestamp → ISO 8601 (공백 그대로도 OK, 콜론 포함)
            # "2026-05-14 15:00:00" → "2026-05-14T15:00:00Z" 변환
            timestamp = dt_raw.replace(" ", "T")
            if not timestamp.endswith("Z"):
                timestamp += "Z"

            rows_to_insert.append([timestamp, ccu_value, False, False, True])
            # is_archived_gap=True: 과거 수동 적재 데이터임을 표시

    print(f"CSV 파싱 완료: {len(rows_to_insert)}건 임포트 예정, {skipped_empty}건 건너뜀(빈 값)")

    if not rows_to_insert:
        print("[INFO] 임포트할 데이터 없음.")
        return

    # 3. 기존 ccu 탭 데이터와 중복 확인
    print("게임 시트 연결 중...")
    game_ss = open_game_sheet(game_sheet_id)

    existing = get_ccu_data(game_ss)
    existing_timestamps = {str(r.get("timestamp", "")) for r in existing}
    print(f"기존 ccu 데이터: {len(existing)}건")

    deduped = [r for r in rows_to_insert if r[0] not in existing_timestamps]
    duplicates = len(rows_to_insert) - len(deduped)
    if duplicates:
        print(f"중복 {duplicates}건 제외 → {len(deduped)}건 신규 적재")

    if not deduped:
        print("[INFO] 모두 이미 존재하는 데이터 — 임포트 건너뜀.")
        return

    # 4. 일괄 적재 (500건씩 배치)
    BATCH = 500
    total = len(deduped)
    for i in range(0, total, BATCH):
        batch = deduped[i:i+BATCH]
        bulk_append_ccu(game_ss, batch)
        print(f"  [{i+len(batch)}/{total}] 적재 완료")

    print(f"\n✅ CCU 임포트 완료: {len(deduped)}건 추가됨")
    print(f"   peak: {max(r[1] for r in deduped):,}명 ({max(deduped, key=lambda r: r[1])[0]})")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("사용법: python import_steamdb_ccu.py <appid> <csv_path>")
        print("예시:   python import_steamdb_ccu.py 1962700 ~/Downloads/steamdb_chart_1962700.csv")
        sys.exit(1)

    run(appid=sys.argv[1], csv_path=sys.argv[2])
