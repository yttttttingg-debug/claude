import fs from 'node:fs';
import { google, youtube_v3 } from 'googleapis';
import { config } from '../config';

function getYoutubeClient(): youtube_v3.Youtube | undefined {
  if (!config.youtubeClientId || !config.youtubeClientSecret || !config.youtubeRefreshToken) {
    return undefined;
  }

  const oauth2Client = new google.auth.OAuth2(config.youtubeClientId, config.youtubeClientSecret);
  oauth2Client.setCredentials({ refresh_token: config.youtubeRefreshToken });
  return google.youtube({ version: 'v3', auth: oauth2Client });
}

export function getYoutubeClientOrThrow(): youtube_v3.Youtube {
  const client = getYoutubeClient();
  if (!client) {
    throw new Error(
      'YouTube OAuth credentials are not configured (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN).',
    );
  }
  return client;
}

export interface UploadResult {
  videoId: string;
  url: string;
}

/** Uploads a finished video file to the authorized channel. Defaults to a private/unlisted upload for safety. */
export async function uploadVideo(
  filePath: string,
  title: string,
  description: string,
  tags: string[],
): Promise<UploadResult> {
  const youtube = getYoutubeClientOrThrow();

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title, description, tags, categoryId: '27' }, // 27 = Education
      status: { privacyStatus: config.youtubeUploadPrivacyStatus as 'private' | 'unlisted' | 'public' },
    },
    media: { body: fs.createReadStream(filePath) },
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error('YouTube upload succeeded but returned no video id');
  }

  return { videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
}
