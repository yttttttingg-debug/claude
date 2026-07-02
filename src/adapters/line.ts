import { Router } from 'express';
import {
  middleware,
  messagingApi,
  webhook,
  MiddlewareConfig,
} from '@line/bot-sdk';
import { config } from '../config';
import { askClaude } from '../claude';

export function createLineRouter(): Router | undefined {
  if (!config.lineChannelAccessToken || !config.lineChannelSecret) {
    console.log('[line] LINE_CHANNEL_ACCESS_TOKEN/SECRET not set, skipping LINE adapter');
    return undefined;
  }

  const middlewareConfig: MiddlewareConfig = { channelSecret: config.lineChannelSecret };
  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: config.lineChannelAccessToken,
  });
  const router = Router();

  router.post('/webhooks/line', middleware(middlewareConfig), async (req, res) => {
    const events: webhook.Event[] = req.body.events ?? [];
    await Promise.all(events.map((event) => handleEvent(event, client)));
    res.sendStatus(200);
  });

  console.log('[line] webhook route registered at /webhooks/line');
  return router;
}

async function handleEvent(event: webhook.Event, client: messagingApi.MessagingApiClient) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  if (!event.replyToken) return;

  const sessionId = `line:${event.source?.userId ?? event.replyToken}`;

  try {
    const reply = await askClaude(sessionId, event.message.text);
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: reply }],
    });
  } catch (err) {
    console.error('[line] failed to handle message', err);
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: '抱歉，處理訊息時發生錯誤，請稍後再試。' }],
    });
  }
}
