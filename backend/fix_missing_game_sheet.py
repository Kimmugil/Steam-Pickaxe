"""
game_sheet_id 누락 게임 복구 스크립트
- collecting → active 전환 시 리뷰가 없어 game_sheet_id가 미설정된 게임을 수동 복구
- status를 collecting으로 되돌린 뒤 collect 워크플로우(TARGET_APPID)를 재실행하거나,
  이 스크립트로 직접 게임 시트를 생성하고 game_sheet_id를 기록한다.

사용법:
  APPID=1962700 python fix_missing_game_sheet.py
  또는 appid를 아래 FIX_APPIDS에 직접 입력
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from sheets.master_sheet import get_spreadsheet, get_all_games, update_game
from sheets.raw_reviews import get_or_create_raw_spreadsheet

GDRIVE_FOLDER_ID = os.environ.get("GDRIVE_FOLDER_ID", "")

# 수동으로 복구할 appid 목록 (환경변수 APPID 또는 아래 리스트로 지정)
_env_appid = os.environ.get("APPID", "").strip()
FIX_APPIDS = [_env_appid] if _env_appid else ["1962700"]  # Subnautica 2


def run():
    ss = get_spreadsheet()
    games = get_all_games(ss)
    game_map = {str(g.get("appid")): g for g in games}

    for appid in FIX_APPIDS:
        game = game_map.get(str(appid))
        if not game:
            print(f"[ERROR] appid {appid} 를 games 탭에서 찾을 수 없습니다.")
            continue

        game_sheet_id = str(game.get("game_sheet_id", "")).strip()
        name = game.get("name", appid)
        status = game.get("status", "")

        print(f"\n{'='*50}")
        print(f"복구 대상: {name} (AppID: {appid}, status: {status})")

        if game_sheet_id:
            print(f"[SKIP] game_sheet_id 이미 존재: {game_sheet_id}")
            continue

        if not GDRIVE_FOLDER_ID:
            print("[ERROR] GDRIVE_FOLDER_ID 환경변수가 설정되지 않았습니다.")
            continue

        print("게임 시트 생성 중...")
        try:
            raw_ss = get_or_create_raw_spreadsheet(GDRIVE_FOLDER_ID, appid, name)
            game_sheet_id = raw_ss.id
            update_game(ss, appid, {"game_sheet_id": game_sheet_id})
            print(f"[OK] game_sheet_id 저장 완료: {game_sheet_id}")
            print(f"     이제 collect 또는 reanalyze 워크플로우를 재실행하세요.")
        except Exception as e:
            print(f"[ERROR] 게임 시트 생성 실패: {e}")
            import traceback
            print(traceback.format_exc())


if __name__ == "__main__":
    run()
