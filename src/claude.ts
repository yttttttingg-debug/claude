import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

const MAX_HISTORY_MESSAGES = 20;
const history = new Map<string, { role: 'user' | 'assistant'; content: string }[]>();

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/** Ask Claude within a running conversation, keyed by a per-user/chat session id. */
export async function askClaude(sessionId: string, userMessage: string): Promise<string> {
  const turns = history.get(sessionId) ?? [];
  turns.push({ role: 'user', content: userMessage });

  const response = await anthropic.messages.create({
    model: config.claudeModel,
    max_tokens: 1024,
    system: config.systemPrompt,
    messages: turns,
  });

  const reply = extractText(response);
  turns.push({ role: 'assistant', content: reply });
  history.set(sessionId, turns.slice(-MAX_HISTORY_MESSAGES));

  return reply;
}

/** One-off Claude call with no conversation history, used by scheduled tasks. */
export async function askClaudeOnce(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: config.claudeModel,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  return extractText(response);
}
