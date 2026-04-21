"""
기존 게임의 전체 이력에 대해 급변 감지 + AI 분석을 소급 실행합니다.
(일회성 실행 — 이후에는 detect-shifts.yml 워크플로가 주간 단위로 실행)

실행 방법:
  python tools/backfill_shifts.py
  python tools/backfill_shifts.py --appid 1234567
  python tools/backfill_shifts.py --dry-run
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import argparse
os.environ.setdefault("DRY_RUN", "false")

# main_detect.run()을 그대로 재사용 (TARGET_APPID / DRY_RUN 환경변수로 제어)
import main_detect


def main():
    parser = argparse.ArgumentParser(description="급변 이벤트 소급 분석")
    parser.add_argument("--appid",   default="", help="특정 게임 AppID만 처리")
    parser.add_argument("--dry-run", action="store_true", help="저장 없이 미리보기")
    args = parser.parse_args()

    if args.appid:
        os.environ["TARGET_APPID"] = args.appid
    if args.dry_run:
        os.environ["DRY_RUN"] = "true"

    print("[BACKFILL] 전체 이력 소급 급변 감지 시작\n")
    main_detect.run()
    print("\n[BACKFILL] 완료")


if __name__ == "__main__":
    main()
