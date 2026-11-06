import { mkdtempSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read-night.js';

describe('nightly run reader', () => {
  it('groups the sample night, keeps the row without an owner and counts its malformed line', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest?.badLines).toBe(1);
    expect(digest?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(digest?.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(digest?.rows[0]?.owner).toBeNull();
    expect(digest?.rows[1]).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(digest?.rows[3]).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('distinguishes a missing night from an empty file and rejects an invalid date', () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-reader-'));
    try {
      writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
      expect(readNight(runsDir, '2026-10-28')).toEqual({
        rows: [],
        badLines: 0,
        counts: { ok: 0, retry: 0, fail: 0 },
      });
      expect(readNight(runsDir, '2026-10-27')).toBeNull();
      expect(readNight(runsDir, '2026-02-30')).toBeNull();
      expect(readNight(runsDir, '../2026-10-28')).toBeNull();
    } finally {
      rmSync(join(runsDir, '2026-10-28.jsonl'), { force: true });
      rmdirSync(runsDir);
    }
  });

  it('orders a job by the actual instant and counts a JSON object with an invalid shape', () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-reader-'));
    try {
      const firstAt = '2026-10-28T23:30:00+02:00';
      const lastAt = '2026-10-28T22:15:00Z';
      const lines = [
        { at: lastAt, job: 'sync', status: 'ok', owner: 'lane-07' },
        { at: firstAt, job: 'sync', status: 'retry', owner: null, error: 'lock held' },
        { at: lastAt, job: 'invalid', status: 'unknown', owner: null },
      ];
      writeFileSync(join(runsDir, '2026-10-28.jsonl'), lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
      expect(readNight(runsDir, '2026-10-28')).toEqual({
        rows: [{
          job: 'sync',
          owner: 'lane-07',
          runs: 2,
          retries: 1,
          lastStatus: 'ok',
          lastError: 'lock held',
          firstAt,
          lastAt,
        }],
        badLines: 1,
        counts: { ok: 1, retry: 1, fail: 0 },
      });
    } finally {
      rmSync(join(runsDir, '2026-10-28.jsonl'), { force: true });
      rmdirSync(runsDir);
    }
  });
});
