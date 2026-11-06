export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  rows: DigestRow[];
  badLines: number;
  counts: Record<RunStatus, number>;
};

// A missing night returns null. An empty file returns a digest with zero rows.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
