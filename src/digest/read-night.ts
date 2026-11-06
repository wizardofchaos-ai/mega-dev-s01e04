import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

type RunEvent = {
  at: string;
  timestamp: number;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | undefined;
};

function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;

  const { at, job, status, owner, error } = value as Record<string, unknown>;
  if (typeof at !== 'string' || typeof job !== 'string' || job.length === 0) return null;
  if (status !== 'ok' && status !== 'retry' && status !== 'fail') return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;

  const timestamp = Date.parse(at);
  if (!Number.isFinite(timestamp)) return null;
  return { at, timestamp, job, status, owner, error };
}

function summarize(events: RunEvent[], badLines: number): NightDigest {
  const jobs = new Map<string, DigestRow>();
  const counts = { ok: 0, retry: 0, fail: 0 };
  // Sort by the actual instant while keeping the original offset in the output.
  for (const event of events.sort((left, right) => left.timestamp - right.timestamp)) {
    counts[event.status]++;
    const previous = jobs.get(event.job);
    jobs.set(event.job, {
      job: event.job,
      owner: event.owner,
      runs: (previous?.runs ?? 0) + 1,
      retries: (previous?.retries ?? 0) + Number(event.status === 'retry'),
      lastStatus: event.status,
      lastError: event.error ?? previous?.lastError ?? null,
      firstAt: previous?.firstAt ?? event.at,
      lastAt: event.at,
    });
  }
  const rows = [...jobs.values()].sort((left, right) => left.job.localeCompare(right.job, 'en'));
  return { rows, badLines, counts };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  const date = new Date(`${night}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== night) return null;

  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }

  // A final newline is a delimiter, whereas a blank line within the file is invalid.
  const lines = contents === '' ? [] : contents.replace(/\r?\n$/, '').split(/\r?\n/);
  const events: RunEvent[] = [];
  let badLines = 0;
  for (const line of lines) {
    const event = parseEvent(line);
    if (event) events.push(event);
    else badLines++;
  }
  return summarize(events, badLines);
};
