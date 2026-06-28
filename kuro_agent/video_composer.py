import os
import subprocess
import json


def get_audio_duration(audio_path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", audio_path],
        capture_output=True, text=True, check=True
    )
    data = json.loads(result.stdout)
    return float(data["streams"][0]["duration"])


def create_srt(script: str, duration: float, output_path: str = "output/sub.srt") -> str:
    sentences = [s.strip() + "。" for s in script.split("。") if s.strip()]
    per = duration / len(sentences)

    with open(output_path, "w", encoding="utf-8") as f:
        for i, line in enumerate(sentences):
            start = i * per
            end = min(start + per, duration)
            f.write(f"{i+1}\n{_ts(start)} --> {_ts(end)}\n{line}\n\n")

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
    kuro_image: str = "assets/kuro.png",
    bg_music: str = "assets/bgm.mp3",
    output_path: str = "output/video.mp4",
) -> str:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    duration = get_audio_duration(voice_path)
    sub_path = create_srt(script, duration)

    has_bgm = os.path.exists(bg_music)

    if has_bgm:
        audio_filter = "[1:a][2:a]amix=inputs=2:duration=first:weights=1 0.12[a]"
        audio_inputs = ["-i", voice_path, "-i", bg_music]
        audio_map = ["-map", "[a]"]
    else:
        audio_filter = ""
        audio_inputs = ["-i", voice_path]
        audio_map = ["-map", "1:a"]

    video_filter = (
        "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,"
        "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,"
        f"zoompan=z='min(zoom+0.0003,1.05)':d={int(duration*30)}:s=1080x1920[vz];"
        f"[vz]subtitles={sub_path}:force_style='"
        "FontName=Noto Sans CJK TC,"
        "FontSize=28,"
        "PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H00000000,"
        "Outline=2,"
        "Alignment=2,"
        "MarginV=80"
        "'[v]"
    )

    filter_complex = f"{audio_filter};{video_filter}" if audio_filter else video_filter
    filter_complex = filter_complex.lstrip(";")

    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", kuro_image,
        *audio_inputs,
        "-filter_complex", filter_complex,
        "-map", "[v]",
        *audio_map,
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-t", str(duration),
        "-r", "30",
        output_path,
    ]

    subprocess.run(cmd, check=True)
    return output_path
