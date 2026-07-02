import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from '../config';
import { askClaude } from '../claude';
import { runYoutubeChannelTask } from '../youtube/pipeline';

const NEW_VIDEO_PREFIX = '!newvideo';

export function startDiscordBot() {
  if (!config.discordToken) {
    console.log('[discord] DISCORD_BOT_TOKEN not set, skipping Discord adapter');
    return undefined;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith(NEW_VIDEO_PREFIX)) {
      const topic = message.content.slice(NEW_VIDEO_PREFIX.length).trim();
      await message.reply('好，我開始準備新影片了，完成後會回報連結（幾分鐘內）...');
      try {
        await runYoutubeChannelTask(topic || undefined);
      } catch (err) {
        console.error('[discord] !newvideo failed', err);
        await message.reply(`產生影片失敗：${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }

    const sessionId = `discord:${message.channelId}`;
    try {
      const reply = await askClaude(sessionId, message.content);
      await message.reply(reply);
    } catch (err) {
      console.error('[discord] failed to handle message', err);
      await message.reply('抱歉，處理訊息時發生錯誤，請稍後再試。');
    }
  });

  client.once('ready', () => {
    console.log(`[discord] bot started as ${client.user?.tag}`);
  });

  client.login(config.discordToken);
  return client;
}
