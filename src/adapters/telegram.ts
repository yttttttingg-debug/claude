import { Telegraf } from 'telegraf';
import { config } from '../config';
import { askClaude } from '../claude';
import { runYoutubeChannelTask } from '../youtube/pipeline';

export function startTelegramBot() {
  if (!config.telegramToken) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN not set, skipping Telegram adapter');
    return undefined;
  }

  const bot = new Telegraf(config.telegramToken);

  bot.command('newvideo', async (ctx) => {
    const topic = ctx.payload?.trim();
    await ctx.reply('好，我開始準備新影片了，完成後會回報連結（幾分鐘內）...');
    try {
      await runYoutubeChannelTask(topic || undefined);
    } catch (err) {
      console.error('[telegram] /newvideo failed', err);
      await ctx.reply(`產生影片失敗：${err instanceof Error ? err.message : String(err)}`);
    }
  });

  bot.on('text', async (ctx) => {
    const sessionId = `telegram:${ctx.chat.id}`;
    try {
      const reply = await askClaude(sessionId, ctx.message.text);
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
