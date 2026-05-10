/**
 * Display helpers for the dashboard. Tabular-numeric font is set at the .numeric
 * CSS class level — these helpers only return strings.
 */

export function fmtUsd(v: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const sign = opts.sign && v > 0 ? '+' : '';
  const abs = Math.abs(v);
  const fmt =
    abs >= 1_000_000 ? abs.toFixed(0)
    : abs >= 1_000   ? abs.toFixed(1)
    : abs >= 1       ? abs.toFixed(2)
    :                  abs.toFixed(4);
  return `${sign}${v < 0 ? '-' : ''}$${fmt.replace('-', '')}`;
}

export function fmtPct(v: number | null | undefined, digits = 1, opts: { sign?: boolean } = {}): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const sign = opts.sign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

export function fmtCount(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
}

/** "4s ago", "12m ago", "3h ago", "2d ago" — no library, no Date.now mocking pain. */
export function fmtAgo(tsMs: number | null | undefined, nowMs: number = Date.now()): string {
  if (!tsMs) return '—';
  const sec = Math.max(0, Math.floor((nowMs - tsMs) / 1000));
  if (sec < 60)  return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m ago`;
  const hr  = Math.floor(min / 60);
  if (hr  < 24)  return `${hr}h ago`;
  const d   = Math.floor(hr / 24);
  return `${d}d ago`;
}

/** Map deviation pct to a bucket the DriftStatRow component colors. */
export function driftBucket(deltaPct: number): 'green' | 'yellow' | 'red' {
  const a = Math.abs(deltaPct);
  if (a < 10) return 'green';
  if (a < 30) return 'yellow';
  return 'red';
}
