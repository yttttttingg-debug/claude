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
