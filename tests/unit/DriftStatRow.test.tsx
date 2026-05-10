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
});
