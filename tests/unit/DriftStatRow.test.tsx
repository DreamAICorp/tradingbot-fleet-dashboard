import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DriftStatRow from '@/components/fleet/DriftStatRow';

function renderInTable(props: React.ComponentProps<typeof DriftStatRow>) {
  return render(
    <table>
      <tbody>
        <DriftStatRow {...props} />
      </tbody>
    </table>,
  );
}

describe('DriftStatRow', () => {
  it('green bucket when |delta| < 10', () => {
    renderInTable({
      name: 'win_rate',
      backtest: 0.6,
      simulation: 0.58,
      live: 0.59,
      deltaPct: -1.7,
      unit: 'pct',
    });
    const row = screen.getByTestId('drift-row-win_rate');
    expect(row).toHaveAttribute('data-bucket', 'green');
  });

  it('yellow bucket when 10 <= |delta| < 30', () => {
    renderInTable({
      name: 'fees_ratio',
      backtest: 14,
      simulation: 16,
      live: 17,
      deltaPct: 21,
      unit: 'pct',
    });
    const row = screen.getByTestId('drift-row-fees_ratio');
    expect(row).toHaveAttribute('data-bucket', 'yellow');
  });

  it('red bucket when |delta| >= 30', () => {
    renderInTable({
      name: 'liq_rate',
      backtest: 0.07,
      simulation: 0.07,
      live: 0.18,
      deltaPct: 157,
      unit: 'pct',
    });
    const row = screen.getByTestId('drift-row-liq_rate');
    expect(row).toHaveAttribute('data-bucket', 'red');
  });

  it('renders em-dash when delta is null (no live data yet)', () => {
    renderInTable({
      name: 'win_rate',
      backtest: 0.6,
      simulation: null,
      live: null,
      deltaPct: null,
      unit: 'pct',
    });
    expect(screen.getByTestId('drift-delta-win_rate')).toHaveTextContent('—');
    expect(screen.getByTestId('drift-row-win_rate'))
      .toHaveAttribute('data-bucket', 'none');
  });

  it('formats counts vs percents correctly', () => {
    renderInTable({
      name: 'n_trades',
      backtest: 1234,
      simulation: 1100,
      live: 800,
      deltaPct: -35,
      unit: 'count',
    });
    const row = screen.getByTestId('drift-row-n_trades');
    // Compact-formatted counts in the value cells
    expect(row).toHaveTextContent('1.2k');
    expect(row).toHaveTextContent('800');
  });

  it('shows + sign on positive delta', () => {
    renderInTable({
      name: 'trades_per_day',
      backtest: 5,
      simulation: 5,
      live: 12,
      deltaPct: 140,
      unit: 'count',
    });
    const delta = screen.getByTestId('drift-delta-trades_per_day');
    expect(delta).toHaveTextContent('+140%');
  });

  // ── S1: paired no-regime shadow column ──────────────────────────────────

  describe('paired (4-column) mode', () => {
    it('renders 5 trailing cells when liveNoFilter is supplied', () => {
      // legacy 3-col mode = backtest / sim / live / Δ (4 trailing cells)
      // paired 4-col mode = + liveNoFilter + ΔnoFilter (6 trailing cells)
      renderInTable({
        name: 'daily_rate_pct',
        backtest: 2.13,
        simulation: null,
        live: 0.0,
        deltaPct: -100,
        liveNoFilter: 1.80,
        deltaPctNoFilter: -15,
        unit: 'pct',
      });
      expect(screen.getByTestId('drift-live-nofilter-daily_rate_pct'))
        .toBeInTheDocument();
      expect(screen.getByTestId('drift-delta-nofilter-daily_rate_pct'))
        .toHaveTextContent('-15%');
    });

    it('legacy 3-col mode unchanged when both no-filter props omitted', () => {
      // No paired props → no extra cells, no extra testids.
      renderInTable({
        name: 'win_rate',
        backtest: 0.6,
        simulation: null,
        live: 0.59,
        deltaPct: -1.7,
        unit: 'pct',
      });
      expect(screen.queryByTestId('drift-live-nofilter-win_rate'))
        .toBeNull();
      expect(screen.queryByTestId('drift-delta-nofilter-win_rate'))
        .toBeNull();
    });

    it('colors the no-filter Δ cell independently of the canonical Δ', () => {
      // canonical: -92% → red bucket
      // no-filter: +3%  → green bucket
      // Both cells get their own data-bucket attribute on the row.
      renderInTable({
        name: 'daily_rate_pct',
        backtest: 2.13,
        simulation: null,
        live: 0.18,        // 92% below backtest
        deltaPct: -92,
        liveNoFilter: 2.20,
        deltaPctNoFilter: 3,
        unit: 'pct',
      });
      const row = screen.getByTestId('drift-row-daily_rate_pct');
      expect(row).toHaveAttribute('data-bucket', 'red');
      expect(row).toHaveAttribute('data-bucket-nofilter', 'green');
    });

    it('renders em-dash on missing no-filter value', () => {
      renderInTable({
        name: 'liq_rate',
        backtest: 0.018,
        simulation: null,
        live: 0.30,
        deltaPct: 1567,
        liveNoFilter: null,
        deltaPctNoFilter: null,
        unit: 'pct',
      });
      expect(screen.getByTestId('drift-live-nofilter-liq_rate'))
        .toHaveTextContent('—');
      expect(screen.getByTestId('drift-delta-nofilter-liq_rate'))
        .toHaveTextContent('—');
    });
  });
});
