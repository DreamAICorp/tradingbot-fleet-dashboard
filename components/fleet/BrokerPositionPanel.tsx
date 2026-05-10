/**
 * Tab C — live broker position (Phase B).
 *
 * Reads /api/fleet/champions/{id}/broker-position. Renders entry / mark /
 * unrealized PnL / liq distance with the same color rules as the row's
 * compact liq cell. When `available: false`, renders a clean "venue
 * client not yet implemented" notice instead of fake zeros.
 */

import useSWR from 'swr';
import { fleetApi, BrokerPosition } from '@/lib/api';
import { fmtUsd, fmtPct } from '@/lib/format';

interface Props {
  championId: string;
}

export default function BrokerPositionPanel({ championId }: Props) {
  const { data, error, isLoading } = useSWR<BrokerPosition>(
    `/api/fleet/champions/${championId}/broker-position`,
    () => fleetApi.brokerPosition(championId),
    { refreshInterval: 5_000 },
  );

  if (isLoading) return <div style={notice}>loading broker position…</div>;
  if (error) {
    return (
      <div style={{ ...notice, color: 'var(--color-neg)' }}>
        broker position unavailable: {String(error.message)}
      </div>
    );
  }
  if (!data) return null;

  if (!data.available) {
    return (
      <div style={notice}>
        <div style={{ fontSize: 13, marginBottom: 4 }}>
          {data.venue} client not connected for {data.symbol}.
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
          Phase B wires Weex + BloFin read-only position fetch. Until then,
          consult the Tab A drift compare against paper-mode aggregates.
        </div>
      </div>
    );
  }

  if (!data.side) {
    return (
      <div style={notice}>
        no open position on {data.venue}/{data.symbol}.
        <span style={{ color: 'var(--color-text-dim)' }}>
          {' '}— flat. Last fetch {Math.round((Date.now() - data.fetched_at) / 1000)}s ago.
        </span>
      </div>
    );
  }

  const pnlColor = (data.unrealized_pnl ?? 0) >= 0 ? 'var(--color-pos)' : 'var(--color-neg)';
  const liqColor =
    data.liq_distance_pct === null      ? 'var(--color-text-mute)'
    : data.liq_distance_pct < 30        ? 'var(--color-neg)'
    : data.liq_distance_pct < 50        ? 'var(--color-warn)'
    :                                    'var(--color-pos)';

  return (
    <div data-testid={`broker-position-${championId}`}>
      <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--color-text-dim)' }}>
        venue: <strong>{data.venue}</strong> · {data.symbol} · last fetch{' '}
        {Math.round((Date.now() - data.fetched_at) / 1000)}s ago
      </div>
      <table>
        <tbody>
          <tr>
            <td style={{ width: 160, color: 'var(--color-text-dim)' }}>side</td>
            <td className="numeric" style={{ fontWeight: 600 }}>
              {data.side?.toUpperCase()}
            </td>
          </tr>
          <tr>
            <td className="muted">entry</td>
            <td className="numeric">{fmtUsd(data.entry)}</td>
          </tr>
          <tr>
            <td className="muted">mark</td>
            <td className="numeric">{fmtUsd(data.mark)}</td>
          </tr>
          <tr>
            <td className="muted">size (USD)</td>
            <td className="numeric">{fmtUsd(data.size)}</td>
          </tr>
          <tr>
            <td className="muted">unrealized PnL</td>
            <td className="numeric" style={{ color: pnlColor, fontWeight: 600 }}>
              {fmtUsd(data.unrealized_pnl, { sign: true })}
            </td>
          </tr>
          <tr>
            <td className="muted">liquidation price</td>
            <td className="numeric">{fmtUsd(data.liq_price)}</td>
          </tr>
          <tr>
            <td className="muted">liq distance</td>
            <td className="numeric" style={{ color: liqColor, fontWeight: 600 }}>
              {data.liq_distance_pct !== null ? fmtPct(data.liq_distance_pct, 1) : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const notice: React.CSSProperties = {
  padding: 16,
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border-2)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text)',
};
