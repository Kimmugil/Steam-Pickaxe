/**
 * create_raw_sheet.gs — Google Apps Script 웹앱
 *
 * 역할:
 *   Python 백엔드(서비스 계정)는 Drive 저장 공간이 0GB라 파일을 직접 생성할 수 없습니다.
 *   이 스크립트는 "나(김무길)로서 실행"되므로, 내 Drive 계정 권한으로
 *   지정된 폴더에 스프레드시트를 생성하고 서비스 계정에 편집 권한을 부여합니다.
 *
 * 배포 방법 (아래 한국어 가이드 참조):
 *   실행 대상: 나(Me) / 액세스 권한: 모든 사용자(Anyone)
 *
 * 요청 형식 (POST JSON):
 *   {
 *     "folderId": "구글드라이브_폴더_ID",
 *     "fileName": "RAW_REVIEWS_12345_GameName",
 *     "serviceAccountEmail": "steam-pickaxe@steam-pickaxe.iam.gserviceaccount.com"
 *   }
 *
 * 응답 형식:
 *   성공: { "ok": true, "spreadsheetId": "..." }
 *   실패: { "ok": false, "error": "오류 메시지" }
 */

function doPost(e) {
  // 모든 응답은 JSON으로 반환
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    // ── 1. 요청 파싱 ──────────────────────────────────────────────────────
    if (!e || !e.postData || !e.postData.contents) {
      output.setContent(JSON.stringify({ ok: false, error: "요청 본문이 없습니다." }));
      return output;
    }

    var payload = JSON.parse(e.postData.contents);
    var folderId           = payload.folderId;
    var fileName           = payload.fileName;
    var serviceAccountEmail = payload.serviceAccountEmail;

    if (!folderId || !fileName || !serviceAccountEmail) {
      output.setContent(JSON.stringify({
        ok: false,
        error: "folderId, fileName, serviceAccountEmail 필드가 모두 필요합니다."
      }));
      return output;
    }

    // ── 2. 이미 존재하는 파일인지 확인 (appid 기준 검색) ─────────────────
    // fileName 형식: "RAW_REVIEWS_{appid}_{name}"
    // appid는 "_" 기준 두 번째 토큰
    var parts = fileName.split("_");
    var appid = parts.length >= 3 ? parts[2] : fileName;
    // DriveApp.searchFiles()는 'folderId' in parents 문법 미지원 →
    // folder.searchFiles()로 폴더 내에서 직접 검색
    var folder = DriveApp.getFolderById(folderId);
    var searchQuery = "name contains 'RAW_REVIEWS_" + appid + "'"
                    + " and trashed=false"
                    + " and mimeType='application/vnd.google-apps.spreadsheet'";

    var existingFiles = folder.searchFiles(searchQuery);
    if (existingFiles.hasNext()) {
      // 이미 존재하면 기존 파일 재사용 (멱등성 보장)
      var existingFile = existingFiles.next();
      var existingId = existingFile.getId();

      // 서비스 계정 권한이 없을 수 있으므로 재확인 후 부여
      _ensureEditorAccess(existingFile, serviceAccountEmail);

      output.setContent(JSON.stringify({
        ok: true,
        spreadsheetId: existingId,
        reused: true
      }));
      return output;
    }

    // ── 3. 지정된 폴더에 스프레드시트 신규 생성 (내 계정으로 실행) ────────
    // folder는 위 2단계에서 이미 가져옴
    var newSS  = SpreadsheetApp.create(fileName);          // 내 Drive에 생성
    var file   = DriveApp.getFileById(newSS.getId());

    // 생성된 파일을 지정 폴더로 이동 (내 계정이 소유자이므로 이동 가능)
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);             // 루트에서 제거

    // ── 4. 서비스 계정에 편집 권한 부여 ──────────────────────────────────
    _ensureEditorAccess(file, serviceAccountEmail);

    output.setContent(JSON.stringify({
      ok: true,
      spreadsheetId: newSS.getId(),
      reused: false
    }));
    return output;

  } catch (err) {
    output.setContent(JSON.stringify({
      ok: false,
      error: err.toString()
    }));
    return output;
  }
}

/**
 * 서비스 계정에 편집 권한이 없으면 부여합니다.
 * 이미 있으면 무시 (중복 공유 방지).
 */
function _ensureEditorAccess(file, email) {
  try {
    var editors = file.getEditors();
    for (var i = 0; i < editors.length; i++) {
      if (editors[i].getEmail() === email) return; // 이미 편집자
    }
    file.addEditor(email);
  } catch (e) {
    // 권한 부여 실패 시 로그만 남기고 계속 진행
    Logger.log("권한 부여 실패 (" + email + "): " + e.toString());
  }
}

/**
 * GET 요청 헬스체크 — 브라우저에서 웹앱 URL에 접속해 동작 확인용
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: "GAS 웹앱 정상 동작 중" }))
    .setMimeType(ContentService.MimeType.JSON);
}
