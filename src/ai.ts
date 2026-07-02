import { GoogleGenAI, Content } from '@google/genai';
import { config } from './config';

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

const MAX_HISTORY_MESSAGES = 20;
const history = new Map<string, Content[]>();

/** Ask Gemini within a running conversation, keyed by a per-user/chat session id. */
export async function askAI(sessionId: string, userMessage: string): Promise<string> {
  const turns = history.get(sessionId) ?? [];
  turns.push({ role: 'user', parts: [{ text: userMessage }] });

  const response = await ai.models.generateContent({
    model: config.geminiModel,
    contents: turns,
    config: { systemInstruction: config.systemPrompt },
  });

  const reply = (response.text ?? '').trim();
  turns.push({ role: 'model', parts: [{ text: reply }] });
  history.set(sessionId, turns.slice(-MAX_HISTORY_MESSAGES));

  return reply;
}

/** One-off Gemini call with no conversation history, used by scheduled tasks. */
export async function askAIOnce(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: config.geminiModel,
    contents: prompt,
  });

  return (response.text ?? '').trim();
}
