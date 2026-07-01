import os
from elevenlabs import ElevenLabs
from config import ELEVENLABS_API_KEY, KURO_VOICE_ID

client = ElevenLabs(api_key=ELEVENLABS_API_KEY)


def generate_voice(script: str, output_path: str = "output/voice.mp3") -> str:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    audio_iter = client.text_to_speech.convert(
        text=script,
        voice_id=KURO_VOICE_ID,
        model_id="eleven_multilingual_v2",
        voice_settings={
            "stability": 0.65,
            "similarity_boost": 0.80,
            "style": 0.25,
            "use_speaker_boost": True,
        },
    )

    with open(output_path, "wb") as f:
        for chunk in audio_iter:
            f.write(chunk)

    return output_path
