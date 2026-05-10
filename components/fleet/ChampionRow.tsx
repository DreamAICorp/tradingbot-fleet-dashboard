import { ChampionRow as Row } from '@/lib/api';
import { fmtUsd, fmtPct, fmtAgo } from '@/lib/format';
import StatusBadge from './StatusBadge';
import Sparkline from './Sparkline';

interface Props {
  row: Row;
  expanded: boolean;
  onToggle: () => void;
}

export default function ChampionRow({ row, expanded, onToggle }: Props) {
  const pnlColor = row.pnl_24h_usd >= 0 ? 'var(--color-pos)' : 'var(--color-neg)';
  const liqColor =
    row.liq_distance_pct === null      ? 'var(--color-text-mute)'
    : row.liq_distance_pct < 30        ? 'var(--color-neg)'
    : row.liq_distance_pct < 50        ? 'var(--color-warn)'
    :                                    'var(--color-pos)';

  return (
    <tr
      onClick={onToggle}
      data-testid={`champion-row-${row.champion_id}`}
      data-expanded={expanded}
      style={{ cursor: 'pointer' }}
    >
      <td style={{ width: 18 }} aria-hidden>{expanded ? '▾' : '▸'}</td>
      <td>
        <div style={{ fontWeight: 500 }}>{row.symbol}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-mute)' }}>
          {row.family} · {row.tf_label} · x{row.leverage}
        </div>
      </td>
      <td><StatusBadge status={row.status} /></td>
      <td className="numeric" style={{ color: pnlColor }}>
        {fmtUsd(row.pnl_24h_usd, { sign: true })}
      </td>
      <td><Sparkline data={row.pnl_24h_sparkline} /></td>
      <td className="numeric">
        {row.win_rate_24h !== null ? fmtPct(row.win_rate_24h * 100, 0) : '—'}
      </td>
      <td className="numeric" style={{
        color: row.fees_pct_24h !== null && row.fees_pct_24h > 50
          ? 'var(--color-neg)'
          : 'inherit',
      }}>
        {row.fees_pct_24h !== null ? fmtPct(row.fees_pct_24h, 0) : '—'}
      </td>
      <td className="numeric" style={{
        color: row.trades_ratio !== null && row.trades_ratio > 5
          ? 'var(--color-neg)'
          : row.trades_ratio !== null && row.trades_ratio > 2
          ? 'var(--color-warn)'
          : 'inherit',
      }}>
        {row.trades_ratio !== null ? `${row.trades_ratio.toFixed(2)}×` : '—'}
      </td>
      <td className="numeric" style={{ color: liqColor }}>
        {row.liq_distance_pct !== null ? fmtPct(row.liq_distance_pct, 0) : '—'}
      </td>
      <td style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
        {fmtAgo(row.last_tick_ts ?? undefined)}
      </td>
    </tr>
  );
}
