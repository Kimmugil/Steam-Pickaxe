"""
환경 변수를 로딩하는 모듈.
로컬: .env 파일에서 읽음
Streamlit Cloud: st.secrets에서 읽음
"""
import os
import json
import streamlit as st


def get_env(key: str, default: str = "") -> str:
    """st.secrets → os.environ 순서로 환경변수를 가져옵니다."""
    try:
        return st.secrets[key]
    except Exception:
        return os.environ.get(key, default)


def get_google_credentials() -> dict:
    """Google 서비스 계정 JSON을 dict로 반환합니다."""
    raw = get_env("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not raw:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON 환경변수가 설정되지 않았습니다.")
    if isinstance(raw, dict):
        return raw
    return json.loads(raw)


GDRIVE_FOLDER_ID: str = get_env("GDRIVE_FOLDER_ID")
GEMINI_API_KEY: str   = get_env("GEMINI_API_KEY")
STEAM_API_KEY: str    = get_env("STEAM_API_KEY")
