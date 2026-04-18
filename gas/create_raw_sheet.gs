/**
 * create_raw_sheet.gs — Google Apps Script 웹앱
 *
 * 역할:
 *   Python 백엔드(서비스 계정)는 Drive 저장 공간이 0GB라 파일을 직접 생성할 수 없습니다.
 *   이 스크립트는 "나(김무길)로서 실행"되므로, 내 Drive 계정 권한으로
 *   지정된 폴더에 스프레드시트를 생성하고 서비스 계정에 편집 권한을 부여합니다.
 *
 * [v3 변경사항]
 *   searchFiles(q) 완전 제거 — 게임 제목 특수문자(따옴표, 괄호 등)로 인한
 *   "Invalid argument: q" 오류 원천 차단.
 *   대신 folder.getFiles()로 전체 순회 후 getName() 정확 매칭.
 *
 * 배포 방법:
 *   실행 대상: 나(Me) / 액세스 권한: 모든 사용자(Anyone)
 */

function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    // ── 1. 요청 파싱 ──────────────────────────────────────────────────────
    if (!e || !e.postData || !e.postData.contents) {
      output.setContent(JSON.stringify({ ok: false, error: "요청 본문이 없습니다." }));
      return output;
    }

    var payload = JSON.parse(e.postData.contents);
    var folderId            = payload.folderId;
    var fileName            = payload.fileName;
    var serviceAccountEmail = payload.serviceAccountEmail;

    if (!folderId || !fileName || !serviceAccountEmail) {
      output.setContent(JSON.stringify({
        ok: false,
        error: "folderId, fileName, serviceAccountEmail 필드가 모두 필요합니다."
      }));
      return output;
    }

    // ── 2. 폴더 내 파일 순회 — searchFiles(q) 미사용 ─────────────────────
    // 특수문자 게임명에서 "Invalid argument: q" 오류 원천 차단
    var folder = DriveApp.getFolderById(folderId);
    var files  = folder.getFiles();
    var existingId = "";

    while (files.hasNext()) {
      var file = files.next();
      if (file.getName() === fileName && !file.isTrashed()) {
        existingId = file.getId();
        _ensureEditorAccess(file, serviceAccountEmail);
        break;
      }
    }

    if (existingId) {
      output.setContent(JSON.stringify({ ok: true, spreadsheetId: existingId, reused: true }));
      return output;
    }

    // ── 3. 신규 스프레드시트 생성 후 폴더로 이동 ─────────────────────────
    var newSS   = SpreadsheetApp.create(fileName);
    var newFile = DriveApp.getFileById(newSS.getId());
    newFile.moveTo(folder);  // 루트 → 지정 폴더로 이동
    _ensureEditorAccess(newFile, serviceAccountEmail);

    output.setContent(JSON.stringify({ ok: true, spreadsheetId: newSS.getId(), reused: false }));
    return output;

  } catch (err) {
    output.setContent(JSON.stringify({ ok: false, error: err.toString() }));
    return output;
  }
}

function _ensureEditorAccess(file, email) {
  try {
    var editors = file.getEditors();
    for (var i = 0; i < editors.length; i++) {
      if (editors[i].getEmail() === email) return;
    }
    file.addEditor(email);
  } catch (e) {
    Logger.log("권한 부여 실패 (" + email + "): " + e.toString());
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: "GAS 웹앱 정상 동작 중 (v3)" }))
    .setMimeType(ContentService.MimeType.JSON);
}
