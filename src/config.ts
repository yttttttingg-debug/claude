import 'dotenv/config';

export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  claudeModel: process.env.CLAUDE_MODEL ?? 'claude-sonnet-5',
  systemPrompt:
    process.env.AI_SYSTEM_PROMPT ??
    '你是一個樂於助人的 AI 助理，請用繁體中文簡潔回覆。',
  port: Number(process.env.PORT ?? 3000),

  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  discordToken: process.env.DISCORD_BOT_TOKEN,
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET,

  monitorUrl: process.env.MONITOR_URL,
  monitorCron: process.env.MONITOR_CRON ?? '*/30 * * * *',
  dailyReportCron: process.env.DAILY_REPORT_CRON ?? '0 9 * * *',
  randomTaskCron: process.env.RANDOM_TASK_CRON ?? '0 */6 * * *',

  reportTelegramChatId: process.env.REPORT_TELEGRAM_CHAT_ID,
  reportDiscordChannelId: process.env.REPORT_DISCORD_CHANNEL_ID,
  reportLineUserId: process.env.REPORT_LINE_USER_ID,

  // YouTube channel automation (script -> voiceover -> slideshow video -> upload)
  youtubeClientId: process.env.YOUTUBE_CLIENT_ID,
  youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET,
  youtubeRefreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
  youtubeChannelTopic: process.env.YOUTUBE_CHANNEL_TOPIC ?? '生活實用小知識',
  youtubeTtsVoice: process.env.YOUTUBE_TTS_VOICE ?? 'zh-TW-HsiaoChenNeural',
  youtubeUploadPrivacyStatus: process.env.YOUTUBE_UPLOAD_PRIVACY_STATUS ?? 'private',
  youtubeChannelTaskCron: process.env.YOUTUBE_CHANNEL_TASK_CRON ?? '0 10 * * *',
  youtubeCommentReplyCron: process.env.YOUTUBE_COMMENT_REPLY_CRON ?? '15 * * * *',
};
