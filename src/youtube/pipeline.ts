import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config';
import { sendToConfiguredTargets } from '../notify';
import { generateVideoScript } from './script';
import { synthesizeSpeech } from './tts';
import { renderSlide } from './slides';
import { assembleVideo, SlideClip } from './video';
import { uploadVideo } from './upload';

/** Full pipeline: pick a topic, write a script, generate voiceover + slides, assemble a video, upload it. */
export async function runYoutubeChannelTask(topicHint?: string): Promise<void> {
  const script = await generateVideoScript(topicHint);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-video-'));

  try {
    const clips: SlideClip[] = [];
    for (let i = 0; i < script.slides.length; i++) {
      const text = script.slides[i];
      const audioPath = await synthesizeSpeech(text, workDir);
      const imagePath = path.join(workDir, `slide-${i}.png`);
      await renderSlide(text, i, script.slides.length, imagePath);
      clips.push({ imagePath, audioPath });
    }

    const outFile = path.join(workDir, 'output.mp4');
    await assembleVideo(clips, workDir, outFile);

    const upload = await uploadVideo(outFile, script.title, script.description, script.tags);

    await sendToConfiguredTargets(
      `新影片已產生並上傳（狀態：${config.youtubeUploadPrivacyStatus}）\n標題：${script.title}\n${upload.url}\n\n若要公開，請到 YouTube Studio 手動切換為公開。`,
    );
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
