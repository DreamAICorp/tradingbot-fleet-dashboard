/**
 * Sprint S1 — Pair view: group the 30 flat rows (15 canonical + 15
 * _nofilter siblings) into 15 symbol-pairs, each with side-by-side
 * filter / no-filter mini-stats and a colored ΔPnL cell.
 *
 * Why: scanning 30 flat rows for filter-vs-nofilter is operator-hostile —
 * the eye has to mentally pair them. This view does that pairing
 * structurally. Green ΔPnL = nofilter wins, red = filter wins, gray
 * when the gap is too small to be informative on the 24h sample.
 */
import { ChampionRow } from '@/lib/api';

interface PairRow {
  symbol: string;
  variant: string;
  leverage: number;
  canonical: ChampionRow | null;
  shadow:    ChampionRow | null;
}

// Below this absolute PnL gap (USD) the colored delta cell goes gray.
// Picked at $0.50 because on a $100 paper account a sub-50¢ delta is
// noise within the 24h sample we're showing.
const DELTA_GRAY_THRESHOLD_USD = 0.5;

export function buildPairs(rows: ChampionRow[]): PairRow[] {
  // Group by canonical strategy_id. Each row is either a canonical
  // (no _nofilter suffix) or its shadow sibling. We key on the
  // canonical id so both rows in a pair share a stable bucket.
  const buckets = new Map<string, PairRow>();
  for (const r of rows) {
    const isShadow = r.champion_id.endsWith('_nofilter');
    const canonId  = isShadow
      ? r.champion_id.slice(0, -'_nofilter'.length)
      : r.champion_id;
    let bucket = buckets.get(canonId);
    if (!bucket) {
      bucket = {
        symbol: r.symbol,
        variant: r.variant,
        leverage: r.leverage,
        canonical: null,
        shadow: null,
      };
      buckets.set(canonId, bucket);
    }
    if (isShadow) bucket.shadow = r;
    else          bucket.canonical = r;
  }
  // Sort by symbol for deterministic UI; the canonical row's symbol
  // wins when both sides are present.
  return Array.from(buckets.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function deltaColor(delta: number): 'pos' | 'neg' | 'mute' {
  if (Math.abs(delta) < DELTA_GRAY_THRESHOLD_USD) return 'mute';
  return delta > 0 ? 'pos' : 'neg';
}

interface Props {
  rows: ChampionRow[];
  onSelect: (championId: string) => void;
}

export default function PairView({ rows, onSelect }: Props) {
  const pairs = buildPairs(rows);
  return (
    <section data-testid="pair-view">
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Lev</th>
            <th>Filter — PnL 24h</th>
            <th>Filter — trades</th>
            <th>No filter — PnL 24h</th>
            <th>No filter — trades</th>
            <th>Δ PnL (no_filter − filter)</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => {
            const canonPnl  = p.canonical?.pnl_24h_usd ?? 0;
            const shadowPnl = p.shadow?.pnl_24h_usd ?? 0;
            const delta = shadowPnl - canonPnl;
            const tone = deltaColor(delta);
            const toneColor =
              tone === 'pos'
                ? 'var(--color-pos)'
                : tone === 'neg'
                ? 'var(--color-neg)'
                : 'var(--color-text-mute)';
            const canonTrades  = p.canonical?.pnl_24h_sparkline?.length ?? 0;
            const shadowTrades = p.shadow?.pnl_24h_sparkline?.length    ?? 0;
            return (
              <tr key={p.symbol} data-testid={`pair-row-${p.symbol}`} data-delta-tone={tone}>
                <td>{p.symbol}</td>
                <td className="numeric">x{p.leverage}</td>
                <td
                  className="numeric clickable"
                  onClick={() => p.canonical && onSelect(p.canonical.champion_id)}
                  style={p.canonical ? { cursor: 'pointer' } : { color: 'var(--color-text-mute)' }}
                  data-testid={`pair-cell-canonical-${p.symbol}`}
                >
                  {p.canonical ? `$${canonPnl.toFixed(2)}` : '—'}
                </td>
                <td className="numeric">{p.canonical ? canonTrades : '—'}</td>
                <td
                  className="numeric clickable"
                  onClick={() => p.shadow && onSelect(p.shadow.champion_id)}
                  style={p.shadow ? { cursor: 'pointer' } : { color: 'var(--color-text-mute)' }}
                  data-testid={`pair-cell-shadow-${p.symbol}`}
                >
                  {p.shadow ? `$${shadowPnl.toFixed(2)}` : '—'}
                </td>
                <td className="numeric">{p.shadow ? shadowTrades : '—'}</td>
                <td
                  className="numeric"
                  style={{ color: toneColor, fontWeight: tone !== 'mute' ? 600 : 400 }}
                  data-testid={`pair-delta-${p.symbol}`}
                >
                  {p.canonical && p.shadow
                    ? (delta >= 0
                        ? `+$${delta.toFixed(2)}`
                        : `-$${Math.abs(delta).toFixed(2)}`)
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
        Δ PnL coloration: green = no-filter wins ≥ ${DELTA_GRAY_THRESHOLD_USD},
        red = filter wins ≥ ${DELTA_GRAY_THRESHOLD_USD}, gray = within noise
        threshold on 24h sample. Click either side to expand its full panel.
      </div>
    </section>
  );
}
