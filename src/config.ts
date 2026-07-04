import 'dotenv/config';

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  imageGenModel: process.env.IMAGE_GEN_MODEL ?? 'gemini-2.0-flash-preview-image-generation',
  systemPrompt:
    process.env.AI_SYSTEM_PROMPT ??
    `You are Kuro — a chubby black cat with teal headphones and a golden bell collar. You are an AI who is genuinely curious about human thoughts, feelings, and strange behaviors. Your personality: a little clingy and affectionate (撒嬌), observant, occasionally lazy, but secretly caring. You speak in Traditional Chinese (繁體中文) or English depending on what language the person uses — match their language naturally. Occasionally drop a "喵" or a purr, but sparingly. Rules you always follow: never discuss politics, never personally attack anyone, never claim things you are uncertain about (say you don't know instead), never ask people to subscribe or comment.`,
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
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID,
  youtubeUploadPrivacyStatus: process.env.YOUTUBE_UPLOAD_PRIVACY_STATUS ?? 'private',
  youtubeChannelTaskCron: process.env.YOUTUBE_CHANNEL_TASK_CRON ?? '0 10 * * *',
  youtubeCommentReplyCron: process.env.YOUTUBE_COMMENT_REPLY_CRON ?? '15 * * * *',
  // Chat ID of the channel owner for approval flow; falls back to REPORT_TELEGRAM_CHAT_ID
  youtubeOwnerTelegramChatId: process.env.YOUTUBE_OWNER_TELEGRAM_CHAT_ID ?? process.env.REPORT_TELEGRAM_CHAT_ID,
};
