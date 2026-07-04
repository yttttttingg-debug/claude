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
      `你是這個 YouTube 頻道的經營者 Kuro，請用親切、簡短（一到兩句話）、繁體中文回覆這則觀眾留言。

嚴格規則：
- 不談論政治（如果留言涉及政治，輸出 ${SKIP_MARKER}）
- 不對任何人或群體作人身攻擊
- 如果留言的問題你不確定答案，輸出 ${SKIP_MARKER}（不要胡謅）
- 不叫人訂閱、按讚、留言

觀眾留言：「${commentText}」

如果可以回覆，直接輸出回覆文字；如果不該回，只輸出 ${SKIP_MARKER}，不要有其他文字。`,
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
