import cron from 'node-cron';
import { config } from './config';
import { askClaudeOnce } from './claude';
import { sendToConfiguredTargets } from './notify';

const RANDOM_TOPICS = [
  '今天有什麼值得學習的新技術趨勢？給我三個重點，繁體中文回覆。',
  '分享一個能提升生產力的小技巧，繁體中文回覆，簡短一點。',
  '用一句話總結今天適合做的一件小事，繁體中文回覆。',
  '給我一個簡短的靈感或思考題，繁體中文回覆。',
];

export function startScheduler() {
  if (config.monitorUrl) {
    cron.schedule(config.monitorCron, () =>
      runMonitorTask().catch((err) => console.error('[scheduler] monitor task failed', err)),
    );
    console.log(`[scheduler] monitor task scheduled: ${config.monitorCron} -> ${config.monitorUrl}`);
  }

  cron.schedule(config.dailyReportCron, () =>
    runDailyReportTask().catch((err) => console.error('[scheduler] daily report task failed', err)),
  );
  console.log(`[scheduler] daily report task scheduled: ${config.dailyReportCron}`);

  cron.schedule(config.randomTaskCron, () =>
    runRandomTask().catch((err) => console.error('[scheduler] random task failed', err)),
  );
  console.log(`[scheduler] random task scheduled: ${config.randomTaskCron}`);
}

async function runMonitorTask() {
  if (!config.monitorUrl) return;
  const start = Date.now();
  let status: 'up' | 'down' = 'up';
  let detail = '';

  try {
    const res = await fetch(config.monitorUrl, { signal: AbortSignal.timeout(10_000) });
    detail = `HTTP ${res.status}, ${Date.now() - start}ms`;
    if (!res.ok) status = 'down';
  } catch (err) {
    status = 'down';
    detail = err instanceof Error ? err.message : String(err);
  }

  if (status === 'down') {
    await sendToConfiguredTargets(`監控警告：${config.monitorUrl} 異常 (${detail})`);
  }
}

async function runDailyReportTask() {
  const report = await askClaudeOnce(
    '請用三到五個重點，簡短總結今天日期的常見待辦提醒與生活小建議，繁體中文回覆。',
  );
  await sendToConfiguredTargets(`每日簡報：\n${report}`);
}

async function runRandomTask() {
  const topic = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
  const result = await askClaudeOnce(topic);
  await sendToConfiguredTargets(`隨機任務：\n${result}`);
}
