/**
 * Zone 1 — fleet-wide rolling-window summary, always visible at the top.
 *
 * Pulls /api/fleet/overview once + refreshes every 30s. Window cells are
 * inert (display only); window selection is implied by the constant 6-cell
 * row showing all of 1d/7d/30d/60d/90d/1yr at once.
 */

import useSWR from 'swr';
import { fleetApi, FleetOverview, Window } from '@/lib/api';
import { fmtUsd, fmtPct, fmtCount, fmtAgo } from '@/lib/format';

const WINDOWS: Window[] = ['1d', '7d', '30d', '60d', '90d', '1yr'];
const REFRESH_MS = 30_000;

export default function FleetHeader() {
  const { data, error, isLoading } = useSWR<FleetOverview>(
    '/api/fleet/overview',
    fleetApi.overview,
    { refreshInterval: REFRESH_MS },
  );

  if (isLoading) {
    return <div style={skeleton}>loading fleet overview…</div>;
  }
  if (error || !data) {
    return (
      <div style={{ ...skeleton, color: 'var(--color-neg)' }}>
        fleet overview unavailable: {String(error?.message ?? 'no data')}
      </div>
    );
  }

  return (
    <section
      data-testid="fleet-header"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 8,
        marginBottom: 16,
      }}
    >
      {WINDOWS.map((w) => {
        const cell = data.windows?.[w];
        if (!cell) {
          return (
            <div key={w} style={cellStyle}>
              <div style={cellLabel}>{w}</div>
              <div style={cellValueMute}>—</div>
            </div>
          );
        }
        const pos = cell.pnl_usd >= 0;
        return (
          <div key={w} style={cellStyle} data-testid={`window-${w}`}>
            <div style={cellLabel}>
              {w} · {fmtCount(cell.n_trades)} trades
              {cell.win_rate !== null ? ` · WR ${fmtPct(cell.win_rate * 100, 0)}` : ''}
            </div>
            <div
              style={{
                ...cellValue,
                color: pos ? 'var(--color-pos)' : 'var(--color-neg)',
              }}
            >
              {fmtUsd(cell.pnl_usd, { sign: true })}
            </div>
            <div style={cellSub}>
              fees {fmtUsd(cell.fees_usd)}
            </div>
          </div>
        );
      })}

      <div style={{ ...cellStyle, gridColumn: 'span 6' }}>
        <span style={cellLabel}>fleet</span>
        <span style={{ marginLeft: 12 }}>
          <span className="muted">champions:</span>{' '}
          <strong>
            {data.champions_active}/{data.champions_total}
          </strong>
        </span>
        <span style={{ marginLeft: 12 }}>
          <span className="muted">drift:</span>{' '}
          <strong style={{ color: data.drift_pct > 30 ? 'var(--color-neg)' : 'var(--color-pos)' }}>
            {fmtPct(data.drift_pct, 0)}
          </strong>
        </span>
        <span style={{ marginLeft: 12 }}>
          <span className="muted">last tick:</span>{' '}
          {fmtAgo(data.last_tick_ts)}
        </span>
      </div>
    </section>
  );
}

const cellStyle: React.CSSProperties = {
  background: 'var(--color-bg-elev)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: '8px 12px',
};

const cellLabel: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--color-text-mute)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const cellValue: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  marginTop: 2,
};

const cellValueMute: React.CSSProperties = {
  ...cellValue,
  color: 'var(--color-text-mute)',
};

const cellSub: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--color-text-dim)',
  marginTop: 2,
};

const skeleton: React.CSSProperties = {
  padding: 16,
  background: 'var(--color-bg-elev)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  marginBottom: 16,
  color: 'var(--color-text-dim)',
};
