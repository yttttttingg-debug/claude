import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config';
import { sendToConfiguredTargets } from '../notify';
import { proposeVideoTopic, generateOutline, generateVideoScript } from './script';
import { resolveKuroImage } from './kuro';
import { synthesizeSpeech } from './tts';
import { renderSlide } from './slides';
import { assembleVideo, SlideClip } from './video';
import { uploadVideo } from './upload';
import { newApprovalId, waitForApproval } from './approval';
import { sendApprovalMessage, sendSimpleMessage, sendVideoFile } from '../adapters/telegramSender';
import { getEpisodeCount, incrementEpisode } from './state';

const APPROVE_REVISE_CANCEL = [
  { text: '批准 ✅', action: 'approve' as const },
  { text: '修改 ✏️', action: 'revise' as const },
  { text: '取消 ❌', action: 'cancel' as const },
];

const CONFIRM_CANCEL = [
  { text: '確認上傳 ✅', action: 'approve' as const },
  { text: '修改腳本 ✏️', action: 'revise' as const },
  { text: '取消 ❌', action: 'cancel' as const },
];

async function notifyResourceError(chatId: string | number | undefined, err: unknown): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err);
  const notice = `⚠️ 資源不足，影片製作暫停：\n${msg}\n\n請確認後回覆「繼續」或「取消」。`;
  if (chatId) {
    await sendSimpleMessage(chatId, notice);
  } else {
    await sendToConfiguredTargets(notice);
  }
}

export async function runYoutubeChannelTask(topicHint?: string, ownerChatId?: string | number): Promise<void> {
  const chatId = ownerChatId ?? config.youtubeOwnerTelegramChatId;
  const episodeNumber = (await getEpisodeCount()) + 1;

  if (chatId) {
    await sendSimpleMessage(chatId, `🎬 開始準備第 ${episodeNumber} 集...`);
  }

  // ── Stage 1: 主題提案，直到批准或取消 ────────────────────────────────
  let proposal = await proposeVideoTopic(topicHint);

  if (chatId) {
    while (true) {
      const id = newApprovalId();
      await sendApprovalMessage(
        chatId,
        `📋 第 ${episodeNumber} 集主題提案\n\n🎯 主題：${proposal.topic}\n\n💡 切入角度：${proposal.approach}\n\n你的意見？`,
        id,
        APPROVE_REVISE_CANCEL,
      );

      const result = await waitForApproval(id);
      if (result.action === 'cancel') {
        await sendSimpleMessage(chatId, '好，已取消本次影片製作。');
        return;
      }
      if (result.action === 'approve') break;
      await sendSimpleMessage(chatId, '收到！根據你的意見重新提案...');
      proposal = await proposeVideoTopic(result.feedback ?? topicHint);
    }
  }

  // ── Stage 2: 綱要討論，直到批准或取消 ────────────────────────────────
  if (chatId) await sendSimpleMessage(chatId, '好，生成影片綱要，稍等...');
  let outline = await generateOutline(proposal.topic, proposal.approach, episodeNumber);

  if (chatId) {
    while (true) {
      const sectionsText = outline.sections.map((s, i) => `  ${i + 1}. ${s.point}`).join('\n');
      const mins = Math.round(outline.estimatedSeconds / 60 * 10) / 10;
      const id = newApprovalId();
      await sendApprovalMessage(
        chatId,
        `📑 第 ${episodeNumber} 集綱要\n\n🎯 ${outline.topic}\n⏱ 預估 ${mins} 分鐘\n\n${sectionsText}\n\n這個方向可以嗎？批准後才會生成完整腳本。`,
        id,
        APPROVE_REVISE_CANCEL,
      );

      const result = await waitForApproval(id);
      if (result.action === 'cancel') {
        await sendSimpleMessage(chatId, '好，已取消。');
        return;
      }
      if (result.action === 'approve') break;
      await sendSimpleMessage(chatId, '好，根據你的意見重新調整綱要...');
      outline = await generateOutline(proposal.topic, proposal.approach, episodeNumber, result.feedback);
    }
  }

  // ── Stage 3: 完整腳本，直到批准或取消 ────────────────────────────────
  if (chatId) await sendSimpleMessage(chatId, '開始寫腳本，稍等...');
  let script = await generateVideoScript(outline, episodeNumber);

  if (chatId) {
    while (true) {
      const slideText = script.slides.map((s, i) => `  ${i + 1}. [${s.emotion}] ${s.text}`).join('\n');
      const id = newApprovalId();
      await sendApprovalMessage(
        chatId,
        `📝 第 ${episodeNumber} 集腳本\n\n🎬 標題：${script.title}\n📊 共 ${script.slides.length} 段\n\n${slideText}\n\n確認開始製作影片？`,
        id,
        APPROVE_REVISE_CANCEL,
      );

      const result = await waitForApproval(id);
      if (result.action === 'cancel') {
        await sendSimpleMessage(chatId, '好，已取消。');
        return;
      }
      if (result.action === 'approve') break;
      await sendSimpleMessage(chatId, '好，根據你的意見重新寫腳本...');
      script = await generateVideoScript(outline, episodeNumber, result.feedback);
    }
  }

  // ── Stage 4: 製作影片（TTS + 投影片 + 合成） ─────────────────────────
  if (chatId) await sendSimpleMessage(chatId, '開始製作影片（配音 → 投影片 → 合成），需要幾分鐘...');
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-video-'));

  try {
    let clips: SlideClip[];
    try {
      clips = [];
      for (let i = 0; i < script.slides.length; i++) {
        const { text, emotion } = script.slides[i];
        const kuroImagePath = await resolveKuroImage(emotion);
        const audioPath = await synthesizeSpeech(text, workDir);
        const imagePath = path.join(workDir, `slide-${i}.png`);
        await renderSlide(text, i, script.slides.length, imagePath, kuroImagePath);
        clips.push({ imagePath, audioPath });
      }
    } catch (err) {
      await notifyResourceError(chatId, err);
      throw err;
    }

    const outFile = path.join(workDir, 'output.mp4');
    try {
      await assembleVideo(clips, workDir, outFile);
    } catch (err) {
      await notifyResourceError(chatId, err);
      throw err;
    }

    // ── Stage 5: 預覽成品，直到批准或取消 ────────────────────────────────
    if (chatId) {
      while (true) {
        await sendSimpleMessage(chatId, '影片製作完成，傳給你預覽...');
        await sendVideoFile(
          chatId,
          outFile,
          `第 ${episodeNumber} 集預覽\n標題：${script.title}`,
        );

        const id = newApprovalId();
        await sendApprovalMessage(
          chatId,
          `📌 標題：${script.title}\n📝 描述：${script.description}\n🏷 標籤：${script.tags.join('、')}\n\n確認上傳 YouTube？（上傳後為「不公開」，需手動在 YouTube Studio 改公開）`,
          id,
          CONFIRM_CANCEL,
        );

        const result = await waitForApproval(id);
        if (result.action === 'cancel') {
          await sendSimpleMessage(chatId, '好，已取消上傳，影片檔案已刪除。');
          return;
        }
        if (result.action === 'approve') break;
        // revise: 重新生成腳本 → 重新製作影片
        await sendSimpleMessage(chatId, '好，根據你的意見重新調整腳本再製作...');
        script = await generateVideoScript(outline, episodeNumber, result.feedback);
        const slideText = script.slides.map((s, i) => `  ${i + 1}. [${s.emotion}] ${s.text}`).join('\n');
        await sendSimpleMessage(chatId, `新腳本：\n${slideText}\n\n重新製作中...`);
        const newClips: SlideClip[] = [];
        for (let i = 0; i < script.slides.length; i++) {
          const { text, emotion } = script.slides[i];
          const kuroImagePath = await resolveKuroImage(emotion);
          const audioPath = await synthesizeSpeech(text, workDir);
          const imagePath = path.join(workDir, `slide-${i}.png`);
          await renderSlide(text, i, script.slides.length, imagePath, kuroImagePath);
          newClips.push({ imagePath, audioPath });
        }
        clips = newClips;
        await assembleVideo(newClips, workDir, outFile);
      }
    }

    // ── Stage 6: 上傳 ─────────────────────────────────────────────────
    if (chatId) await sendSimpleMessage(chatId, '上傳中...');
    let upload;
    try {
      upload = await uploadVideo(outFile, script.title, script.description, script.tags);
    } catch (err) {
      await notifyResourceError(chatId, err);
      throw err;
    }

    const newCount = await incrementEpisode();
    const msg = `第 ${newCount} 集已上傳（狀態：${config.youtubeUploadPrivacyStatus}）\n標題：${script.title}\n${upload.url}\n\n請到 YouTube Studio 手動改成公開。`;

    if (chatId) {
      await sendSimpleMessage(chatId, `✅ 上傳成功！\n\n${msg}`);
    } else {
      await sendToConfiguredTargets(msg);
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
