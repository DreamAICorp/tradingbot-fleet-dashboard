/**
 * Phase C — liquidation-proximity heatmap.
 *
 * One cell per open position, colored by remaining liq budget.
 * Bright red = within 1× of liq, deep green = at entry. Catches
 * "we're 1 candle from a wipeout" faster than per-position drill-in.
 */

import useSWR from 'swr';
import { fleetApi, LiqHeatmapPayload, OpenPositionRow } from '@/lib/api';
import { fmtUsd, fmtPct } from '@/lib/format';

export default function LiqHeatmap() {
  const { data, error, isLoading } = useSWR<LiqHeatmapPayload>(
    '/api/fleet/liq-heatmap',
    fleetApi.liqHeatmap,
    { refreshInterval: 5_000 },
  );

  if (isLoading) return <div style={notice}>loading liquidation heatmap…</div>;
  if (error) return <div style={{ ...notice, color: 'var(--color-neg)' }}>
    liq heatmap unavailable: {String(error.message)}
  </div>;
  if (!data || data.positions.length === 0) {
    return <div style={notice}>no open positions across the fleet — nothing to liquidate.</div>;
  }

  return (
    <section data-testid="liq-heatmap">
      <h3 style={heading}>Liquidation proximity ({data.positions.length} open)</h3>
      <div style={grid}>
        {data.positions
          .slice()
          .sort((a, b) => a.liq_distance_pct - b.liq_distance_pct)
          .map((p) => <LiqCell key={p.champion_id} pos={p} />)}
      </div>
    </section>
  );
}

function LiqCell({ pos }: { pos: OpenPositionRow }) {
  const t = Math.max(0, Math.min(100, pos.liq_distance_pct)) / 100;
  // Lerp red→yellow→green as t goes 0→1
  const r = Math.round(248 * (1 - t) + 38 * t);
  const g = Math.round(81 + (200 - 81) * t);
  const b = Math.round(73 + (160 - 73) * t);
  const bg = `rgba(${r}, ${g}, ${b}, 0.20)`;
  const border = `rgba(${r}, ${g}, ${b}, 0.6)`;
  const pnlColor = pos.unrealized_pnl_usd >= 0 ? 'var(--color-pos)' : 'var(--color-neg)';

  return (
    <div
      data-testid={`liq-cell-${pos.champion_id}`}
      style={{
        padding: 8,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-sm)',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>{pos.symbol}</strong>
        <span style={{ color: 'var(--color-text-dim)' }}>x{pos.leverage} {pos.side}</span>
      </div>
      <div className="numeric" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
        {fmtPct(pos.liq_distance_pct, 1)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
        entry {fmtUsd(pos.entry)} · mark {fmtUsd(pos.mark)} · liq {fmtUsd(pos.liq_price)}
      </div>
      <div className="numeric" style={{ fontSize: 12, color: pnlColor, marginTop: 2 }}>
        uPnL {fmtUsd(pos.unrealized_pnl_usd, { sign: true })}
      </div>
    </div>
  );
}

const heading: React.CSSProperties = {
  fontSize: 13,
  margin: '0 0 8px 0',
  color: 'var(--color-text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 8,
};

const notice: React.CSSProperties = {
  padding: 16,
  background: 'var(--color-bg-elev)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  color: 'var(--color-text-dim)',
};
