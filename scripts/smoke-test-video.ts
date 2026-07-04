import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { synthesizeSpeech } from '../src/youtube/tts';
import { renderSlide } from '../src/youtube/slides';
import { assembleVideo, SlideClip } from '../src/youtube/video';

async function main() {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-smoke-'));
  console.log('workDir:', workDir);

  const texts = ['歡迎收看今天的頻道，我們來聊聊生活小知識。', '保持水分很重要，每天記得多喝水。'];
  const clips: SlideClip[] = [];

  for (let i = 0; i < texts.length; i++) {
    const audioPath = await synthesizeSpeech(texts[i], workDir);
    console.log('audio:', audioPath);
    const imagePath = path.join(workDir, `slide-${i}.png`);
    await renderSlide(texts[i], i, texts.length, imagePath);
    console.log('image:', imagePath);
    clips.push({ imagePath, audioPath });
  }

  const outFile = path.join(workDir, 'output.mp4');
  await assembleVideo(clips, workDir, outFile);
  const stat = await fs.stat(outFile);
  console.log('output video:', outFile, 'size:', stat.size);
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED', err);
  process.exit(1);
});
