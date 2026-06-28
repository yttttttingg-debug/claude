import os
from elevenlabs import ElevenLabs, VoiceSettings
from config import ELEVENLABS_API_KEY, KURO_VOICE_ID

client = ElevenLabs(api_key=ELEVENLABS_API_KEY)


def generate_voice(script: str, output_path: str = "output/voice.mp3") -> str:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    audio_iter = client.generate(
        text=script,
        voice=KURO_VOICE_ID,
        voice_settings=VoiceSettings(
            stability=0.65,
            similarity_boost=0.80,
            style=0.25,
            use_speaker_boost=True,
        ),
        model="eleven_multilingual_v2",
    )

    with open(output_path, "wb") as f:
        for chunk in audio_iter:
            f.write(chunk)

    return output_path
