import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { config } from '../config';

const MAX_ATTEMPTS = 3;

/**
 * Synthesizes free neural voiceover audio (Microsoft Edge Read Aloud, no API key required).
 * This is an unofficial API and can reject requests from some cloud/datacenter IP ranges with
 * a 403 — retries a couple of times before giving up, since it is sometimes transient.
 */
export async function synthesizeSpeech(text: string, outDir: string): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(config.youtubeTtsVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioFilePath } = await tts.toFile(outDir, text);
      return audioFilePath;
    } catch (err) {
      lastError = err;
      console.error(`[tts] attempt ${attempt}/${MAX_ATTEMPTS} failed`, err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw new Error(
    `Edge TTS failed after ${MAX_ATTEMPTS} attempts. Some cloud hosts get blocked by this free, unofficial API — see README for details. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
