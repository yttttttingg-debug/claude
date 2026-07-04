import { config } from './config';
import { startServer } from './server';
import { startTelegramBot } from './adapters/telegram';
import { startDiscordBot } from './adapters/discord';
import { startScheduler } from './scheduler';

function main() {
  if (!config.geminiApiKey) {
    console.error('GEMINI_API_KEY is required. Set it in your environment and restart.');
    process.exit(1);
  }

  startServer();
  startTelegramBot();
  startDiscordBot();
  startScheduler();

  console.log('[app] always-on AI service started');
}

main();

process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));
