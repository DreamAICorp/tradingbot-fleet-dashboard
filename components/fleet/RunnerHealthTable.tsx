/**
 * Phase C — WS-gap / NRestarts panel.
 *
 * Surfaces runner-level instability that's currently invisible:
 *   - systemd NRestarts count per unit (N>3 = unstable runner)
 *   - WebSocket reconnect count over last 24h (stale price feed risk)
 *   - last-tick age in seconds
 *   - active_since (when did the unit last restart)
 *
 * Reads /api/fleet/runner-health which the backend computes from
 * `journalctl --output=json` over the unit + the runner's WS heartbeat
 * counters in paper_signal_checks.
 */

import useSWR from 'swr';
import { fleetApi, RunnerHealthPayload, RunnerHealthRow } from '@/lib/api';
import { fmtAgo, fmtCount } from '@/lib/format';

export default function RunnerHealthTable() {
  const { data, error, isLoading } = useSWR<RunnerHealthPayload>(
    '/api/fleet/runner-health',
    fleetApi.runnerHealth,
    { refreshInterval: 60_000 },
  );

  if (isLoading) return <div style={notice}>loading runner health…</div>;
  if (error) return <div style={{ ...notice, color: 'var(--color-neg)' }}>
    runner health unavailable: {String(error.message)}
  </div>;
  if (!data || data.rows.length === 0) {
    return <div style={notice}>no runner-health data yet.</div>;
  }

  return (
    <section data-testid="runner-health">
      <h3 style={heading}>Runner health · WebSocket gaps + NRestarts</h3>
      <table>
        <thead>
          <tr>
            <th>Champion</th>
            <th>Unit</th>
            <th>NRestarts</th>
            <th>WS reconnects 24h</th>
            <th>Last tick</th>
            <th>Active since</th>
          </tr>
        </thead>
        <tbody>
          {data.rows
            .slice()
            .sort((a, b) => (b.n_restarts - a.n_restarts) || (b.ws_reconnects_24h - a.ws_reconnects_24h))
            .map((r) => <Row key={r.champion_id} row={r} />)}
        </tbody>
      </table>
    </section>
  );
}

function Row({ row }: { row: RunnerHealthRow }) {
  const restartColor =
    row.n_restarts >= 5  ? 'var(--color-neg)'
    : row.n_restarts >= 1 ? 'var(--color-warn)'
    :                       'inherit';
  const wsColor =
    row.ws_reconnects_24h >= 10 ? 'var(--color-neg)'
    : row.ws_reconnects_24h >= 3  ? 'var(--color-warn)'
    :                              'inherit';
  const tickStale =
    row.last_tick_age_sec === null      ? 'var(--color-text-mute)'
    : row.last_tick_age_sec > 600       ? 'var(--color-neg)'
    : row.last_tick_age_sec > 120       ? 'var(--color-warn)'
    :                                    'var(--color-pos)';

  return (
    <tr data-testid={`runner-health-${row.champion_id}`}>
      <td>{row.champion_id}</td>
      <td style={{ color: 'var(--color-text-dim)' }}>{row.unit}</td>
      <td className="numeric" style={{ color: restartColor, fontWeight: row.n_restarts >= 5 ? 600 : 400 }}>
        {fmtCount(row.n_restarts)}
      </td>
      <td className="numeric" style={{ color: wsColor }}>
        {fmtCount(row.ws_reconnects_24h)}
      </td>
      <td className="numeric" style={{ color: tickStale }}>
        {row.last_tick_age_sec !== null ? `${row.last_tick_age_sec}s` : '—'}
      </td>
      <td style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
        {row.active_since ? fmtAgo(row.active_since) : '—'}
      </td>
    </tr>
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
