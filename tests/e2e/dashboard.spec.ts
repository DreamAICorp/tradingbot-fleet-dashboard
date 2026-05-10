import { test, expect } from '@playwright/test';

/**
 * E2E for the dashboard. Mocks the fleet REST endpoints so the test runs
 * without a backend — Playwright intercepts /api/fleet/* and serves canned
 * fixtures. WS isn't asserted in Phase A; that comes in Phase B's e2e
 * once we extend /ws/paper to /ws/fleet/champions.
 */

const overview = {
  champions_active: 2,
  champions_total: 15,
  drift_pct: 50,
  last_tick_ts: Date.now() - 4_000,
  windows: {
    '1d':  { pnl_usd: 12.34, fees_usd: 1.50, n_trades: 8,   n_wins: 5, win_rate: 5/8 },
    '7d':  { pnl_usd: 60,    fees_usd: 11,   n_trades: 56,  n_wins: 33, win_rate: 33/56 },
    '30d': { pnl_usd: 220,   fees_usd: 45,   n_trades: 220, n_wins: 130, win_rate: 130/220 },
    '60d': { pnl_usd: 360,   fees_usd: 80,   n_trades: 410, n_wins: 240, win_rate: 240/410 },
    '90d': { pnl_usd: 480,   fees_usd: 110,  n_trades: 590, n_wins: 350, win_rate: 350/590 },
    '1yr': { pnl_usd: 480,   fees_usd: 110,  n_trades: 590, n_wins: 350, win_rate: 350/590 },
  },
};

const champions = [
  {
    champion_id: 'multi_tf_rsi_confluence_nilusdt_x50',
    symbol: 'NILUSDT', family: 'multi_tf_rsi', variant: 'multi_tf_rsi_confluence',
    tf_label: 'tf-15m-1h-4h', leverage: 50,
    status: 'GREEN',
    pnl_24h_usd: 5.20,
    pnl_24h_sparkline: [
      { ts: Date.now() - 60_000 * 4, pnl: 0 },
      { ts: Date.now() - 60_000 * 3, pnl: 1.5 },
      { ts: Date.now() - 60_000 * 2, pnl: 3.2 },
      { ts: Date.now() - 60_000 * 1, pnl: 4.8 },
      { ts: Date.now(),              pnl: 5.2 },
    ],
    win_rate_24h: 0.62,
    fees_pct_24h: 12,
    trades_ratio: 1.1,
    liq_distance_pct: 78,
    last_tick_ts: Date.now() - 3_000,
  },
  {
    champion_id: 'multi_tf_rsi_confluence_megausdt_x50',
    symbol: 'MEGAUSDT', family: 'multi_tf_rsi', variant: 'multi_tf_rsi_confluence',
    tf_label: 'tf-15m-1h-4h', leverage: 50,
    status: 'SUSPECT',
    pnl_24h_usd: -2.10,
    pnl_24h_sparkline: [
      { ts: Date.now() - 60_000 * 3, pnl: 0 },
      { ts: Date.now() - 60_000 * 2, pnl: -0.4 },
      { ts: Date.now() - 60_000 * 1, pnl: -1.1 },
      { ts: Date.now(),              pnl: -2.1 },
    ],
    win_rate_24h: 0.48,
    fees_pct_24h: 67,
    trades_ratio: 6.4,
    liq_distance_pct: 22,
    last_tick_ts: Date.now() - 8_000,
  },
];

const compareNil = {
  champion_id: 'multi_tf_rsi_confluence_nilusdt_x50',
  sample_size: 25,
  metrics: [
    { name: 'daily_rate_pct', backtest: 4.02, simulation: null, live: 3.85, delta_pct: -4.2, unit: 'pct' },
    { name: 'win_rate',       backtest: 0.62, simulation: null, live: 0.60, delta_pct: -3.2, unit: 'pct' },
    { name: 'liq_rate',       backtest: 0.066, simulation: null, live: 0.07, delta_pct: 6.0,  unit: 'pct' },
    { name: 'avg_trades_per_day', backtest: 7.8, simulation: null, live: 8.2, delta_pct: 5.1, unit: 'count' },
  ],
};

const logsNil = [
  { ts: Date.now() - 30_000, level: 'INFO',   message: '[NILUSDT] bar@123: close=1.345 equity=$104.21 pos=flat' },
  { ts: Date.now() - 25_000, level: 'INFO',   message: '[NILUSDT] signal: bull_div RSI tf-1h' },
  { ts: Date.now() - 20_000, level: 'INFO',   message: '[NILUSDT] entry@1.347 size_usd=$2.1 lev=50' },
];

test.describe('Fleet dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/fleet/overview', (r) =>
      r.fulfill({ json: overview }));
    await page.route('**/api/fleet/champions', (r) =>
      r.fulfill({ json: champions }));
    await page.route(/\/api\/fleet\/champions\/.*\/compare/, (r) =>
      r.fulfill({ json: compareNil }));
    await page.route(/\/api\/fleet\/champions\/.*\/logs.*/, (r) =>
      r.fulfill({ json: logsNil }));
  });

  test('zone 1 + zone 2 render with all 6 windows and 2 champion rows', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('fleet-header')).toBeVisible();
    await expect(page.getByTestId('window-1d')).toBeVisible();
    await expect(page.getByTestId('window-1yr')).toBeVisible();
    await expect(page.getByTestId('champion-table')).toBeVisible();
    await expect(page.getByTestId('champion-row-multi_tf_rsi_confluence_nilusdt_x50')).toBeVisible();
    await expect(page.getByTestId('champion-row-multi_tf_rsi_confluence_megausdt_x50')).toBeVisible();
  });

  test('clicking a row expands the panel and loads compare + logs tabs', async ({ page }) => {
    await page.goto('/');
    const row = page.getByTestId('champion-row-multi_tf_rsi_confluence_nilusdt_x50');
    await row.click();
    const exp = page.getByTestId('champion-expansion-multi_tf_rsi_confluence_nilusdt_x50');
    await expect(exp).toBeVisible();
    // Compare tab is default
    await expect(exp.getByText('daily_rate_pct')).toBeVisible();
    await expect(exp.getByText(/sample size \(live trades\)/)).toBeVisible();
    // Switch to logs
    await exp.getByTestId('tab-decisions').click();
    await expect(exp.getByText(/bar@123/)).toBeVisible();
  });

  test('SUSPECT row shows red trades_ratio and over-firing badge', async ({ page }) => {
    await page.goto('/');
    const row = page.getByTestId('champion-row-multi_tf_rsi_confluence_megausdt_x50');
    await expect(row.getByTestId('status-SUSPECT')).toBeVisible();
    // trades_ratio of 6.4× should display as `6.40×`
    await expect(row).toContainText('6.40×');
  });

  test('Phase B placeholders shown for chart + broker tabs', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('champion-row-multi_tf_rsi_confluence_nilusdt_x50').click();
    const exp = page.getByTestId('champion-expansion-multi_tf_rsi_confluence_nilusdt_x50');
    await exp.getByTestId('tab-chart').click();
    await expect(exp.getByText(/Coming in Phase B/)).toBeVisible();
    await exp.getByTestId('tab-broker').click();
    await expect(exp.getByText(/Coming in Phase B/)).toBeVisible();
  });
});
