import argparse
import logging
import os

from script_gen import generate_script
from voice_gen import generate_voice
from video_composer import create_video
from youtube_upload import upload_video

logging.basicConfig(level=logging.INFO, format="%(asctime)s [KURO] %(message)s")
log = logging.getLogger()


def get_entry_number() -> int:
    path = "data/entry_count.txt"
    try:
        with open(path) as f:
            return int(f.read().strip())
    except Exception:
        return 1


def save_entry_number(n: int):
    os.makedirs("data", exist_ok=True)
    with open("data/entry_count.txt", "w") as f:
        f.write(str(n))


def run(topic: str = None, entry: int = None, dry_run: bool = False):
    entry_num = entry or get_entry_number()

    log.info(f"📝 生成觀察日誌 #{entry_num}...")
    content = generate_script(topic=topic, entry_number=entry_num)
    log.info(f"標題：{content['title']}")
    log.info(f"腳本：\n{content['script']}\n")

    log.info("🎙️ 生成 KURO 聲音...")
    voice_path = generate_voice(content["script"], f"output/voice_{entry_num}.mp3")

    log.info("🎬 合成影片...")
    video_path = create_video(
        voice_path=voice_path,
        script=content["script"],
        output_path=f"output/kuro_{entry_num}.mp4",
    )

    if dry_run:
        log.info(f"✅ 測試完成！影片：{video_path}")
        return video_path

    log.info("📤 上傳 YouTube...")
    url = upload_video(
        video_path=video_path,
        title=content["title"],
        description=content["description"],
        tags=content["tags"],
    )

    save_entry_number(entry_num + 1)
    log.info(f"✅ 完成！{url}")
    return url


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KURO YouTube Agent")
    parser.add_argument("--topic", type=str, default=None, help="指定觀察主題")
    parser.add_argument("--entry", type=int, default=None, help="指定日誌編號")
    parser.add_argument("--dry-run", action="store_true", help="只生成影片，不上傳")
    args = parser.parse_args()

    run(topic=args.topic, entry=args.entry, dry_run=args.dry_run)
