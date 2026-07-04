import express from 'express';
import { config } from './config';
import { createLineRouter } from './adapters/line';

export function startServer() {
  const app = express();

  app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'always-on-ai' });
  });

  app.get('/health', (_req, res) => {
    res.send('ok');
  });

  const lineRouter = createLineRouter();
  if (lineRouter) {
    app.use(lineRouter);
  }

  app.listen(config.port, () => {
    console.log(`[server] listening on port ${config.port}`);
  });
}
