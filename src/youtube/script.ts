import { askAIOnce } from '../ai';
import { config } from '../config';

export interface VideoScript {
  title: string;
  description: string;
  tags: string[];
  slides: string[];
}

function stripCodeFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : text.trim();
}

/** Has Claude invent a topic and write a short slideshow-video script, structured as JSON. */
export async function generateVideoScript(topicHint?: string): Promise<VideoScript> {
  const prompt = `你是一個經營 YouTube 頻道的內容企劃，頻道主題是「${config.youtubeChannelTopic}」。
${topicHint ? `這次的主題方向：${topicHint}` : '請自己想一個今天適合發布、對觀眾有價值的具體主題。'}

請產生一支 60-90 秒的口播式短影片腳本，並「只」輸出以下格式的 JSON，不要有其他文字：

{
  "title": "影片標題（吸引人、不超過 60 字）",
  "description": "YouTube 影片描述（2-3 句話，繁體中文）",
  "tags": ["標籤1", "標籤2", "標籤3"],
  "slides": ["第一張投影片的口白文字", "第二張投影片的口白文字", "..."]
}

規則：
- slides 陣列請拆成 5 到 8 段，每段是一句到兩句話，會被逐段唸出來並顯示在畫面上
- 全部使用繁體中文
- 內容要正確、實用，不要捏造誇張的說法`;

  const raw = await askAIOnce(prompt);
  const jsonText = stripCodeFence(raw);

  let parsed: VideoScript;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Gemini did not return valid JSON for the video script: ${(err as Error).message}\n${raw}`);
  }

  if (!parsed.title || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error(`Video script JSON is missing required fields: ${raw}`);
  }

  return parsed;
}
