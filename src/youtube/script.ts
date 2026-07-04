import { askAIOnce } from '../ai';
import { config } from '../config';
import { EMOTION_LIST } from './kuro';

export interface TopicProposal {
  topic: string;
  approach: string;
}

export interface OutlineSection {
  point: string;
}

export interface VideoOutline {
  topic: string;
  approach: string;
  sections: OutlineSection[];
  estimatedSeconds: number;
}

export interface SlideEntry {
  text: string;
  emotion: string;
}

export interface VideoScript {
  title: string;
  description: string;
  tags: string[];
  slides: SlideEntry[];
}

function stripCodeFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : text.trim();
}

function channelPersona(): string {
  return `你是一個擁有十萬訂閱的 YouTube 頻道主，頻道主題是「${config.youtubeChannelTopic}」。你熟悉觀眾需求、了解演算法偏好，每支影片都有清晰的核心價值和讓人想分享的記憶點。`;
}

function contentRules(episodeNumber: number): string {
  const always = `- 不談論政治，不對任何人或群體作人身攻擊
- 不確定的事實不要說，寧可省略`;
  const first10 = `- 不得提到蝦皮、賣場、電商、購物平台、任何商品連結
- 不得叫觀眾訂閱、按讚、開小鈴鐺
- 不得叫觀眾在留言區回答問題或互動`;
  return episodeNumber <= 10 ? `${always}\n${first10}` : always;
}

export async function proposeVideoTopic(topicHint?: string): Promise<TopicProposal> {
  const prompt = `${channelPersona()}

${topicHint ? `頻道主指定的方向：「${topicHint}」` : '請自己想一個今天適合發布的具體主題，考慮觀眾興趣與時機性。'}

以十萬訂閱 YouTuber 的角度，提案一個能讓人看完後有收穫、想分享的影片主題。

請「只」輸出以下格式的 JSON，不要有其他文字：
{
  "topic": "影片主題（一句話，20字以內）",
  "approach": "切入角度與大方向（2-3句，說明為什麼這個切入角度能打動觀眾、跟其他同類影片有何差異）"
}`;

  const raw = await askAIOnce(prompt);
  let parsed: TopicProposal;
  try {
    parsed = JSON.parse(stripCodeFence(raw)) as TopicProposal;
  } catch {
    throw new Error(`AI 沒有回傳有效的主題提案 JSON：${raw}`);
  }
  if (!parsed.topic || !parsed.approach) throw new Error('AI 主題提案缺少必要欄位');
  return parsed;
}

export async function generateOutline(
  topic: string,
  approach: string,
  episodeNumber: number,
  feedback?: string,
): Promise<VideoOutline> {
  const prompt = `${channelPersona()}

確定主題：${topic}
切入角度：${approach}
${feedback ? `頻道主的意見：${feedback}` : ''}

請產生這支影片的「綱要」，內容包含：影片要講哪幾個重點、順序是什麼、大約多長。

目標長度：60-180 秒（1-3分鐘）

絕對禁止：
${contentRules(episodeNumber)}

請「只」輸出以下格式的 JSON，不要有其他文字：
{
  "topic": "${topic}",
  "approach": "${approach}",
  "sections": [
    { "point": "第一個重點：說什麼、用什麼例子（一句話）" },
    { "point": "第二個重點..." }
  ],
  "estimatedSeconds": 90
}

sections 要有 3-5 個重點，estimatedSeconds 是預估總長度（秒）。`;

  const raw = await askAIOnce(prompt);
  let parsed: VideoOutline;
  try {
    parsed = JSON.parse(stripCodeFence(raw)) as VideoOutline;
  } catch {
    throw new Error(`AI 沒有回傳有效的綱要 JSON：${raw}`);
  }
  if (!parsed.sections || parsed.sections.length < 2) throw new Error('綱要 JSON 缺少 sections');
  parsed.topic = topic;
  parsed.approach = approach;
  return parsed;
}

export async function generateVideoScript(
  outline: VideoOutline,
  episodeNumber: number,
  extraFeedback?: string,
): Promise<VideoScript> {
  const outlineText = outline.sections.map((s, i) => `  ${i + 1}. ${s.point}`).join('\n');

  const prompt = `${channelPersona()}

確定主題：${outline.topic}
切入角度：${outline.approach}
已批准的綱要：
${outlineText}
${extraFeedback ? `額外修改意見：${extraFeedback}` : ''}

請依照這個綱要，產生一支 ${outline.estimatedSeconds} 秒的口播式短影片腳本。請「只」輸出以下格式的 JSON，不要有其他文字：

{
  "title": "影片標題（吸引人、SEO 友善、不超過 60 字）",
  "description": "YouTube 影片描述（2-3 句話，含關鍵字，繁體中文）",
  "tags": ["標籤1", "標籤2", "標籤3", "標籤4", "標籤5"],
  "slides": [
    { "text": "第一段口白文字", "emotion": "喜" },
    { "text": "第二段口白文字", "emotion": "正常" }
  ]
}

規則：
- slides 拆成 5-8 段，每段一到兩句話，語氣自然像在說話，不像在讀稿
- 每段的 emotion 從以下選一個最符合當下情緒的：${EMOTION_LIST}
- 全部使用繁體中文
- 內容要正確、實用，有具體數字或案例更好

絕對禁止（違反就重寫）：
${contentRules(episodeNumber)}`;

  const raw = await askAIOnce(prompt);
  let parsed: VideoScript;
  try {
    parsed = JSON.parse(stripCodeFence(raw)) as VideoScript;
  } catch (err) {
    throw new Error(`AI 沒有回傳有效的腳本 JSON：${(err as Error).message}\n${raw}`);
  }
  if (!parsed.title || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error(`腳本 JSON 缺少必要欄位：${raw}`);
  }
  return parsed;
}
