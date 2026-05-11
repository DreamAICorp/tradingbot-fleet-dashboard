/**
 * Single row in Tab A "drift compare" table.
 *
 * Shows Backtest / Simulation / Live for one metric, plus a colored Δ cell
 * computed as (live - backtest) / |backtest|. The visceral cell — operator
 * sees immediately which axis of the strategy is bleeding (over-firing,
 * fee-bound, low WR, high liq).
 *
 * Phase A: backtest+live only (simulation is "—" until Phase B replay ships).
 * Sprint S1: when liveNoFilter is provided, a 4th "Live (no filter)" data
 * column + its own Δ cell render — apples-to-apples view against the
 * _nofilter shadow runner. Both Δs are colored independently so the
 * operator sees which filter setting bleeds more for each metric.
 */

import { driftBucket, fmtPct, fmtCount, fmtUsd } from '@/lib/format';

export type Unit = 'pct' | 'count' | 'usd' | 'ratio';

interface Props {
  name: string;
  backtest: number | null;
  simulation: number | null;
  live: number | null;
  deltaPct: number | null;
  unit: Unit;
  /** S1 — same metric value computed on the _nofilter sibling runner. */
  liveNoFilter?: number | null;
  /** S1 — (liveNoFilter - backtest) / backtest, mirrors deltaPct. */
  deltaPctNoFilter?: number | null;
}

function formatVal(v: number | null | undefined, unit: Unit): string {
  if (v === null || v === undefined) return '—';
  switch (unit) {
    case 'pct':   return fmtPct(v, 2);
    case 'count': return fmtCount(v);
    case 'usd':   return fmtUsd(v);
    case 'ratio': return v.toFixed(2);
  }
}

const colorByBucket = {
  green:  'var(--color-pos)',
  yellow: 'var(--color-warn)',
  red:    'var(--color-neg)',
} as const;

function deltaCell(deltaPct: number | null | undefined, testId: string) {
  const bucket = deltaPct !== null && deltaPct !== undefined ? driftBucket(deltaPct) : null;
  const color  = bucket ? colorByBucket[bucket] : 'var(--color-text-mute)';
  const text   =
    deltaPct === null || deltaPct === undefined
      ? '—'
      : (deltaPct > 0 ? '+' : '') + deltaPct.toFixed(0) + '%';
  return { bucket, color, text, testId };
}

export default function DriftStatRow({
  name,
  backtest,
  simulation,
  live,
  deltaPct,
  unit,
  liveNoFilter,
  deltaPctNoFilter,
}: Props) {
  const left  = deltaCell(deltaPct, `drift-delta-${name}`);
  // Render the no-filter columns only when the caller actually supplies a
  // sibling value (paired mode). undefined skips the 4th col, null shows it
  // as "—" so the column stays aligned across rows when SOME have data.
  const paired = liveNoFilter !== undefined || deltaPctNoFilter !== undefined;
  const right = paired
    ? deltaCell(deltaPctNoFilter, `drift-delta-nofilter-${name}`)
    : null;

  return (
    <tr
      data-testid={`drift-row-${name}`}
      data-bucket={left.bucket ?? 'none'}
      data-bucket-nofilter={right?.bucket ?? 'none'}
    >
      <td style={{ color: 'var(--color-text-dim)' }}>{name}</td>
      <td className="numeric">{formatVal(backtest, unit)}</td>
      <td className="numeric">{formatVal(simulation, unit)}</td>
      <td className="numeric">{formatVal(live, unit)}</td>
      <td
        className="numeric"
        style={{ color: left.color, fontWeight: left.bucket === 'red' ? 600 : 400 }}
        data-testid={left.testId}
      >
        {left.text}
      </td>
      {paired && (
        <>
          <td
            className="numeric"
            data-testid={`drift-live-nofilter-${name}`}
          >
            {formatVal(liveNoFilter, unit)}
          </td>
          <td
            className="numeric"
            style={{ color: right!.color, fontWeight: right!.bucket === 'red' ? 600 : 400 }}
            data-testid={right!.testId}
          >
            {right!.text}
          </td>
        </>
      )}
    </tr>
  );
}
