/**
 * Zone 3 — expansion panel for one champion. 4 tabs.
 *
 * Phase A ships Tab A (drift compare) + Tab D (logs).
 * Tabs B/C show "coming in Phase B" cards rather than empty/broken UI.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { fleetApi, DriftCompare, LogLine } from '@/lib/api';
import DriftStatRow from './DriftStatRow';
import BacktestLiveChart from './BacktestLiveChart';
import BrokerPositionPanel from './BrokerPositionPanel';
import EdgeAttributionChart from './EdgeAttributionChart';
import QuietHoursHeatmap from './QuietHoursHeatmap';

type Tab = 'compare' | 'chart' | 'broker' | 'decisions' | 'edge' | 'hours';

interface Props {
  championId: string;
}

export default function ChampionExpansion({ championId }: Props) {
  const [tab, setTab] = useState<Tab>('compare');

  return (
    <div
      data-testid={`champion-expansion-${championId}`}
      style={{
        background: 'var(--color-bg-elev)',
        border: '1px solid var(--color-border)',
        borderTop: 'none',
        borderRadius: '0 0 var(--radius) var(--radius)',
        padding: 12,
      }}
    >
      <nav style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(
          [
            ['compare',   'Drift compare'],
            ['chart',     'Backtest vs live'],
            ['broker',    'Broker position'],
            ['decisions', 'Decisions + logs'],
            ['edge',      'Edge attribution'],
            ['hours',     'Hourly fire pattern'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            data-testid={`tab-${key}`}
            style={{
              borderColor: tab === key ? 'var(--color-accent)' : 'var(--color-border)',
              color: tab === key ? 'var(--color-accent)' : 'inherit',
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'compare'   && <CompareTab id={championId} />}
      {tab === 'chart'     && <BacktestLiveChart championId={championId} />}
      {tab === 'broker'    && <BrokerPositionPanel championId={championId} />}
      {tab === 'decisions' && <DecisionsLogsTab id={championId} />}
      {tab === 'edge'      && <EdgeAttributionChart championId={championId} />}
      {tab === 'hours'     && <QuietHoursHeatmap championId={championId} />}
    </div>
  );
}

function CompareTab({ id }: { id: string }) {
  const { data, error, isLoading } = useSWR<DriftCompare>(
    `/api/fleet/champions/${id}/compare`,
    () => fleetApi.compare(id),
    { refreshInterval: 30_000 },
  );
  if (isLoading) return <div className="muted">loading drift compare…</div>;
  if (error || !data) {
    return <div style={{ color: 'var(--color-neg)' }}>compare unavailable: {String(error?.message ?? 'no data')}</div>;
  }
  return (
    <div>
      <div className="muted" style={{ marginBottom: 6, fontSize: 12 }}>
        sample size (live trades): <strong>{data.sample_size}</strong>
        {data.sample_size < 30 && (
          <span style={{ marginLeft: 8, color: 'var(--color-warn)' }}>
            — small sample, treat all live numbers as noisy until n ≥ 30
          </span>
        )}
      </div>
      {data.pair_variant_id && (
        <div
          className="muted"
          style={{ marginTop: 4, marginBottom: 6, fontSize: 12 }}
          data-testid="compare-pair-badge"
        >
          paired with <strong>{data.pair_variant_id}</strong>
          {data.sample_size_no_filter !== null && (
            <> — sample size (no filter): <strong>{data.sample_size_no_filter}</strong></>
          )}
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Backtest</th>
            <th>Simulation</th>
            <th>Live</th>
            <th>Δ (live vs backtest)</th>
            {data.pair_variant_id && (
              <>
                <th>Live (no filter)</th>
                <th>Δ (no-filter vs backtest)</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {data.metrics.map((m) => (
            <DriftStatRow
              key={m.name}
              name={m.name}
              backtest={m.backtest}
              simulation={m.simulation}
              live={m.live}
              deltaPct={m.delta_pct}
              unit={m.unit}
              {...(data.pair_variant_id
                ? {
                    liveNoFilter: m.live_no_filter,
                    deltaPctNoFilter: m.delta_pct_no_filter,
                  }
                : {})}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DecisionsLogsTab({ id }: { id: string }) {
  const { data, error, isLoading } = useSWR<LogLine[]>(
    `/api/fleet/champions/${id}/logs?lines=200`,
    () => fleetApi.logs(id, 200, 'INFO'),
    { refreshInterval: 5_000 },
  );
  if (isLoading) return <div className="muted">loading logs…</div>;
  if (error)     return <div style={{ color: 'var(--color-neg)' }}>logs unavailable: {String(error.message)}</div>;
  if (!data || data.length === 0) {
    return <div className="muted">no recent log lines.</div>;
  }
  return (
    <div
      style={{
        maxHeight: 320,
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 12,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 'var(--radius-sm)',
        padding: 8,
      }}
    >
      {data.map((line, i) => (
        <div key={i} data-level={line.level} style={{
          color:
            line.level === 'ERROR' || line.level === 'CRITICAL' ? 'var(--color-neg)'
            : line.level === 'WARNING' ? 'var(--color-warn)'
            : 'var(--color-text)',
          whiteSpace: 'pre',
        }}>
          {new Date(line.ts).toISOString().replace('T', ' ').slice(0, 19)} [{line.level}] {line.message}
        </div>
      ))}
    </div>
  );
}

