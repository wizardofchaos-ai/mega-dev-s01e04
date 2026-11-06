import { mkdtempSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const night = '2026-10-28';
const filename = `${night}.jsonl`;
const first = JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: 'zebra', status: 'ok', owner: 'sam' });
const second = JSON.stringify({ at: '2026-10-28T01:05:00+01:00', job: 'alpha', status: 'fail', owner: null });

describe('nightly digest routes', () => {
  let runsDir: string;

  beforeEach(() => {
    runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  });

  afterEach(() => {
    rmSync(join(runsDir, filename), { force: true });
    rmdirSync(runsDir);
  });

  function writeLog(lines: string[]) {
    writeFileSync(join(runsDir, filename), lines.join('\n'), 'utf8');
  }

  function requestDigest() {
    const app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
    return Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
  }

  it('returns the same jobs in alphabetical order in HTML and JSON', async () => {
    writeLog([first, second]);

    const [page, api] = await requestDigest();
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    const html = await page.text();
    expect(html).toMatch(/<td[^>]*>alpha<\/td>\s*<td[^>]*>—<\/td>/u);
    const pageJobs = [...html.matchAll(/<td[^>]*>(alpha|zebra)<\/td>/gu)].map((match) => match[1]);
    const rows = (await api.json()) as DigestRow[];
    expect(pageJobs).toEqual(rows.map(({ job }) => job));
    expect(rows.map(({ job, owner }) => ({ job, owner }))).toEqual([
      { job: 'alpha', owner: null },
      { job: 'zebra', owner: 'sam' },
    ]);
  });

  it('returns 404 from both routes when the night is missing', async () => {
    const [page, api] = await requestDigest();
    expect(page.status).toBe(404);
    expect(api.status).toBe(404);
  });

  it('returns an empty digest when the night file is empty', async () => {
    writeLog([]);

    const [page, api] = await requestDigest();
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(await api.json()).toEqual([]);
  });

  it('keeps valid jobs when the log contains a bad line', async () => {
    writeLog([first, '{broken', second]);

    const [page, api] = await requestDigest();
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    const html = await page.text();
    expect(html).toMatch(/<td[^>]*>alpha<\/td>/u);
    expect(html).toMatch(/<td[^>]*>zebra<\/td>/u);
    const rows = (await api.json()) as DigestRow[];
    expect(rows.map(({ job }) => job)).toEqual(['alpha', 'zebra']);
  });
});
