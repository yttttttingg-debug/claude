import os
import pickle
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from config import YOUTUBE_CLIENT_SECRETS

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]
TOKEN_FILE = "data/yt_token.pickle"


def get_service():
    creds = None
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "rb") as f:
            creds = pickle.load(f)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            try:
                os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
                with open(TOKEN_FILE, "wb") as f:
                    pickle.dump(creds, f)
            except OSError:
                pass  # Cloud Run secret 掛載為唯讀，忽略
        else:
            raise RuntimeError(
                "YouTube token 不存在或已完全失效。\n"
                "請在本機執行：python auth_youtube.py\n"
                "然後更新 Cloud Run 的 youtube-token secret。"
            )

    return build("youtube", "v3", credentials=creds)


def upload_video(
    video_path: str,
    title: str,
    description: str,
    tags: list,
    privacy: str = "public",
) -> str:
    yt = get_service()

    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags + ["KURO", "AI貓", "觀察日誌"],
            "categoryId": "22",
            "defaultLanguage": "zh-TW",
            "defaultAudioLanguage": "zh-TW",
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(video_path, mimetype="video/mp4", resumable=True)
    req = yt.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    while response is None:
        _, response = req.next_chunk()

    video_id = response["id"]
    return f"https://www.youtube.com/watch?v={video_id}"
