/**
 * Sprint S1 — PairView unit tests.
 *
 * Asserts buildPairs grouping logic + delta-coloring rules + the
 * rendered table reflects N pairs from 2N flat rows.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PairView, { buildPairs, deltaColor } from '@/components/fleet/PairView';
import type { ChampionRow } from '@/lib/api';

function row(overrides: Partial<ChampionRow>): ChampionRow {
  return {
    champion_id: 'multi_tf_rsi_confluence_bananausdt_x50',
    symbol: 'BANANAUSDT',
    family: 'multi',
    variant: 'multi_tf_rsi_confluence',
    tf_label: 'tf-15m-1h-4h',
    leverage: 50,
    status: 'GREEN',
    pnl_24h_usd: 0,
    pnl_24h_sparkline: [],
    win_rate_24h: null,
    fees_pct_24h: null,
    trades_ratio: null,
    liq_distance_pct: null,
    last_tick_ts: Date.now(),
    pair_variant_id: null,
    ...overrides,
  };
}

describe('buildPairs', () => {
  it('groups a canonical + its _nofilter sibling into one bucket', () => {
    const flat: ChampionRow[] = [
      row({ champion_id: 'multi_tf_rsi_confluence_bananausdt_x50', pnl_24h_usd: 0 }),
      row({ champion_id: 'multi_tf_rsi_confluence_bananausdt_x50_nofilter', pnl_24h_usd: 3.5 }),
    ];
    const pairs = buildPairs(flat);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].canonical?.champion_id).toBe('multi_tf_rsi_confluence_bananausdt_x50');
    expect(pairs[0].shadow?.champion_id).toBe('multi_tf_rsi_confluence_bananausdt_x50_nofilter');
  });

  it('emits 15 pairs from 30 flat rows (10 symbols × 2 sides)', () => {
    const symbols = ['BANANA','BIO','DYM','JUP','KITE','MEGA','NIL','NOT','OG','OPEN'];
    const flat: ChampionRow[] = [];
    for (const s of symbols) {
      const sid = `multi_tf_rsi_confluence_${s.toLowerCase()}usdt_x50`;
      flat.push(row({ symbol: `${s}USDT`, champion_id: sid }));
      flat.push(row({ symbol: `${s}USDT`, champion_id: `${sid}_nofilter` }));
    }
    const pairs = buildPairs(flat);
    expect(pairs).toHaveLength(10);
    for (const p of pairs) {
      expect(p.canonical).not.toBeNull();
      expect(p.shadow).not.toBeNull();
    }
  });

  it('keeps an orphan canonical or orphan shadow visible (one side null)', () => {
    // Resilient when one half hasn't registered yet — eg. first 30 min
    // after Path B install while a runner is still booting.
    const orphans: ChampionRow[] = [
      row({ symbol: 'JUPUSDT', champion_id: 'multi_tf_rsi_confluence_jupusdt_x50' }),
      // no _nofilter sibling registered yet
    ];
    const pairs = buildPairs(orphans);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].canonical).not.toBeNull();
    expect(pairs[0].shadow).toBeNull();
  });

  it('sorts pairs alphabetically by symbol', () => {
    const rows: ChampionRow[] = [
      row({ symbol: 'ZEROUSDT', champion_id: 'multi_tf_rsi_confluence_zerousdt_x50' }),
      row({ symbol: 'AAAUSDT',  champion_id: 'multi_tf_rsi_confluence_aaausdt_x50' }),
      row({ symbol: 'MIDUSDT',  champion_id: 'multi_tf_rsi_confluence_midusdt_x50' }),
    ];
    const pairs = buildPairs(rows);
    expect(pairs.map((p) => p.symbol)).toEqual(['AAAUSDT', 'MIDUSDT', 'ZEROUSDT']);
  });
});

describe('deltaColor', () => {
  it('mute when |delta| below threshold', () => {
    expect(deltaColor(0.1)).toBe('mute');
    expect(deltaColor(-0.4)).toBe('mute');
  });

  it('pos when nofilter wins by >= threshold', () => {
    expect(deltaColor(0.5)).toBe('pos');
    expect(deltaColor(50)).toBe('pos');
  });

  it('neg when filter wins by >= threshold', () => {
    expect(deltaColor(-0.5)).toBe('neg');
    expect(deltaColor(-50)).toBe('neg');
  });
});

describe('<PairView />', () => {
  it('renders one pair-row per symbol', () => {
    const flat: ChampionRow[] = [
      row({ symbol: 'BANANAUSDT', champion_id: 'multi_tf_rsi_confluence_bananausdt_x50', pnl_24h_usd: 0 }),
      row({ symbol: 'BANANAUSDT', champion_id: 'multi_tf_rsi_confluence_bananausdt_x50_nofilter', pnl_24h_usd: 3 }),
      row({ symbol: 'JUPUSDT',    champion_id: 'multi_tf_rsi_confluence_jupusdt_x50', pnl_24h_usd: 1 }),
      row({ symbol: 'JUPUSDT',    champion_id: 'multi_tf_rsi_confluence_jupusdt_x50_nofilter', pnl_24h_usd: 0.8 }),
    ];
    render(<PairView rows={flat} onSelect={() => {}} />);
    expect(screen.getByTestId('pair-row-BANANAUSDT')).toBeInTheDocument();
    expect(screen.getByTestId('pair-row-JUPUSDT')).toBeInTheDocument();
  });

  it('colors delta-pos when nofilter wins ≥ threshold', () => {
    const flat: ChampionRow[] = [
      row({ symbol: 'BANANAUSDT', champion_id: 'multi_tf_rsi_confluence_bananausdt_x50', pnl_24h_usd: 0 }),
      row({ symbol: 'BANANAUSDT', champion_id: 'multi_tf_rsi_confluence_bananausdt_x50_nofilter', pnl_24h_usd: 3 }),
    ];
    render(<PairView rows={flat} onSelect={() => {}} />);
    expect(screen.getByTestId('pair-row-BANANAUSDT'))
      .toHaveAttribute('data-delta-tone', 'pos');
  });

  it('colors delta-neg when filter wins ≥ threshold', () => {
    const flat: ChampionRow[] = [
      row({ symbol: 'BANANAUSDT', champion_id: 'multi_tf_rsi_confluence_bananausdt_x50', pnl_24h_usd: 5 }),
      row({ symbol: 'BANANAUSDT', champion_id: 'multi_tf_rsi_confluence_bananausdt_x50_nofilter', pnl_24h_usd: 1 }),
    ];
    render(<PairView rows={flat} onSelect={() => {}} />);
    expect(screen.getByTestId('pair-row-BANANAUSDT'))
      .toHaveAttribute('data-delta-tone', 'neg');
  });

  it('calls onSelect with canonical id when clicking left cell', () => {
    const onSelect = vi.fn();
    const flat: ChampionRow[] = [
      row({ symbol: 'BANANAUSDT', champion_id: 'multi_tf_rsi_confluence_bananausdt_x50', pnl_24h_usd: 0 }),
      row({ symbol: 'BANANAUSDT', champion_id: 'multi_tf_rsi_confluence_bananausdt_x50_nofilter', pnl_24h_usd: 3 }),
    ];
    render(<PairView rows={flat} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('pair-cell-canonical-BANANAUSDT'));
    expect(onSelect).toHaveBeenCalledWith('multi_tf_rsi_confluence_bananausdt_x50');
  });

  it('calls onSelect with shadow id when clicking right cell', () => {
    const onSelect = vi.fn();
    const flat: ChampionRow[] = [
      row({ symbol: 'BANANAUSDT', champion_id: 'multi_tf_rsi_confluence_bananausdt_x50', pnl_24h_usd: 0 }),
      row({ symbol: 'BANANAUSDT', champion_id: 'multi_tf_rsi_confluence_bananausdt_x50_nofilter', pnl_24h_usd: 3 }),
    ];
    render(<PairView rows={flat} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('pair-cell-shadow-BANANAUSDT'));
    expect(onSelect).toHaveBeenCalledWith('multi_tf_rsi_confluence_bananausdt_x50_nofilter');
  });
});
