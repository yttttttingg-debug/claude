import fs from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';

export interface SlideClip {
  imagePath: string;
  audioPath: string;
}

function ffprobeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration ?? 0);
    });
  });
}

function runFfmpeg(configure: (cmd: ffmpeg.FfmpegCommand) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    configure(command);
    command.on('end', () => resolve());
    command.on('error', reject);
    command.run();
  });
}

/** Assembles per-slide images + narration clips into a single synced MP4 slideshow video. */
export async function assembleVideo(clips: SlideClip[], workDir: string, outFile: string): Promise<string> {
  const durations = await Promise.all(clips.map((clip) => ffprobeDuration(clip.audioPath)));

  const imageListPath = path.join(workDir, 'images.txt');
  const imageListLines: string[] = [];
  clips.forEach((clip, i) => {
    imageListLines.push(`file '${clip.imagePath}'`);
    imageListLines.push(`duration ${durations[i].toFixed(3)}`);
  });
  // The concat demuxer ignores the duration of the last listed entry unless it is repeated once more.
  imageListLines.push(`file '${clips[clips.length - 1].imagePath}'`);
  await fs.writeFile(imageListPath, imageListLines.join('\n'));

  const audioListPath = path.join(workDir, 'audio.txt');
  await fs.writeFile(audioListPath, clips.map((clip) => `file '${clip.audioPath}'`).join('\n'));

  const videoOnlyPath = path.join(workDir, 'video-only.mp4');
  await runFfmpeg((cmd) => {
    cmd
      .input(imageListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-vsync', 'vfr', '-pix_fmt', 'yuv420p'])
      .output(videoOnlyPath);
  });

  const audioCombinedPath = path.join(workDir, 'audio-combined.mp3');
  await runFfmpeg((cmd) => {
    cmd
      .input(audioListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(audioCombinedPath);
  });

  await runFfmpeg((cmd) => {
    cmd
      .input(videoOnlyPath)
      .input(audioCombinedPath)
      .outputOptions(['-c:v', 'copy', '-c:a', 'aac', '-shortest'])
      .output(outFile);
  });

  return outFile;
}
