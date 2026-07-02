import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from '../config';
import { askClaude } from '../claude';

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
