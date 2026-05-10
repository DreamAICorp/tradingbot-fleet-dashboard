/**
 * Zone 2 — table of all enabled champions. Click row → expand panel below.
 * Phase A: shows backtest expectations + 24h live aggregates.
 */

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { fleetApi, ChampionRow as Row } from '@/lib/api';
import ChampionRow from './ChampionRow';
import ChampionExpansion from './ChampionExpansion';

const REFRESH_MS = 15_000;

type SortKey = 'pnl_24h_usd' | 'win_rate_24h' | 'trades_ratio' | 'liq_distance_pct';

export default function ChampionTable() {
  const { data, error, isLoading } = useSWR<Row[]>(
    '/api/fleet/champions',
    fleetApi.champions,
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

  return (
    <section data-testid="champion-table">
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
    </section>
  );
}

const notice: React.CSSProperties = {
  padding: 24,
  background: 'var(--color-bg-elev)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  color: 'var(--color-text-dim)',
};

const sortable: React.CSSProperties = { cursor: 'pointer', userSelect: 'none' };
