# GAS 웹앱 배포 가이드 (한국어)

## 왜 GAS가 필요한가?

서비스 계정(service account)은 Google이 0GB 저장 공간을 부여하므로,
Drive API로 파일을 생성하면 소유권이 서비스 계정에 귀속되어 403 오류가 발생합니다.
GAS는 **"나(김무길)로서 실행"**되므로, 내 Drive 계정 권한으로 파일을 생성하고
서비스 계정에 편집 권한만 부여합니다.

---

## 배포 단계 (1회만 수행)

### Step 1 — 새 Apps Script 프로젝트 열기

1. 브라우저에서 [https://script.google.com](https://script.google.com) 접속
2. 왼쪽 상단 **"새 프로젝트"** 클릭
3. 프로젝트 이름을 `steam-pickaxe-sheet-creator`로 변경 (선택사항)

### Step 2 — 코드 붙여넣기

1. 편집기 왼쪽 `Code.gs` 파일 클릭
2. 기존 내용 전체 삭제
3. `gas/create_raw_sheet.gs` 파일의 내용을 전부 복사해서 붙여넣기
4. **Ctrl+S** (저장)

### Step 3 — 웹앱으로 배포

1. 오른쪽 상단 **"배포"** 버튼 클릭 → **"새 배포"** 선택
2. 왼쪽 **"유형 선택"** 옆 ⚙️ 아이콘 클릭 → **"웹 앱"** 선택
3. 설정:
   - 설명: `RAW 시트 자동 생성 웹앱`
   - **다음 사용자로 실행: `나(내 이메일)`** ← 반드시 이걸로 선택
   - **액세스 권한: `모든 사용자`** ← 반드시 이걸로 선택
4. **"배포"** 클릭
5. Google 계정 권한 요청 팝업 → **"액세스 허용"** 클릭

### Step 4 — 웹앱 URL 복사

배포 완료 화면에서 **"웹 앱 URL"** 복사:
```
https://script.google.com/macros/s/AKfycb.../exec
```
이 URL이 `GAS_WEBAPP_URL`입니다.

### Step 5 — 환경변수 등록

**로컬 `.env` 파일에 추가:**
```
GAS_WEBAPP_URL=https://script.google.com/macros/s/AKfycb.../exec
```

**GitHub Secrets에 추가:**
- 저장소 → Settings → Secrets and variables → Actions
- **"New repository secret"** 클릭
- Name: `GAS_WEBAPP_URL`
- Secret: 복사한 웹앱 URL
- **"Add secret"** 클릭

### Step 6 — 동작 확인

브라우저에서 웹앱 URL에 직접 접속하면:
```json
{ "ok": true, "message": "GAS 웹앱 정상 동작 중" }
```
이 표시되면 정상입니다.

---

## 코드 수정 시 재배포 방법

스크립트 코드를 수정한 경우:
1. "배포" → "배포 관리" 클릭
2. 기존 배포 옆 ✏️ 클릭
3. "버전" → "새 버전" 선택
4. **"배포"** 클릭

> ⚠️ "새 배포"를 누르면 URL이 바뀝니다. 반드시 "배포 관리"에서 기존 배포를 업데이트하세요.

---

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| 403 Forbidden | 액세스 권한이 "나만" 으로 설정됨 | 배포 설정에서 "모든 사용자"로 변경 후 재배포 |
| {"ok":false,"error":"..."} | GAS 내부 오류 | Apps Script → 실행 로그 확인 |
| 파일이 생성되지 않음 | folderId 오류 | GDRIVE_FOLDER_ID가 올바른지 확인 |
| 서비스 계정이 편집 불가 | 권한 부여 실패 | GAS 로그에서 `_ensureEditorAccess` 오류 확인 |
