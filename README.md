# Steam Pickaxe v2

추적 중인 Steam 게임의 리뷰·동접을 모아 평가와 접속 흐름의 변화를 보여 주는 개인 프로젝트입니다.

## 구성

| 폴더 | 내용 |
|---|---|
| `db/` | 데이터베이스 표 설계 (`schema.sql`, Supabase/PostgreSQL) |
| `backend/` | 수집·계산·AI 분석 (Python): `collect.py`, `collect_ccu.py`, `run_calc.py`, `analyze.py`, `add_game.py` |
| `web/` | 화면 (Next.js): 홈, 게임 상세, 관리자 현황판, 문구 관리 |
| `scripts/` | 올리기 전 개인정보 검사 (`privacy_check.py`) |
| `mockup/` | 화면 설계 시안 (참고용) |

## 환경 변수 (값은 `.env` 또는 Vercel/GitHub Secrets에만 둡니다. 저장소에는 올리지 않습니다)

`SUPABASE_DB_URL`, `GEMINI_API_KEY`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`
선택: `GITHUB_TOKEN`, `GITHUB_REPO` (관리자 화면의 "지금 실행" 버튼용)

관리자 비밀번호 해시 만들기: `cd web && npm run hash-password`

## 내 컴퓨터에서 실행

- 화면: `cd web && npm install && npm run dev` → http://localhost:3000
- 수집: `cd backend && pip install -r requirements.txt && python collect.py run`
- 분석: `python run_calc.py && python analyze.py run && python analyze.py brief`

## 올리기 전에

`python scripts/privacy_check.py` — 회사 정보, 내 컴퓨터 경로, 비밀 키가 파일에 섞이지 않았는지 검사합니다.
