"""
환경 변수 / Secrets 로딩 모듈
─────────────────────────────────────────────────────
우선순위:
  1. st.secrets (Streamlit Cloud 배포 환경)
  2. os.environ  (.env 파일 또는 GitHub Actions Secrets)

Google 서비스 계정은 두 가지 포맷을 지원합니다.
  A) TOML 테이블 방식 (권장):
       [GOOGLE_SERVICE_ACCOUNT]
       type = "service_account"
       ...
  B) JSON 문자열 방식:
       GOOGLE_SERVICE_ACCOUNT_JSON = '{"type":"service_account",...}'
"""

import os
import json

# Streamlit이 없는 환경(GitHub Actions 등)에서도 import 가능하도록 처리
try:
    import streamlit as st
    _ST_AVAILABLE = True
except ImportError:
    _ST_AVAILABLE = False


def get_env(key: str, default: str = "") -> str:
    """st.secrets → os.environ 순서로 값을 가져옵니다."""
    if _ST_AVAILABLE:
        try:
            return st.secrets[key]
        except Exception:
            pass
    return os.environ.get(key, default)


def get_google_credentials() -> dict:
    """
    Google 서비스 계정 자격증명을 dict로 반환합니다.

    Streamlit secrets TOML 테이블 방식 우선,
    없으면 JSON 문자열 환경변수(GOOGLE_SERVICE_ACCOUNT_JSON) 사용.
    """
    # ── 방식 A: TOML 테이블 [GOOGLE_SERVICE_ACCOUNT] ──
    if _ST_AVAILABLE:
        try:
            creds = st.secrets["GOOGLE_SERVICE_ACCOUNT"]
            return dict(creds)
        except Exception:
            pass

    # ── 방식 B: JSON 문자열 환경변수 ──
    raw = get_env("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not raw:
        raise ValueError(
            "Google 서비스 계정 설정을 찾을 수 없습니다.\n"
            "Streamlit Secrets에 [GOOGLE_SERVICE_ACCOUNT] 섹션을 추가하거나,\n"
            "GOOGLE_SERVICE_ACCOUNT_JSON 환경변수를 설정해 주세요."
        )
    if isinstance(raw, dict):
        return raw
    return json.loads(raw)


def is_sheets_configured() -> bool:
    """Google Sheets 연결에 필요한 설정이 있는지 확인합니다."""
    try:
        get_google_credentials()
        folder = get_env("GDRIVE_FOLDER_ID")
        return bool(folder)
    except Exception:
        return False


# ── 자주 쓰는 설정값 ──
GDRIVE_FOLDER_ID: str = get_env("GDRIVE_FOLDER_ID")
GEMINI_API_KEY: str   = get_env("GEMINI_API_KEY")
STEAM_API_KEY: str    = get_env("STEAM_API_KEY")
