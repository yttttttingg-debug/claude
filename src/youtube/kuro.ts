import path from 'node:path';
import fs from 'node:fs/promises';

const ASSETS_DIR = path.join(process.cwd(), 'assets', 'kuro');

export const EMOTION_MAP: Record<string, string> = {
  '怒': 'angry.png',
  '哀': 'sorrowful.png',
  '哭哭': 'crying.png',
  '泣喪': 'dejected.png',
  '喜': 'pleased.png',
  '樂': 'joyful.png',
  '淘氣': 'mischievous.png',
  '陰險': 'sinister.png',
  '想睡覺': 'sleepy.png',
  '肚子餓': 'hungry.png',
  '沒精神': 'listless.png',
  '詭詐': 'cunning.png',
  '正常': 'normal.png',
};

export const EMOTION_LIST = Object.keys(EMOTION_MAP).join('、');

export async function resolveKuroImage(emotion: string): Promise<string | undefined> {
  const filename = EMOTION_MAP[emotion];
  if (!filename) return undefined;
  const fullPath = path.join(ASSETS_DIR, filename);
  try {
    await fs.access(fullPath);
    return fullPath;
  } catch {
    return undefined;
  }
}
