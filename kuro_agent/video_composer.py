import os
import subprocess
import json

INTRO_DUR = 3.0
OUTRO_DUR = 3.0


def get_audio_duration(audio_path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", audio_path],
        capture_output=True, text=True, check=True,
    )
    data = json.loads(result.stdout)
    return float(data["streams"][0]["duration"])


def create_srt(script: str, voice_duration: float, entry_number: int, output_path: str) -> str:
    lines = []

    # 開場字幕
    lines.append((0.0, INTRO_DUR, f"觀察日誌，第 {entry_number} 號"))

    # 主體旁白字幕（時間從 INTRO_DUR 開始）
    sentences = [s.strip() for s in script.split("。") if s.strip()]
    if sentences:
        per = voice_duration / len(sentences)
        for i, sent in enumerate(sentences):
            start = INTRO_DUR + i * per
            end = min(start + per, INTRO_DUR + voice_duration)
            lines.append((start, end, sent + "。"))

    # 結尾字幕
    outro_start = INTRO_DUR + voice_duration
    lines.append((outro_start, outro_start + OUTRO_DUR, "無法理解。記錄完畢。"))

    with open(output_path, "w", encoding="utf-8") as f:
        for i, (start, end, text) in enumerate(lines):
            f.write(f"{i+1}\n{_ts(start)} --> {_ts(end)}\n{text}\n\n")

    return output_path


def _ts(s: float) -> str:
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    ms = int((s - int(s)) * 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"


def create_video(
    voice_path: str,
    script: str,
    entry_number: int = 1,
    kuro_image: str = "assets/kuro.png",
    kuro_premium: str = "assets/kuro_holographic.png",
    bg_music: str = "assets/bgm.mp3",
    output_path: str = "output/video.mp4",
) -> str:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    voice_duration = get_audio_duration(voice_path)
    total_duration = INTRO_DUR + voice_duration + OUTRO_DUR
    main_frames = int(voice_duration * 30)

    premium = kuro_premium if os.path.exists(kuro_premium) else kuro_image
    sub_path = output_path.replace(".mp4", ".srt")
    create_srt(script, voice_duration, entry_number, sub_path)

    has_bgm = os.path.exists(bg_music)
    if has_bgm:
        image_inputs = [
            "-loop", "1", "-i", premium,   # [0] intro
            "-loop", "1", "-i", kuro_image, # [1] main
            "-loop", "1", "-i", premium,   # [2] outro
            "-i", voice_path,               # [3] voice
            "-i", bg_music,                 # [4] bgm
        ]
        voice_idx, bgm_idx = 3, 4
    else:
        image_inputs = [
            "-loop", "1", "-i", premium,   # [0] intro
            "-loop", "1", "-i", kuro_image, # [1] main
            "-loop", "1", "-i", premium,   # [2] outro
            "-i", voice_path,               # [3] voice
        ]
        voice_idx = 3

    scale = (
        "scale=1080:1920:force_original_aspect_ratio=decrease,"
        "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black"
    )

    video_filter = (
        # 開場：精美圖 + 淡入
        f"[0:v]{scale},trim=0:{INTRO_DUR},setpts=PTS-STARTPTS,"
        f"fade=t=in:st=0:d=0.8[intro_v];"

        # 主體：一般圖 + 緩慢放大
        f"[1:v]{scale},trim=0:{voice_duration},setpts=PTS-STARTPTS,"
        f"zoompan=z='min(zoom+0.0002,1.03)':d={main_frames}:s=1080x1920[main_v];"

        # 結尾：精美圖 + 淡出
        f"[2:v]{scale},trim=0:{OUTRO_DUR},setpts=PTS-STARTPTS,"
        f"fade=t=out:st={OUTRO_DUR - 0.8}:d=0.8[outro_v];"

        # 合併影片片段
        "[intro_v][main_v][outro_v]concat=n=3:v=1:a=0[vcombined];"

        # 加字幕
        f"[vcombined]subtitles={sub_path}:force_style='"
        "FontName=Noto Sans CJK TC,"
        "FontSize=28,"
        "PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H00000000,"
        "Outline=2,"
        "Alignment=2,"
        "MarginV=80"
        "'[v]"
    )

    # 音訊：旁白延遲 INTRO_DUR 秒後才開始
    delay_ms = int(INTRO_DUR * 1000)
    if has_bgm:
        audio_filter = (
            f"[{voice_idx}:a]adelay={delay_ms}|{delay_ms}[dv];"
            f"[dv][{bgm_idx}:a]amix=inputs=2:duration=longest:weights=1 0.12[a]"
        )
    else:
        audio_filter = f"[{voice_idx}:a]adelay={delay_ms}|{delay_ms}[a]"

    filter_complex = f"{video_filter};{audio_filter}"

    cmd = [
        "ffmpeg", "-y",
        *image_inputs,
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-map", "[a]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-t", str(total_duration),
        "-r", "30",
        output_path,
    ]

    subprocess.run(cmd, check=True)
    return output_path
