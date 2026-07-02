import sharp from 'sharp';

const WIDTH = 1280;
const HEIGHT = 720;
const LINE_HEIGHT = 64;
const MAX_CHARS_PER_LINE = 16;

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

/** Renders one slideshow frame (dark background + wrapped caption text) as a PNG. */
export async function renderSlide(
  text: string,
  index: number,
  total: number,
  outFile: string,
): Promise<string> {
  const lines = wrapText(text, MAX_CHARS_PER_LINE);
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
      <text font-family="'Noto Sans CJK TC', 'Noto Sans TC', sans-serif" font-size="48" fill="#f9fafb" text-anchor="middle" font-weight="600">
        ${tspans}
      </text>
      <text x="97%" y="95%" font-family="sans-serif" font-size="24" fill="#6b7280" text-anchor="end">${index + 1} / ${total}</text>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(outFile);
  return outFile;
}
