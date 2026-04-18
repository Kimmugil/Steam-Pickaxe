"""
migrate_game_data.py — 마스터 시트 → 개별 게임 시트 데이터 마이그레이션

용도:
  마스터 시트의 ccu_{appid} 탭에 있는 CCU 데이터를
  개별 게임 시트(RAW_REVIEWS)의 ccu 탭으로 이동합니다.

실행 방법:
  cd backend
  python -m sheets.migrate_game_data --appid 3862670

사전 조건:
  - games 탭의 game_sheet_id 컬럼이 채워져 있어야 함
  - 채워지려면 collect.yml 액션을 1회 실행해야 함
"""
import sys, os, argparse
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sheets.master_sheet import get_spreadsheet, get_game
from sheets.raw_reviews import open_raw_spreadsheet
import gspread

CCU_HEADERS = ["timestamp", "ccu_value", "is_sale_period", "is_free_weekend", "is_archived_gap"]

def migrate_ccu(appid: str):
    print(f"[MIGRATE] appid={appid} CCU 데이터 마이그레이션 시작")

    ss = get_spreadsheet()
    game = get_game(ss, appid)
    if not game:
        print(f"[ERROR] appid={appid} 게임을 찾을 수 없습니다.")
        return

    game_sheet_id = game.get("game_sheet_id", "")
    if not game_sheet_id:
        print(f"[ERROR] game_sheet_id가 비어있습니다. collect.yml을 먼저 실행하세요.")
        return

    # 마스터 시트에서 CCU 데이터 읽기
    try:
        master_ccu_ws = ss.worksheet(f"ccu_{appid}")
        all_rows = master_ccu_ws.get_all_values()
        if len(all_rows) < 2:
            print("[INFO] 마스터 시트에 CCU 데이터가 없습니다.")
            return
        data_rows = all_rows[1:]  # 헤더 제외
        print(f"[INFO] 마스터 시트에서 {len(data_rows)}건 CCU 데이터 읽음")
    except gspread.WorksheetNotFound:
        print(f"[INFO] ccu_{appid} 탭이 없습니다. 마이그레이션 건너뜀.")
        return

    # 개별 게임 시트 열기
    game_ss = open_raw_spreadsheet(game_sheet_id)

    # ccu 탭 생성 또는 기존 탭 사용
    try:
        ccu_ws = game_ss.worksheet("ccu")
        print("[INFO] 기존 ccu 탭 사용")
    except gspread.WorksheetNotFound:
        ccu_ws = game_ss.add_worksheet(title="ccu", rows=100000, cols=len(CCU_HEADERS))
        ccu_ws.append_row(CCU_HEADERS)
        print("[INFO] ccu 탭 신규 생성")

    # 기존 데이터 확인 (중복 방지)
    existing = set(ccu_ws.col_values(1)[1:])  # 기존 timestamp 집합

    new_rows = [r for r in data_rows if r[0] and r[0] not in existing]
    if new_rows:
        ccu_ws.append_rows(new_rows)
        print(f"[OK] {len(new_rows)}건 CCU 데이터 마이그레이션 완료")
    else:
        print("[INFO] 추가할 신규 CCU 데이터 없음")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--appid", required=True, help="마이그레이션할 게임 AppID")
    args = parser.parse_args()
    migrate_ccu(args.appid)
