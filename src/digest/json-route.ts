import type { Env, Handler } from 'hono';
import type { ReadNight } from './types.js';

export function makeDigestJson(runsDir: string, readNight: ReadNight): Handler<Env, '/api/digest/:night'> {
  return (c) => {
    const digest = readNight(runsDir, c.req.param('night'));
    if (digest === null) return c.json({ error: 'night not found' }, 404);
    return c.json(digest.rows);
  };
}
