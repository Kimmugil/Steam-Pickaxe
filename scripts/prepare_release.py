"""
기존 GitHub 저장소(Kimmugil/Steam-Pickaxe)에 올릴 'v2 가지'를 내 컴퓨터에서 미리 만들어 둡니다.
  python scripts/prepare_release.py

하는 일: 저장소를 임시 폴더에 새로 받고 → v2 가지를 만들고 → 예전 파일을 치우고 새 파일을 넣고
        → 개인정보 검사 → 커밋(작성자는 GitHub noreply 주소). 올리기(push)는 하지 않습니다.
올리기는 마지막에 알려 주는 명령을 직접 실행하세요. (main 가지는 건드리지 않아 기존 사이트는 그대로입니다)
"""
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, ".."))
REPO = "https://github.com/Kimmugil/Steam-Pickaxe.git"
BRANCH = "v2"
OUT = os.path.join(tempfile.gettempdir(), "steam_pickaxe_release")
AUTHOR = ("Kimmugil", "253725816+Kimmugil@users.noreply.github.com")   # GitHub noreply 주소 (회사 이메일 아님)
SKIP = shutil.ignore_patterns("node_modules", ".next", "__pycache__", "*.pyc", ".env", ".env.*", "data", "*.xlsx", ".git", ".privacy_terms")


def force_remove(path):
    """윈도우에서 읽기 전용(.git 안 파일)도 지웁니다."""
    def onerror(func, p, _exc):
        os.chmod(p, 0o700)
        func(p)
    shutil.rmtree(path, onerror=onerror)


def run(*cmd, cwd=OUT, check=True):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8")
    if check and r.returncode != 0:
        sys.exit(f"명령 실패: {' '.join(cmd)}\n{r.stdout}\n{r.stderr}")
    return r.stdout.strip()


def main():
    if os.path.exists(OUT):
        force_remove(OUT)
    run("git", "clone", "--quiet", REPO, OUT, cwd=tempfile.gettempdir())
    if run("git", "ls-remote", "--heads", "origin", BRANCH):             # 이미 올라간 v2 가 있으면 그 위에 이어서
        run("git", "fetch", "-q", "origin", BRANCH)
        run("git", "checkout", "-q", "-B", BRANCH, f"origin/{BRANCH}")
    else:
        run("git", "checkout", "-q", "-b", BRANCH)
    run("git", "config", "user.name", AUTHOR[0])
    run("git", "config", "user.email", AUTHOR[1])
    run("git", "rm", "-r", "-q", "--ignore-unmatch", ".")                  # 예전 파일 전부 제거 (기록은 남음)
    for name in os.listdir(OUT):
        if name != ".git":
            p = os.path.join(OUT, name)
            force_remove(p) if os.path.isdir(p) else os.remove(p)

    # 새 파일 넣기. 화면 폴더는 기존 Vercel 설정(Root Directory = frontend)이 그대로 맞도록 frontend 로 둡니다.
    copies = [("backend", "backend"), ("db", "db"), ("scripts", "scripts"), ("docs", "docs"), (".github", ".github"), ("web", "frontend")]
    for src, dst in copies:
        if os.path.isdir(os.path.join(SRC, src)):
            shutil.copytree(os.path.join(SRC, src), os.path.join(OUT, dst), ignore=SKIP)
    for f in ("README.md", ".gitignore"):
        shutil.copy2(os.path.join(SRC, f), os.path.join(OUT, f))

    check = subprocess.run([sys.executable, "-X", "utf8", os.path.join(SRC, "scripts", "privacy_check.py"), "--root", OUT], capture_output=True, text=True, encoding="utf-8")
    print(check.stdout.strip())
    if check.returncode != 0:
        sys.exit("개인정보 검사에 걸려서 커밋하지 않았습니다. 위 항목을 고친 뒤 다시 실행하세요.")

    run("git", "add", "-A")
    msg = (os.environ.get("RELEASE_MESSAGE") or "Steam Pickaxe v2 갱신") + "\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
    if not run("git", "status", "--porcelain"):
        sys.exit("올릴 변경이 없습니다. (이미 최신 상태)")
    run("git", "commit", "-q", "-m", msg)
    print("\n커밋 작성자:", run("git", "log", "-1", "--format=%an <%ae>"))
    print(run("git", "show", "--stat", "--format=", "HEAD").splitlines()[-1])
    print(f"\n준비 폴더: {OUT}\n올릴 때 (터미널에서 직접 실행):\n  git -C \"{OUT}\" push -u origin {BRANCH}")


if __name__ == "__main__":
    main()
