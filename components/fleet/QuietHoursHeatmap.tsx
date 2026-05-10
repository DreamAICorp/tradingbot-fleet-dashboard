/**
 * Phase C — quiet-hours / firing-pattern heatmap.
 *
 * 24-cell per-hour grid showing when a champion fires trades. If a
 * contract says 5/day but they all bunch in 1 hour, that's a regime-tied
 * edge that won't generalize. Helps catch "lucky session" champions
 * that should be rebuild-baselined against more diverse market hours.
 */

import useSWR from 'swr';
import { fleetApi, QuietHoursPayload } from '@/lib/api';

interface Props {
  championId: string;
}

export default function QuietHoursHeatmap({ championId }: Props) {
  const { data, error, isLoading } = useSWR<QuietHoursPayload>(
    `/api/fleet/champions/${championId}/quiet-hours`,
    () => fleetApi.quietHours(championId),
    { refreshInterval: 5 * 60_000 },
  );

  if (isLoading) return <div style={notice}>loading quiet-hours heatmap…</div>;
  if (error) return <div style={{ ...notice, color: 'var(--color-neg)' }}>
    quiet hours unavailable: {String(error.message)}
  </div>;
  if (!data || data.cells.length !== 24) {
    return <div style={notice}>not enough trades yet for hourly distribution.</div>;
  }

  const max = Math.max(...data.cells.map((c) => c.n_trades), 1);
  const expected = data.expected_per_hour;

  return (
    <section data-testid="quiet-hours">
      <h3 style={heading}>
        Hourly fire pattern (UTC) · expected ≈ {expected.toFixed(2)}/h
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2, fontSize: 10 }}>
        {data.cells.map((c) => {
          const t = c.n_trades / max;
          const overFire = expected > 0 && c.n_trades > expected * 4;
          const r = overFire ? 248 : 38;
          const g = overFire ? 81  : 166;
          const b = overFire ? 73  : 154;
          return (
            <div
              key={c.hour_utc}
              data-testid={`hour-${c.hour_utc}`}
              title={`${c.hour_utc}:00 UTC — ${c.n_trades} trades, PnL ${c.pnl_usd.toFixed(2)}`}
              style={{
                background: `rgba(${r}, ${g}, ${b}, ${0.15 + 0.7 * t})`,
                border: '1px solid var(--color-border-2)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 2px',
                textAlign: 'center',
              }}
            >
              <div style={{ color: 'var(--color-text-dim)', fontSize: 9 }}>
                {c.hour_utc}
              </div>
              <div className="numeric" style={{ fontWeight: 600 }}>
                {c.n_trades}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 6 }}>
        bright red = &gt;4× expected per-hour rate (regime-tied edge candidate)
      </div>
    </section>
  );
}

const heading: React.CSSProperties = {
  fontSize: 13,
  margin: '0 0 8px 0',
  color: 'var(--color-text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const notice: React.CSSProperties = {
  padding: 16,
  background: 'var(--color-bg-elev)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  color: 'var(--color-text-dim)',
};
