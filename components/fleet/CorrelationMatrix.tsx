/**
 * Phase C — correlation matrix.
 *
 * Pairwise PnL-curve correlation between champions (Pearson rho on
 * equity-snapshot deltas). Bright cells = high correlation = ensemble
 * concentration risk. Diagonal is always 1.0.
 */

import useSWR from 'swr';
import { fleetApi, CorrelationPayload } from '@/lib/api';

export default function CorrelationMatrix() {
  const { data, error, isLoading } = useSWR<CorrelationPayload>(
    '/api/fleet/correlation',
    fleetApi.correlation,
    { refreshInterval: 5 * 60_000 },
  );

  if (isLoading) return <div style={notice}>loading correlation matrix…</div>;
  if (error) return <div style={{ ...notice, color: 'var(--color-neg)' }}>
    correlation unavailable: {String(error.message)}
  </div>;
  if (!data || data.champions.length < 2) {
    return <div style={notice}>
      need ≥2 active champions with overlapping trade history before
      correlation is meaningful.
    </div>;
  }

  // Build a map for O(1) cell lookup
  const cellMap = new Map<string, number>();
  for (const c of data.cells) {
    cellMap.set(`${c.a}|${c.b}`, c.rho);
    cellMap.set(`${c.b}|${c.a}`, c.rho);
  }

  return (
    <section data-testid="correlation-matrix">
      <h3 style={heading}>PnL correlation (Pearson rho)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 'auto' }}>
          <thead>
            <tr>
              <th></th>
              {data.champions.map((c) => (
                <th key={c} style={{ minWidth: 80, fontSize: 10 }}>
                  {shortLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.champions.map((rowKey) => (
              <tr key={rowKey}>
                <td style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>
                  {shortLabel(rowKey)}
                </td>
                {data.champions.map((colKey) => {
                  const rho =
                    rowKey === colKey ? 1.0 :
                    cellMap.get(`${rowKey}|${colKey}`) ?? null;
                  return <RhoCell key={colKey} rho={rho} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RhoCell({ rho }: { rho: number | null }) {
  if (rho === null) {
    return <td style={{ background: 'var(--color-bg-row)', color: 'var(--color-text-mute)', textAlign: 'center' }}>—</td>;
  }
  // Map rho ∈ [-1, 1] to color: -1 = green (anti-correlated), 0 = neutral, +1 = red (concentration)
  const t = (rho + 1) / 2; // 0..1
  const r = Math.round(38 + (248 - 38) * t);
  const g = Math.round(166 + (81 - 166) * t);
  const b = Math.round(154 + (73 - 154) * t);
  const intensity = Math.abs(rho);
  return (
    <td
      data-testid={`rho-cell-${rho.toFixed(2)}`}
      title={`rho=${rho.toFixed(3)}`}
      style={{
        background: `rgba(${r}, ${g}, ${b}, ${0.15 + 0.5 * intensity})`,
        textAlign: 'center',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        fontWeight: Math.abs(rho) > 0.7 ? 600 : 400,
      }}
    >
      {rho.toFixed(2)}
    </td>
  );
}

function shortLabel(championId: string): string {
  // multi_tf_rsi_confluence_nilusdt_x50 → NIL x50
  const m = championId.match(/^(.+?)_([a-z0-9]+usdt)_x(\d+)$/i);
  if (!m) return championId.slice(0, 14);
  const sym = m[2].toUpperCase().replace('USDT', '');
  return `${sym} x${m[3]}`;
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
