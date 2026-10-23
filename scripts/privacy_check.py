"""
GitHub에 올리기 전 개인정보·비밀 값 검사 (공개 리포 기준으로 엄격하게)

  python scripts/privacy_check.py            # 이 프로젝트 폴더 전체 검사
  python scripts/privacy_check.py --staged   # git에 올릴 준비가 된(스테이징된) 파일만 검사
  python scripts/privacy_check.py --root 폴더 # 다른 폴더를 검사

찾는 것: 이메일 주소, 내 컴퓨터의 폴더 경로, 비밀 키·접속 주소·토큰, .env 파일,
        그리고 scripts/.privacy_terms 에 적어 둔 단어(회사 이름·계정·실명 등. 이 파일은 저장소에 올리지 않습니다)
하나라도 걸리면 종료 코드 1로 끝나고, 어느 파일 몇 번째 줄인지 알려 줍니다. (값 전체는 가려서 보여 줍니다)
"""
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if "--root" in sys.argv:                       # 다른 폴더(예: 올릴 사본)를 검사할 때
    ROOT = os.path.abspath(sys.argv[sys.argv.index("--root") + 1])
SKIP_DIRS = {".git", "node_modules", ".next", "__pycache__", "data", ".venv", "out"}
SKIP_FILES = {"privacy_check.py", ".privacy_terms"}   # 검사기 자신과 단어 목록 파일은 제외
BINARY_EXT = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".xlsx", ".zip", ".pdf", ".woff", ".woff2"}

PATTERNS = [
    ("내 컴퓨터 경로", re.compile(r"C:\\\\?Users|/Users/[A-Za-z]|OneDrive", re.I)),
    ("이메일 주소", re.compile(r"[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com|anthropic\.com)[A-Za-z0-9-]+\.[A-Za-z]{2,}")),
    ("Gemini 키", re.compile(r"AIza[0-9A-Za-z_\-]{20,}")),
    ("Supabase 키", re.compile(r"sb_(secret|publishable)_[0-9A-Za-z_\-]{10,}")),
    ("DB 접속 주소(비밀번호 포함)", re.compile(r"postgres(ql)?://[^\s:@]+:[^\s@]+@")),
    ("GitHub 토큰", re.compile(r"gh[pousr]_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_]{20,}")),
    ("JWT·서비스 키", re.compile(r"eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}\.")),
    ("개인 키", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("관리자 비밀번호 해시", re.compile(r"scrypt[$:][0-9a-f]{16,}[$:][0-9a-f]{32,}")),
]


def load_private_terms():
    """회사 이름·계정·실명처럼 코드에 적을 수 없는 단어는 이 컴퓨터에만 있는 파일(scripts/.privacy_terms, 저장소에 안 올라감)에서 읽습니다."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".privacy_terms")
    try:
        words = [l.strip() for l in open(path, encoding="utf-8") if l.strip() and not l.startswith("#")]
    except OSError:
        print("[주의] scripts/.privacy_terms 파일이 없어 회사 이름·계정·실명 검사를 건너뜁니다. (올리기 전에 꼭 만들어 두세요)")
        return []
    return [("내 개인·회사 정보 단어", re.compile("|".join(re.escape(w) for w in words), re.I))] if words else []


def files_to_scan(staged: bool):
    if staged:
        out = subprocess.run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"], cwd=ROOT, capture_output=True, text=True)
        for rel in out.stdout.split():
            yield os.path.join(ROOT, rel)
        return
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            yield os.path.join(base, f)


def mask(s: str) -> str:
    return s[:4] + "…" + s[-2:] if len(s) > 8 else "…"


def ignored_by_gitignore(name: str) -> bool:
    try:
        lines = [l.strip() for l in open(os.path.join(ROOT, ".gitignore"), encoding="utf-8")]
    except OSError:
        return False
    return name in lines or name + "*" in lines or ".env*" in lines


def main() -> int:
    staged = "--staged" in sys.argv
    hits = []
    patterns = PATTERNS + load_private_terms()
    for path in files_to_scan(staged):
        rel = os.path.relpath(path, ROOT)
        name = os.path.basename(path)
        if name in SKIP_FILES or os.path.splitext(name)[1].lower() in BINARY_EXT:
            continue
        if name == ".env" or (name.startswith(".env.") and name != ".env.example"):
            if not staged and ignored_by_gitignore(".env"):
                continue                     # 폴더에는 있지만 .gitignore 로 막혀 있어 올라가지 않음
            hits.append((rel, 0, ".env 파일", "올라가면 안 되는 비밀 설정 파일입니다 (.gitignore에 있어야 함)"))
            continue
        try:
            with open(path, encoding="utf-8", errors="strict") as fh:
                for i, line in enumerate(fh, 1):
                    for label, rx in patterns:
                        m = rx.search(line)
                        if m:
                            hits.append((rel, i, label, mask(m.group(0))))
        except (UnicodeDecodeError, OSError):
            continue
    if not hits:
        print("개인정보 검사 통과: 걸리는 항목이 없습니다.")
        return 0
    print(f"개인정보·비밀 값 의심 {len(hits)}건 — 올리기 전에 반드시 고쳐 주세요:")
    for rel, line, label, sample in hits[:60]:
        print(f"  {rel}:{line}  [{label}] {sample}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
