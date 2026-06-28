"""執行一次 YouTube 授權，儲存 token 供後續使用。
用法：
  步驟1：python auth_youtube.py
  步驟2：python auth_youtube.py <授權碼>
"""
import os
import sys
import json
import pickle
from google_auth_oauthlib.flow import Flow
from config import YOUTUBE_CLIENT_SECRETS

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]
TOKEN_FILE = "data/yt_token.pickle"
STATE_FILE = "data/auth_state.json"


def step1_get_url():
    flow = Flow.from_client_secrets_file(
        YOUTUBE_CLIENT_SECRETS,
        scopes=SCOPES,
        redirect_uri="urn:ietf:wg:oauth:2.0:oob",
    )
    auth_url, state = flow.authorization_url(
        prompt="consent",
        access_type="offline",
        include_granted_scopes="true",
    )

    os.makedirs("data", exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump({
            "state": state,
            "code_verifier": getattr(flow, "code_verifier", None),
        }, f)

    print("\n" + "="*60)
    print("用手機或電腦開啟以下網址，登入 Google 帳號：")
    print("="*60)
    print(f"\n{auth_url}\n")
    print("="*60)
    print("登入後複製授權碼，執行：")
    print("  python auth_youtube.py <貼上授權碼>")
    print("="*60)


def step2_exchange_code(code: str):
    with open(STATE_FILE) as f:
        saved = json.load(f)

    flow = Flow.from_client_secrets_file(
        YOUTUBE_CLIENT_SECRETS,
        scopes=SCOPES,
        redirect_uri="urn:ietf:wg:oauth:2.0:oob",
        state=saved["state"],
    )
    if saved.get("code_verifier"):
        flow.code_verifier = saved["code_verifier"]

    flow.fetch_token(code=code)
    creds = flow.credentials

    os.makedirs("data", exist_ok=True)
    with open(TOKEN_FILE, "wb") as f:
        pickle.dump(creds, f)

    os.remove(STATE_FILE)
    print(f"\n✅ 授權成功！Token 儲存在 {TOKEN_FILE}")
    print("之後 KURO agent 會自動使用這個 token 上傳影片。")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        step2_exchange_code(sys.argv[1])
    else:
        step1_get_url()
