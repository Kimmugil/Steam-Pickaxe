# 배포 안내 (Vercel + GitHub)

기존 저장소(Kimmugil/Steam-Pickaxe)와 기존 Vercel 프로젝트를 그대로 쓰되, 새 코드는 `v2` 가지에 먼저 올려
Vercel의 "미리보기 주소"로 확인한 뒤 `main`에 합칩니다. 합치기 전에는 기존 사이트가 그대로입니다.

## 1. 올리기 (내 컴퓨터에서)

1. `python scripts/prepare_release.py` — v2 가지를 만들고 개인정보 검사까지 합니다. 올리지는 않습니다.
2. 끝에 알려 주는 `git ... push -u origin v2` 명령을 터미널에서 직접 실행합니다.

## 2. Vercel 환경변수 (프로젝트 → Settings → Environment Variables)

적용 대상은 **Production과 Preview 둘 다** 체크하세요. (미리보기에서 보려면 Preview가 필요합니다)

| 이름 | 값 | 비고 |
|---|---|---|
| `SUPABASE_DB_URL` | Supabase 접속 주소(Session pooler) | `.env`와 같은 값 |
| `ADMIN_PASSWORD_HASH` | `npm run hash-password`로 만든 값 | `scrypt:` 로 시작 |
| `SESSION_SECRET` | 같은 명령이 만든 긴 문자열 | |
| `GH_PAT` | (기존 값 그대로) | 관리자 "지금 실행" 버튼용, 없어도 사이트는 동작 |

옛 구글 시트 관련 변수(`GOOGLE_SERVICE_ACCOUNT_JSON`, `MASTER_SPREADSHEET_ID` 등)는 확인이 끝난 뒤 지워도 됩니다.
Vercel → Settings → General → **Root Directory** 가 `frontend` 인지 확인하세요. (새 화면 폴더 이름이 같습니다)

## 3. GitHub Secrets (저장소 → Settings → Secrets and variables → Actions)

| 이름 | 값 |
|---|---|
| `SUPABASE_DB_URL` | 위와 같은 접속 주소 |
| `GEMINI_API_KEY` | (기존 값이 있으면 그대로) |
| `ALERT_WEBHOOK_URL` | (선택) 디스코드 웹훅 주소. 넣으면 실패할 때 알려 줍니다 |

## 4. 확인 후 `main`에 합치기

1. Vercel의 v2 미리보기 주소에서 화면을 확인합니다.
2. 괜찮으면 GitHub에서 `v2` → `main` Pull Request를 만들어 합칩니다.
3. 합치면 GitHub Actions의 예약 실행(수집·동접·분석)이 켜지고, 옛 워크플로 11개와 옛 코드는 사라집니다.
   (예약 실행은 기본 가지인 `main`에 있어야만 돕니다)
4. Actions 탭에서 "리뷰 수집", "분석"을 한 번씩 수동 실행해서 정상인지 봅니다.
5. 옛 Secrets(`GOOGLE_SERVICE_ACCOUNT_JSON`, `MASTER_SPREADSHEET_ID`, `GDRIVE_FOLDER_ID`, `GAS_WEBAPP_URL` 등)을 지웁니다.

## 5. 자동 실행이 도는 방식

| 작업 | 시각 (한국) | 하는 일 |
|---|---|---|
| 리뷰 수집 | 매일 05:00 | 새 리뷰 점검 → 때가 된 게임만 수집, 과거 리뷰·플레이타임 보충(끊기면 다음 날 이어받기) |
| 동접 수집 | 매시 5분 | 현재 접속자 수 기록 |
| 분석 | 매일 06:30 | 지표 계산 → 급변·업데이트 영향 감지 → 빠진 AI 분석만 처리 → 브리핑 |
| 자동 실행 유지 | 매월 1일 | GitHub의 "60일 무활동 시 예약 실행 중지"를 피하기 위한 기록 |

멈췄을 때: 관리자 현황판의 "자동 작업이 오래 멈춰 있습니다"가 먼저 알려 줍니다. 원인은 저장소의 Actions 탭에서 확인합니다.
