import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { generateImage } from '../ai';

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

// English descriptions for known emotions; used as generation hints
const EMOTION_DESCRIPTIONS: Record<string, string> = {
  '怒': 'furious angry expression, lightning bolt eyebrows, steam rising from head, clenched paws',
  '哀': 'sorrowful sad expression, droopy downcast eyes, single teardrop',
  '哭哭': 'crying dramatically, face scrunched, streaming tears, sobbing open mouth',
  '泣喪': 'completely dejected, slumped posture, hollow empty eyes, wilted defeated mood',
  '喜': 'pleased self-satisfied, small smug smirk, half-lidded content eyes',
  '樂': 'joyful big wide grin, eyes crinkled happily, paw raised in excitement',
  '淘氣': 'mischievous playful grin, one eye half-closed winking, raised paw ready for trouble',
  '陰險': 'sinister scheming, narrow slit eyes, slow evil smirk, paw stroking chin',
  '想睡覺': 'extremely sleepy, eyes nearly shut drooping, big yawn, ZZZ floating above',
  '肚子餓': 'hungry, wide pleading eyes, drooling at corner of mouth, paws pressed on belly',
  '沒精神': 'listless completely blank stare, spiral dead eyes, slumped, zero energy',
  '詭詐': 'cunning calculating, one eyebrow raised, slow spreading sly grin, sideways glance',
  '正常': 'neutral default resting grumpy expression, half-lidded bored eyes, sitting calmly',
};

// In-memory cache for dynamically-generated emotion filenames
const dynamicCache = new Map<string, string>();

export const EMOTION_LIST = Object.keys(EMOTION_MAP).join('、');

function sanitizeFilename(emotion: string): string {
  // Convert to lowercase hex to avoid filesystem issues with arbitrary Unicode
  return (
    'auto-' +
    Buffer.from(emotion, 'utf8')
      .toString('hex')
      .slice(0, 16) +
    '.png'
  );
}

async function generateKuroExpression(emotion: string, outPath: string): Promise<void> {
  const referenceImage = path.join(ASSETS_DIR, 'normal.png');
  let refPath: string | undefined;
  try {
    await fs.access(referenceImage);
    refPath = referenceImage;
  } catch {
    refPath = undefined;
  }

  const knownDesc = EMOTION_DESCRIPTIONS[emotion];
  const expressionDesc = knownDesc ?? `${emotion} expression, matching the mood`;

  const prompt = `You are generating a new expression sprite for Kuro, a cartoon character.
${refPath ? 'The reference image shows the character design — keep it identical (same black cat, same teal headphones, same golden bell collar, same art style).' : 'Character: chubby grumpy black cat, teal headphones, golden bell collar, cream-white triangle eyebrow marks.'}
Art style: flat minimalist cartoon, bold clean ink outlines, white background, square format 512×512.
Only change: facial expression and body pose to show "${emotion}" (${expressionDesc}).
Do NOT add text, watermarks, or UI elements. Output the character only.`;

  const imgBuf = await generateImage(prompt, refPath);

  // Normalise to 512×512 PNG regardless of what the model returns
  await sharp(imgBuf).resize(512, 512).png().toFile(outPath);
}

export async function resolveKuroImage(emotion: string): Promise<string | undefined> {
  // 1. Check the static emotion map
  const filename = EMOTION_MAP[emotion];
  if (filename) {
    const fullPath = path.join(ASSETS_DIR, filename);
    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      // File listed in map but missing → fall through to generation
    }
  }

  // 2. Check the in-memory dynamic cache
  if (dynamicCache.has(emotion)) {
    const cached = dynamicCache.get(emotion)!;
    try {
      await fs.access(cached);
      return cached;
    } catch {
      dynamicCache.delete(emotion);
    }
  }

  // 3. Auto-generate via Gemini image generation
  console.log(`[kuro] No image for "${emotion}", generating via AI...`);
  const outFilename = filename ?? sanitizeFilename(emotion);
  const outPath = path.join(ASSETS_DIR, outFilename);

  try {
    await generateKuroExpression(emotion, outPath);
    dynamicCache.set(emotion, outPath);
    console.log(`[kuro] Generated "${emotion}" → ${outFilename}`);
    return outPath;
  } catch (err) {
    console.error(`[kuro] Image generation failed for "${emotion}":`, err);
    return undefined;
  }
}
