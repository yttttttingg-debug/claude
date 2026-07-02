import 'dotenv/config';
import http from 'node:http';
import { URL } from 'node:url';
import { google } from 'googleapis';

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('請先在 .env 設定 YOUTUBE_CLIENT_ID 與 YOUTUBE_CLIENT_SECRET，再執行這個腳本。');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/youtube.force-ssl'],
});

console.log('請在瀏覽器打開下面這個網址，用你要用來發布影片的 YouTube/Google 帳號登入並同意授權：\n');
console.log(authUrl);
console.log(`\n等待授權完成（瀏覽器會自動導回 http://localhost:${PORT}/oauth2callback）...`);

const server = http.createServer((req, res) => {
  if (!req.url) return;
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get('code');

  if (url.pathname !== '/oauth2callback' || !code) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h2>授權完成，可以關閉這個分頁，回到終端機查看 Refresh Token。</h2>');

  oauth2Client
    .getToken(code)
    .then(({ tokens }) => {
      console.log('\n拿到囉！請把下面這行加進你的 .env：\n');
      console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
      server.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('交換 token 失敗：', err);
      server.close();
      process.exit(1);
    });
});

server.listen(PORT);
