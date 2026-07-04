import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { config } from '../config';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/text-to-speech';

async function synthesizeWithElevenLabs(
  text: string,
  outDir: string,
  apiKey: string,
  voiceId: string,
): Promise<string> {
  const res = await fetch(`${ELEVENLABS_API}/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs TTS HTTP ${res.status}: ${detail}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(outDir, `el-${crypto.randomBytes(6).toString('hex')}.mp3`);
  await fs.writeFile(outPath, buf);
  return outPath;
}

async function synthesizeWithEdgeTTS(text: string, outDir: string): Promise<string> {
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(config.youtubeTtsVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioFilePath } = await tts.toFile(outDir, text);
      return audioFilePath;
    } catch (err) {
      lastError = err;
      console.error(`[tts] Edge TTS attempt ${attempt}/${MAX_ATTEMPTS} failed`, err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw new Error(
    `Edge TTS failed after ${MAX_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

/**
 * Synthesizes voiceover audio.
 * Uses ElevenLabs when ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID are configured,
 * otherwise falls back to Microsoft Edge TTS (unofficial, free).
 */
export async function synthesizeSpeech(text: string, outDir: string): Promise<string> {
  const { elevenLabsApiKey, elevenLabsVoiceId } = config;

  if (elevenLabsApiKey && elevenLabsVoiceId) {
    console.log('[tts] Using ElevenLabs');
    return synthesizeWithElevenLabs(text, outDir, elevenLabsApiKey, elevenLabsVoiceId);
  }

  console.log('[tts] Using Edge TTS (fallback)');
  return synthesizeWithEdgeTTS(text, outDir);
}
