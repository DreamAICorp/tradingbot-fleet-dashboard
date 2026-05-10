/**
 * Single row in Tab A "drift compare" table.
 *
 * Shows Backtest / Simulation / Live for one metric, plus a colored Δ cell
 * computed as (live - backtest) / |backtest|. The visceral cell — operator
 * sees immediately which axis of the strategy is bleeding (over-firing,
 * fee-bound, low WR, high liq).
 *
 * Phase A: backtest+live only (simulation is "—" until Phase B replay ships).
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
}

function formatVal(v: number | null, unit: Unit): string {
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

export default function DriftStatRow({ name, backtest, simulation, live, deltaPct, unit }: Props) {
  const bucket = deltaPct !== null ? driftBucket(deltaPct) : null;
  const deltaColor = bucket ? colorByBucket[bucket] : 'var(--color-text-mute)';
  const deltaText  =
    deltaPct === null ? '—'
    : (deltaPct > 0 ? '+' : '') + deltaPct.toFixed(0) + '%';

  return (
    <tr data-testid={`drift-row-${name}`} data-bucket={bucket ?? 'none'}>
      <td style={{ color: 'var(--color-text-dim)' }}>{name}</td>
      <td className="numeric">{formatVal(backtest, unit)}</td>
      <td className="numeric">{formatVal(simulation, unit)}</td>
      <td className="numeric">{formatVal(live, unit)}</td>
      <td
        className="numeric"
        style={{
          color: deltaColor,
          fontWeight: bucket === 'red' ? 600 : 400,
        }}
        data-testid={`drift-delta-${name}`}
      >
        {deltaText}
      </td>
    </tr>
  );
}
