import { Telegraf } from 'telegraf';
import { config } from '../config';
import { askAI } from '../ai';
import { runYoutubeChannelTask } from '../youtube/pipeline';
import { resolveApproval, resolveTextInput, waitForTextInput } from '../youtube/approval';
import { registerBotForSending } from './telegramSender';

export function startTelegramBot() {
  if (!config.telegramToken) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN not set, skipping Telegram adapter');
    return undefined;
  }

  const bot = new Telegraf(config.telegramToken);
  registerBotForSending(bot);

  bot.command('start', async (ctx) => {
    await ctx.reply(
      `歡迎！我是你的 AI 助理。\n\n你的 Chat ID 是：${ctx.chat.id}\n\n把這個 ID 填進 .env 的 REPORT_TELEGRAM_CHAT_ID 和 YOUTUBE_OWNER_TELEGRAM_CHAT_ID，我就能把每日報告和影片審核傳給你。`,
    );
  });

  bot.command('myid', async (ctx) => {
    await ctx.reply(`你的 Chat ID：${ctx.chat.id}`);
  });

  // Approval inline-button callbacks
  bot.action(/^approve:(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    const handled = resolveApproval(id, 'approve');
    await ctx.answerCbQuery(handled ? '已批准 ✅' : '此操作已過期');
    if (handled) {
      try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch { /* ignore */ }
    }
  });

  bot.action(/^revise:(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    const chatId = ctx.chat?.id;
    if (!chatId) { await ctx.answerCbQuery(); return; }
    await ctx.answerCbQuery('請傳送修改意見 ✏️');
    try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch { /* ignore */ }
    await bot.telegram.sendMessage(chatId, '請輸入修改意見（直接傳文字）：');
    waitForTextInput(chatId)
      .then((feedback) => resolveApproval(id, 'revise', feedback))
      .catch(() => resolveApproval(id, 'cancel'));
  });

  bot.action(/^cancel:(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    const handled = resolveApproval(id, 'cancel');
    await ctx.answerCbQuery(handled ? '已取消 ❌' : '此操作已過期');
    if (handled) {
      try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch { /* ignore */ }
    }
  });

  bot.command('newvideo', async (ctx) => {
    const topic = ctx.payload?.trim();
    await ctx.reply('好，我來構思主題提案，請稍候...');
    try {
      await runYoutubeChannelTask(topic || undefined, ctx.chat.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('取消')) {
        console.error('[telegram] /newvideo failed', err);
        await ctx.reply(`影片製作失敗：${msg}`);
      }
    }
  });

  bot.on('text', async (ctx) => {
    const chatId = ctx.chat.id;
    // If pipeline is waiting for text feedback, route there first
    if (resolveTextInput(chatId, ctx.message.text)) return;

    const sessionId = `telegram:${chatId}`;
    try {
      const reply = await askAI(sessionId, ctx.message.text);
      await ctx.reply(reply);
    } catch (err) {
      console.error('[telegram] failed to handle message', err);
      await ctx.reply('抱歉，處理訊息時發生錯誤，請稍後再試。');
    }
  });

  bot.launch();
  console.log('[telegram] bot started (long polling)');
  return bot;
}
