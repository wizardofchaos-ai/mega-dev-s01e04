import type { Env, Handler } from 'hono';
import { lane } from '../lane.js';
import { DigestTable } from '../views/digest.js';
import { Layout } from '../views/layout.js';
import type { ReadNight } from './types.js';

export function makeDigestPage(runsDir: string, readNight: ReadNight): Handler<Env, '/digest/:night'> {
  return (c) => {
    const night = c.req.param('night');
    const digest = readNight(runsDir, night);
    const title = `digest · ${night}`;

    return c.html(
      <Layout title={title} lane={lane()}>
        <h1>{title}</h1>
        {digest ? <DigestTable digest={digest} /> : <p>night not found</p>}
      </Layout>,
      digest ? 200 : 404,
    );
  };
}
