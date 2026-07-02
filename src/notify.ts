import { messagingApi } from '@line/bot-sdk';
import { config } from './config';

/** Delivers scheduled-task output to whichever platforms have a report target configured. */
export async function sendToConfiguredTargets(text: string) {
  await Promise.all([sendTelegram(text), sendDiscord(text), sendLine(text)]);
}

async function sendTelegram(text: string) {
  if (!config.telegramToken || !config.reportTelegramChatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.reportTelegramChatId, text }),
    });
  } catch (err) {
    console.error('[notify] telegram send failed', err);
  }
}

async function sendDiscord(text: string) {
  if (!config.discordToken || !config.reportDiscordChannelId) return;
  try {
    await fetch(`https://discord.com/api/v10/channels/${config.reportDiscordChannelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${config.discordToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: text }),
    });
  } catch (err) {
    console.error('[notify] discord send failed', err);
  }
}

async function sendLine(text: string) {
  if (!config.lineChannelAccessToken || !config.reportLineUserId) return;
  try {
    const client = new messagingApi.MessagingApiClient({
      channelAccessToken: config.lineChannelAccessToken,
    });
    await client.pushMessage({
      to: config.reportLineUserId,
      messages: [{ type: 'text', text }],
    });
  } catch (err) {
    console.error('[notify] line send failed', err);
  }
}
