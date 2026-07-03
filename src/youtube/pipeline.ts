import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config';
import { sendToConfiguredTargets } from '../notify';
import { proposeVideoTopic, generateVideoScript } from './script';
import { synthesizeSpeech } from './tts';
import { renderSlide } from './slides';
import { assembleVideo, SlideClip } from './video';
import { uploadVideo } from './upload';
import { newApprovalId, waitForApproval } from './approval';
import { sendApprovalMessage, sendSimpleMessage } from '../adapters/telegramSender';

const APPROVE_REVISE_CANCEL = [
  { text: '批准 ✅', action: 'approve' as const },
  { text: '修改 ✏️', action: 'revise' as const },
  { text: '取消 ❌', action: 'cancel' as const },
];

const CONFIRM_CANCEL = [
  { text: '確認上傳 ✅', action: 'approve' as const },
  { text: '取消 ❌', action: 'cancel' as const },
];

export async function runYoutubeChannelTask(topicHint?: string, ownerChatId?: string | number): Promise<void> {
  const chatId = ownerChatId ?? config.youtubeOwnerTelegramChatId;

  // Stage 1: Propose topic, loop until approved or cancelled
  let proposal = await proposeVideoTopic(topicHint);

  if (chatId) {
    while (true) {
      const id = newApprovalId();
      await sendApprovalMessage(
        chatId,
        `📋 主題提案\n\n🎯 主題：${proposal.topic}\n\n💡 切入角度：${proposal.approach}\n\n你的意見？`,
        id,
        APPROVE_REVISE_CANCEL,
      );

      const result = await waitForApproval(id);
      if (result.action === 'cancel') {
        await sendSimpleMessage(chatId, '好，已取消本次影片製作。');
        return;
      }
      if (result.action === 'approve') break;
      // revise: re-propose with feedback
      await sendSimpleMessage(chatId, '收到！根據你的意見重新提案...');
      proposal = await proposeVideoTopic(result.feedback ?? topicHint);
    }
  }

  // Stage 2: Generate script, loop until approved or cancelled
  if (chatId) await sendSimpleMessage(chatId, '好，開始寫腳本，稍等一下...');
  let script = await generateVideoScript(proposal.topic, proposal.approach);

  if (chatId) {
    while (true) {
      const outline = script.slides.map((s, i) => `  ${i + 1}. ${s}`).join('\n');
      const id = newApprovalId();
      await sendApprovalMessage(
        chatId,
        `📝 腳本大綱\n\n🎬 標題：${script.title}\n📊 共 ${script.slides.length} 段\n\n${outline}\n\n確認開始製作影片？`,
        id,
        APPROVE_REVISE_CANCEL,
      );

      const result = await waitForApproval(id);
      if (result.action === 'cancel') {
        await sendSimpleMessage(chatId, '好，已取消。');
        return;
      }
      if (result.action === 'approve') break;
      // revise: regenerate script with feedback
      await sendSimpleMessage(chatId, '好，根據你的意見重新寫腳本...');
      const topicWithFeedback = result.feedback
        ? `${proposal.topic}（補充：${result.feedback}）`
        : proposal.topic;
      script = await generateVideoScript(topicWithFeedback, proposal.approach);
    }
  }

  // Stage 3: Generate TTS + slides + assemble video
  if (chatId) await sendSimpleMessage(chatId, '開始製作影片（配音 → 投影片 → 合成），需要幾分鐘...');
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

    // Stage 4: Pre-upload review
    if (chatId) {
      const id = newApprovalId();
      await sendApprovalMessage(
        chatId,
        `🎬 影片製作完成！\n\n📌 標題：${script.title}\n📝 描述：${script.description}\n🏷 標籤：${script.tags.join('、')}\n\n確認上傳？（上傳後為「不公開」，需手動在 YouTube Studio 改成公開）`,
        id,
        CONFIRM_CANCEL,
      );

      const result = await waitForApproval(id);
      if (result.action !== 'approve') {
        await sendSimpleMessage(chatId, '好，已取消上傳，影片檔案已刪除。');
        return;
      }
      await sendSimpleMessage(chatId, '上傳中...');
    }

    const upload = await uploadVideo(outFile, script.title, script.description, script.tags);
    const msg = `新影片已上傳（狀態：${config.youtubeUploadPrivacyStatus}）\n標題：${script.title}\n${upload.url}\n\n若要公開，請到 YouTube Studio 手動切換。`;

    if (chatId) {
      await sendSimpleMessage(chatId, `✅ 上傳成功！\n\n${msg}`);
    } else {
      await sendToConfiguredTargets(msg);
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
