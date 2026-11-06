import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { makeDigestJson } from './digest/json-route.js';
import { makeDigestPage } from './digest/page-route.js';
import { readNight } from './digest/read-night.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config, readNight)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', makeDigestPage(config.runsDir, readNight));
  app.get('/api/digest/:night', makeDigestJson(config.runsDir, readNight));

  return app;
}
