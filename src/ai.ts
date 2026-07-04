import fs from 'node:fs/promises';
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

/**
 * Generate an image using Gemini image-generation model.
 * referenceImagePath: path to an existing PNG used as character reference (optional).
 * Returns the generated image as a Buffer (PNG bytes).
 */
export async function generateImage(
  prompt: string,
  referenceImagePath?: string,
): Promise<Buffer> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (referenceImagePath) {
    const imgData = await fs.readFile(referenceImagePath);
    parts.push({ inlineData: { mimeType: 'image/png', data: imgData.toString('base64') } });
  }
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: config.imageGenModel,
    contents: [{ role: 'user', parts }],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if ('inlineData' in part && part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  throw new Error('Gemini image generation returned no image data');
}
