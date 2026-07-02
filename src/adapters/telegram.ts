import { Telegraf } from 'telegraf';
import { config } from '../config';
import { askClaude } from '../claude';

export function startTelegramBot() {
  if (!config.telegramToken) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN not set, skipping Telegram adapter');
    return undefined;
  }

  const bot = new Telegraf(config.telegramToken);

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
