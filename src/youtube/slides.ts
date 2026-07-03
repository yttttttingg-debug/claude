import sharp from 'sharp';
import fs from 'node:fs/promises';

const WIDTH = 1280;
const HEIGHT = 720;
const KURO_AREA_W = 560;
const LINE_HEIGHT = 58;
const CHARS_WITH_KURO = 13;
const CHARS_FULL = 16;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const char of text) {
    current += char;
    if (current.length >= maxCharsPerLine) {
      lines.push(current);
      current = '';
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Renders one slideshow frame as PNG. If kuroImagePath is given, Kuro appears on the left. */
export async function renderSlide(
  text: string,
  index: number,
  total: number,
  outFile: string,
  kuroImagePath?: string,
): Promise<string> {
  const hasKuro = !!kuroImagePath && await fileExists(kuroImagePath);
  const maxChars = hasKuro ? CHARS_WITH_KURO : CHARS_FULL;
  const lines = wrapText(text, maxChars);
  const totalH = lines.length * LINE_HEIGHT;

  if (hasKuro) {
    // Kuro on left 560px, text centered in right 720px
    const textCenterX = KURO_AREA_W + (WIDTH - KURO_AREA_W) / 2; // 920
    const startY = (HEIGHT - totalH) / 2 + LINE_HEIGHT * 0.75;
    const tspans = lines
      .map((line, i) => `<tspan x="${textCenterX}" y="${startY + i * LINE_HEIGHT}">${escapeXml(line)}</tspan>`)
      .join('');

    const svg = `
      <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#0d1b2a"/>
        <text font-family="'Noto Sans CJK TC','Noto Sans TC',sans-serif" font-size="44" fill="#e8f4f8" text-anchor="middle" font-weight="600">${tspans}</text>
        <text x="97%" y="95%" font-family="sans-serif" font-size="20" fill="#4b5563" text-anchor="end">${index + 1} / ${total}</text>
      </svg>`;

    const bgBuf = await sharp(Buffer.from(svg)).png().toBuffer();

    const kuroResized = await sharp(kuroImagePath!)
      .resize(540, 680, { fit: 'inside' })
      .png()
      .toBuffer();

    const meta = await sharp(kuroResized).metadata();
    const kuroW = meta.width ?? 540;
    const kuroH = meta.height ?? 540;
    const left = Math.floor((KURO_AREA_W - kuroW) / 2);
    const top = Math.max(0, Math.floor((HEIGHT - kuroH) / 2));

    await sharp(bgBuf)
      .composite([{ input: kuroResized, left, top }])
      .png()
      .toFile(outFile);
  } else {
    const startY = HEIGHT / 2 - ((lines.length - 1) * LINE_HEIGHT) / 2;
    const tspans = lines
      .map((line, i) => `<tspan x="50%" y="${startY + i * LINE_HEIGHT}">${escapeXml(line)}</tspan>`)
      .join('');

    const svg = `
      <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1f2937"/>
            <stop offset="100%" stop-color="#111827"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <text font-family="'Noto Sans CJK TC','Noto Sans TC',sans-serif" font-size="48" fill="#f9fafb" text-anchor="middle" font-weight="600">${tspans}</text>
        <text x="97%" y="95%" font-family="sans-serif" font-size="24" fill="#6b7280" text-anchor="end">${index + 1} / ${total}</text>
      </svg>`;

    await sharp(Buffer.from(svg)).png().toFile(outFile);
  }

  return outFile;
}
