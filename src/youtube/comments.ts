import { askClaudeOnce } from '../claude';
import { getYoutubeClientOrThrow } from './upload';
import type { youtube_v3 } from 'googleapis';

let cachedChannelId: string | undefined;

async function getMyChannelId(youtube: youtube_v3.Youtube): Promise<string> {
  if (cachedChannelId) return cachedChannelId;

  const res = await youtube.channels.list({ part: ['id'], mine: true });
  const id = res.data.items?.[0]?.id;
  if (!id) throw new Error('Could not resolve the authorized channel id');

  cachedChannelId = id;
  return id;
}

/** Finds recent top-level comments with no reply yet, and replies to them via Claude. Returns how many were sent. */
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

    const reply = await askClaudeOnce(
      `你是這個 YouTube 頻道的經營者，請用親切、簡短（一到兩句話）、繁體中文回覆這則觀眾留言：\n「${commentText}」`,
    );

    await youtube.comments.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          parentId: thread.id ?? undefined,
          textOriginal: reply,
        },
      },
    });

    repliesSent += 1;
  }

  return repliesSent;
}
