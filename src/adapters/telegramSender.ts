import type { Telegraf } from 'telegraf';

export interface ApprovalButton {
  text: string;
  action: 'approve' | 'revise' | 'cancel';
}

let _bot: Telegraf | undefined;

export function registerBotForSending(bot: Telegraf): void {
  _bot = bot;
}

export async function sendApprovalMessage(
  chatId: string | number,
  text: string,
  approvalId: string,
  buttons: ApprovalButton[],
): Promise<void> {
  if (!_bot) return;
  await _bot.telegram.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        buttons.map((b) => ({ text: b.text, callback_data: `${b.action}:${approvalId}` })),
      ],
    },
  });
}

export async function sendSimpleMessage(chatId: string | number, text: string): Promise<void> {
  if (!_bot) return;
  await _bot.telegram.sendMessage(chatId, text);
}

export async function sendVideoFile(
  chatId: string | number,
  filePath: string,
  caption: string,
): Promise<void> {
  if (!_bot) return;
  const { createReadStream } = await import('node:fs');
  const { statSync } = await import('node:fs');
  const MAX_BYTES = 50 * 1024 * 1024;
  const size = statSync(filePath).size;
  if (size > MAX_BYTES) {
    await _bot.telegram.sendMessage(
      chatId,
      `${caption}\n\n（影片檔案 ${(size / 1024 / 1024).toFixed(1)} MB 超過 Telegram 上限，請到伺服器手動確認）`,
    );
    return;
  }
  await _bot.telegram.sendVideo(chatId, { source: createReadStream(filePath) }, { caption });
}
