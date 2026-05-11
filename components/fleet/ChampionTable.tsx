/**
 * Zone 2 — table of all enabled champions. Click row → expand panel below.
 * Phase A: shows backtest expectations + 24h live aggregates.
 */

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { fleetApi, ChampionRow as Row } from '@/lib/api';
import ChampionRow from './ChampionRow';
import ChampionExpansion from './ChampionExpansion';
import PairView from './PairView';

const REFRESH_MS = 15_000;

type SortKey = 'pnl_24h_usd' | 'win_rate_24h' | 'trades_ratio' | 'liq_distance_pct';
type ViewMode = 'flat' | 'pair';

export default function ChampionTable() {
  const [viewMode, setViewMode] = useState<ViewMode>('flat');
  // include_variants=true whenever the operator might want to see siblings:
  // pair view needs both halves to render a row; flat view shows them all
  // sequentially. Keeps a single SWR cache key per mode.
  const { data, error, isLoading } = useSWR<Row[]>(
    `/api/fleet/champions?variants=${viewMode}`,
    () => fleetApi.champions(viewMode === 'pair' || viewMode === 'flat'),
    { refreshInterval: REFRESH_MS },
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('pnl_24h_usd');
  const [sortDesc, setSortDesc] = useState(true);

  const rows = useMemo(() => {
    if (!data) return [];
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return sortDesc ? Number(bv) - Number(av) : Number(av) - Number(bv);
    });
    return copy;
  }, [data, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  if (isLoading) {
    return <div style={notice}>loading champions…</div>;
  }
  if (error) {
    return (
      <div style={{ ...notice, color: 'var(--color-neg)' }}>
        champions unavailable: {String(error?.message ?? 'no data')}
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div style={notice}>
        no champions enabled yet. Once units in <code>deploy/auto/</code> are
        installed and the runners write to <code>paper_unified.db</code>,
        rows appear here automatically.
      </div>
    );
  }

  // Sprint S1 — count canonical (non-_nofilter) rows for the toggle label.
  const canonicalCount = rows.filter((r) => !r.champion_id.endsWith('_nofilter')).length;

  return (
    <section data-testid="champion-table">
      <div style={toggleBar} data-testid="view-toggle">
        <button
          onClick={() => setViewMode('flat')}
          data-testid="toggle-flat"
          aria-pressed={viewMode === 'flat'}
          style={toggleBtn(viewMode === 'flat')}
        >
          Flat list ({rows.length})
        </button>
        <button
          onClick={() => setViewMode('pair')}
          data-testid="toggle-pair"
          aria-pressed={viewMode === 'pair'}
          style={toggleBtn(viewMode === 'pair')}
        >
          Pair view ({canonicalCount})
        </button>
      </div>

      {viewMode === 'pair' ? (
        <PairView
          rows={rows}
          onSelect={(id) => {
            // Pair-cell click expands the underlying flat row in the
            // legacy table — switch to flat mode + open that row so the
            // operator drills into the canonical drift panel.
            setViewMode('flat');
            setExpandedId(id);
          }}
        />
      ) : (
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Champion</th>
              <th>Status</th>
              <th onClick={() => toggleSort('pnl_24h_usd')} style={sortable} data-testid="th-pnl">
                PnL 24h {sortKey === 'pnl_24h_usd' ? (sortDesc ? '↓' : '↑') : ''}
              </th>
              <th>24h trend</th>
              <th onClick={() => toggleSort('win_rate_24h')} style={sortable}>
                WR 24h {sortKey === 'win_rate_24h' ? (sortDesc ? '↓' : '↑') : ''}
              </th>
              <th>Fees / gross</th>
              <th onClick={() => toggleSort('trades_ratio')} style={sortable}>
                Actual / contract {sortKey === 'trades_ratio' ? (sortDesc ? '↓' : '↑') : ''}
              </th>
              <th onClick={() => toggleSort('liq_distance_pct')} style={sortable}>
                Liq dist {sortKey === 'liq_distance_pct' ? (sortDesc ? '↓' : '↑') : ''}
              </th>
              <th>Last tick</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((r) => {
              const isOpen = expandedId === r.champion_id;
              const tr = (
                <ChampionRow
                  key={`row-${r.champion_id}`}
                  row={r}
                  expanded={isOpen}
                  onToggle={() => setExpandedId(isOpen ? null : r.champion_id)}
                />
              );
              if (!isOpen) return [tr];
              return [
                tr,
                <tr key={`exp-${r.champion_id}`}>
                  <td colSpan={10} style={{ padding: 0 }}>
                    <ChampionExpansion championId={r.champion_id} />
                  </td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

const toggleBar: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 8,
};

function toggleBtn(active: boolean): React.CSSProperties {
  return {
    cursor: 'pointer',
    padding: '4px 10px',
    fontSize: 12,
    background: active ? 'var(--color-bg-elev)' : 'transparent',
    color: active ? 'var(--color-accent)' : 'var(--color-text-dim)',
    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius-sm)',
  };
}

const notice: React.CSSProperties = {
  padding: 24,
  background: 'var(--color-bg-elev)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  color: 'var(--color-text-dim)',
};

const sortable: React.CSSProperties = { cursor: 'pointer', userSelect: 'none' };
