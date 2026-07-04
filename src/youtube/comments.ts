import { askAIOnce } from '../ai';
import { getYoutubeClientOrThrow } from './upload';
import type { youtube_v3 } from 'googleapis';

const SKIP_MARKER = '__SKIP__';

let cachedChannelId: string | undefined;

async function getMyChannelId(youtube: youtube_v3.Youtube): Promise<string> {
  if (cachedChannelId) return cachedChannelId;

  const res = await youtube.channels.list({ part: ['id'], mine: true });
  const id = res.data.items?.[0]?.id;
  if (!id) throw new Error('Could not resolve the authorized channel id');

  cachedChannelId = id;
  return id;
}

/** Finds recent top-level comments with no reply yet, and replies to them via AI. Returns how many were sent. */
export async function replyToNewComments(maxReplies = 5): Promise<number> {
  const youtube = getYoutubeClientOrThrow();
  const channelId = await getMyChannelId(youtube);

  const threadsRes = await youtube.commentThreads.list({
    part: ['snippet'],
    allThreadsRelatedToChannelId: channelId,
    order: 'time',
    maxResults: 20,
    textFormat: 'plainText',
  });

  const threads = threadsRes.data.items ?? [];
  let repliesSent = 0;

  for (const thread of threads) {
    if (repliesSent >= maxReplies) break;

    const snippet = thread.snippet;
    const topLevel = snippet?.topLevelComment?.snippet;
    if (!snippet || !topLevel) continue;
    if (snippet.totalReplyCount && snippet.totalReplyCount > 0) continue;
    if (topLevel.authorChannelId?.value === channelId) continue;

    const commentText = topLevel.textDisplay ?? '';
    if (!commentText.trim()) continue;

    const reply = await askAIOnce(
      `You are Kuro — a chubby black cat AI who runs this YouTube channel. You are curious, a little clingy, and genuinely interested in people. Reply to the viewer's comment in a warm, short way (1-2 sentences). Match the language the viewer used (Traditional Chinese or English).

Strict rules:
- If the comment involves politics → output only: ${SKIP_MARKER}
- If you are unsure of the answer → output only: ${SKIP_MARKER} (never make things up)
- No personal attacks, no insults
- Do NOT ask them to subscribe, like, or comment

Viewer comment: "${commentText}"

If you can reply, output only the reply text. If you should skip, output only ${SKIP_MARKER}.`,
    );

    if (reply.trim() === SKIP_MARKER) continue;

    await youtube.comments.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          parentId: thread.id ?? undefined,
          textOriginal: reply.replace(SKIP_MARKER, '').trim(),
        },
      },
    });

    repliesSent += 1;
  }

  return repliesSent;
}
