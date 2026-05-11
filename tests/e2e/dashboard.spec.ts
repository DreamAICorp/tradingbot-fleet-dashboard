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

const equityOverlayNil = {
  champion_id: 'multi_tf_rsi_confluence_nilusdt_x50',
  days: 30,
  backtest_curve: [
    { ts: Date.now() - 86_400_000 * 3, equity: 100 },
    { ts: Date.now() - 86_400_000 * 2, equity: 102 },
    { ts: Date.now() - 86_400_000,     equity: 104 },
    { ts: Date.now(),                  equity: 106 },
  ],
  live_curve: [
    { ts: Date.now() - 86_400_000 * 3, equity: 100 },
    { ts: Date.now() - 86_400_000 * 2, equity: 100.8 },
    { ts: Date.now() - 86_400_000,     equity: 100.4 },
    { ts: Date.now(),                  equity: 99.5 },
  ],
};

const brokerNil = {
  champion_id: 'multi_tf_rsi_confluence_nilusdt_x50',
  venue: 'paper',
  symbol: 'NILUSDT',
  side: 'long',
  entry: 1.345,
  mark: 1.347,
  size: 21.0,
  unrealized_pnl: 0.42,
  liq_price: 1.318,
  liq_distance_pct: 78,
  fetched_at: Date.now() - 2_000,
  available: true,
};

const liqHeatmap = {
  ts: Date.now(),
  positions: [
    {
      champion_id: 'multi_tf_rsi_confluence_nilusdt_x50',
      symbol: 'NILUSDT', side: 'long', leverage: 50,
      entry: 1.345, mark: 1.347, liq_price: 1.318,
      liq_distance_pct: 78, unrealized_pnl_usd: 0.42,
    },
    {
      champion_id: 'multi_tf_rsi_confluence_megausdt_x50',
      symbol: 'MEGAUSDT', side: 'long', leverage: 50,
      entry: 0.42, mark: 0.418, liq_price: 0.4116,
      liq_distance_pct: 22, unrealized_pnl_usd: -2.10,
    },
  ],
};

const capAlloc = {
  ts: Date.now(),
  by_family: [{ key: 'multi_tf_rsi', pct: 87, equity_usd: 870 }, { key: 'ict', pct: 13, equity_usd: 130 }],
  by_symbol: [{ key: 'NILUSDT', pct: 30, equity_usd: 300 }, { key: 'MEGAUSDT', pct: 70, equity_usd: 700 }],
  by_leverage_tier: [{ key: 'x50', pct: 100, equity_usd: 1000 }],
};

const correlation = {
  ts: Date.now(),
  champions: [
    'multi_tf_rsi_confluence_nilusdt_x50',
    'multi_tf_rsi_confluence_megausdt_x50',
  ],
  cells: [
    { a: 'multi_tf_rsi_confluence_nilusdt_x50',
      b: 'multi_tf_rsi_confluence_megausdt_x50',
      rho: 0.42, n_overlap: 600 },
  ],
};

const runnerHealth = {
  ts: Date.now(),
  rows: [
    {
      champion_id: 'multi_tf_rsi_confluence_nilusdt_x50',
      unit: 'tradingbot-paper-multi_tf_rsi_confluence_nilusdt_x50',
      n_restarts: 0,
      ws_reconnects_24h: 1,
      last_tick_age_sec: 4,
      active_since: Date.now() - 86_400_000 * 2,
    },
  ],
};

const edgeAttrNil = {
  champion_id: 'multi_tf_rsi_confluence_nilusdt_x50',
  days: 30,
  curves: [
    { ts: Date.now() - 86_400_000 * 2, strategy: 100, buy_and_hold: 100, do_nothing: 100 },
    { ts: Date.now() - 86_400_000,     strategy: 102, buy_and_hold: 101, do_nothing: 100 },
    { ts: Date.now(),                  strategy: 105, buy_and_hold: 103, do_nothing: 100 },
  ],
};

const quietHoursNil = {
  champion_id: 'multi_tf_rsi_confluence_nilusdt_x50',
  expected_per_hour: 0.33,
  cells: Array.from({ length: 24 }, (_, h) => ({
    hour_utc: h,
    n_trades: h === 14 ? 8 : h % 3 === 0 ? 1 : 0,
    pnl_usd:  h === 14 ? 4.2 : 0,
  })),
};

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
    await page.route(/\/api\/fleet\/champions\/.*\/equity-overlay.*/, (r) =>
      r.fulfill({ json: equityOverlayNil }));
    await page.route(/\/api\/fleet\/champions\/.*\/broker-position.*/, (r) =>
      r.fulfill({ json: brokerNil }));
    await page.route(/\/api\/fleet\/champions\/.*\/edge-attribution.*/, (r) =>
      r.fulfill({ json: edgeAttrNil }));
    await page.route(/\/api\/fleet\/champions\/.*\/quiet-hours.*/, (r) =>
      r.fulfill({ json: quietHoursNil }));
    await page.route('**/api/fleet/liq-heatmap', (r) =>
      r.fulfill({ json: liqHeatmap }));
    await page.route('**/api/fleet/capital-allocation', (r) =>
      r.fulfill({ json: capAlloc }));
    await page.route('**/api/fleet/correlation', (r) =>
      r.fulfill({ json: correlation }));
    await page.route('**/api/fleet/runner-health', (r) =>
      r.fulfill({ json: runnerHealth }));
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

  test('chart tab renders BacktestLiveChart with both legend lines', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('champion-row-multi_tf_rsi_confluence_nilusdt_x50').click();
    const exp = page.getByTestId('champion-expansion-multi_tf_rsi_confluence_nilusdt_x50');
    await exp.getByTestId('tab-chart').click();
    await expect(exp.getByTestId('backtest-live-chart-multi_tf_rsi_confluence_nilusdt_x50')).toBeVisible();
    await expect(exp.getByText('Backtest', { exact: true })).toBeVisible();
    await expect(exp.getByText('Live', { exact: true })).toBeVisible();
  });

  test('broker tab shows live position with side + liq distance', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('champion-row-multi_tf_rsi_confluence_nilusdt_x50').click();
    const exp = page.getByTestId('champion-expansion-multi_tf_rsi_confluence_nilusdt_x50');
    await exp.getByTestId('tab-broker').click();
    await expect(exp.getByTestId('broker-position-multi_tf_rsi_confluence_nilusdt_x50')).toBeVisible();
    await expect(exp.getByText('LONG')).toBeVisible();
    await expect(exp.getByText('78.0%')).toBeVisible();
  });

  test('edge attribution + hourly tabs render', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('champion-row-multi_tf_rsi_confluence_nilusdt_x50').click();
    const exp = page.getByTestId('champion-expansion-multi_tf_rsi_confluence_nilusdt_x50');
    await exp.getByTestId('tab-edge').click();
    await expect(exp.getByTestId('edge-attribution-multi_tf_rsi_confluence_nilusdt_x50')).toBeVisible();
    await exp.getByTestId('tab-hours').click();
    await expect(exp.getByTestId('quiet-hours')).toBeVisible();
    await expect(exp.getByTestId('hour-14')).toContainText('8'); // peak hour
  });

  test('Phase C panels appear under the table', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('liq-heatmap')).toBeVisible();
    await expect(page.getByTestId('capital-allocation')).toBeVisible();
    await expect(page.getByTestId('runner-health')).toBeVisible();
    await expect(page.getByTestId('correlation-matrix')).toBeVisible();
    await expect(page.getByTestId('liq-cell-multi_tf_rsi_confluence_megausdt_x50')).toBeVisible();
  });
});

// ── Sprint S1 — paired regime A/B comparison view ───────────────────────────

const championsWithVariants = [
  ...champions,
  // _nofilter shadow for the NIL canonical above
  {
    ...champions[0],
    champion_id: 'multi_tf_rsi_confluence_nilusdt_x50_nofilter',
    status: 'GREEN',
    pnl_24h_usd: 8.40,        // shadow won more than canonical (5.20)
    pnl_24h_sparkline: [
      { ts: Date.now() - 60_000 * 4, pnl: 0 },
      { ts: Date.now() - 60_000 * 3, pnl: 2.5 },
      { ts: Date.now() - 60_000 * 2, pnl: 5.0 },
      { ts: Date.now() - 60_000 * 1, pnl: 7.2 },
      { ts: Date.now(),              pnl: 8.4 },
    ],
    pair_variant_id: null,
  },
  // _nofilter shadow for MEGA canonical
  {
    ...champions[1],
    champion_id: 'multi_tf_rsi_confluence_megausdt_x50_nofilter',
    status: 'YELLOW',
    pnl_24h_usd: -4.20,       // shadow worse than canonical — filter helps here
    pair_variant_id: null,
  },
];
// Tag canonicals with their sibling — mirror what fleet.py emits
championsWithVariants[0] = {
  ...championsWithVariants[0],
  pair_variant_id: 'multi_tf_rsi_confluence_nilusdt_x50_nofilter',
};
championsWithVariants[1] = {
  ...championsWithVariants[1],
  pair_variant_id: 'multi_tf_rsi_confluence_megausdt_x50_nofilter',
};

const compareNilPaired = {
  champion_id: 'multi_tf_rsi_confluence_nilusdt_x50',
  pair_variant_id: 'multi_tf_rsi_confluence_nilusdt_x50_nofilter',
  sample_size: 25,
  sample_size_no_filter: 34,
  metrics: [
    { name: 'daily_rate_pct',
      backtest: 4.02, simulation: null,
      live: 3.85,      live_no_filter: 5.10,
      delta_pct: -4.2, delta_pct_no_filter: 26.9,
      unit: 'pct' },
    { name: 'win_rate',
      backtest: 0.62, simulation: null,
      live: 0.60,      live_no_filter: 0.55,
      delta_pct: -3.2, delta_pct_no_filter: -11.3,
      unit: 'pct' },
    { name: 'liq_rate',
      backtest: 0.066, simulation: null,
      live: 0.07,      live_no_filter: 0.12,
      delta_pct: 6.0,  delta_pct_no_filter: 82,
      unit: 'pct' },
    { name: 'avg_trades_per_day',
      backtest: 7.8,  simulation: null,
      live: 8.2,       live_no_filter: 13.6,
      delta_pct: 5.1,  delta_pct_no_filter: 74,
      unit: 'count' },
    { name: 'fees_pct_of_gross',
      backtest: null, simulation: null,
      live: 14.0,      live_no_filter: 21.5,
      delta_pct: null, delta_pct_no_filter: null,
      unit: 'pct' },
  ],
};

const chartDataNilPaired = {
  champion_id: 'multi_tf_rsi_confluence_nilusdt_x50',
  pair_variant_id: 'multi_tf_rsi_confluence_nilusdt_x50_nofilter',
  symbol: 'NILUSDT',
  interval_minutes: 15,
  days: 7,
  candles: Array.from({ length: 200 }, (_, i) => ({
    ts: Date.now() - (200 - i) * 60_000 * 15,
    open: 1.0 + Math.sin(i / 10) * 0.05,
    high: 1.05 + Math.sin(i / 10) * 0.05,
    low: 0.98 + Math.sin(i / 10) * 0.05,
    close: 1.02 + Math.sin(i / 10) * 0.05,
    volume: 1000,
  })),
  live_signals: [
    { ts: Date.now() - 60_000 * 60, side: 'long', type: 'entry', price: 1.0 },
    { ts: Date.now() - 60_000 * 30, side: 'long', type: 'exit',  price: 1.04, pnl: 0.4 },
  ],
  backtest_signals: [
    { ts: Date.now() - 60_000 * 50, side: 'long', type: 'entry', price: 1.01 },
  ],
  shadow_signals: [
    { ts: Date.now() - 60_000 * 70, side: 'long', type: 'entry', price: 0.99 },
    { ts: Date.now() - 60_000 * 40, side: 'long', type: 'exit',  price: 1.03, pnl: 0.45 },
    { ts: Date.now() - 60_000 * 20, side: 'long', type: 'entry', price: 1.02 },
  ],
};

test.describe('Sprint S1 — paired regime A/B comparison', () => {
  test.beforeEach(async ({ page }) => {
    // Same fixtures as base describe + sibling-aware overrides.
    await page.route('**/api/fleet/overview', (r) => r.fulfill({ json: overview }));
    await page.route(/\/api\/fleet\/champions(\?.*)?$/, (r) => {
      const url = new URL(r.request().url());
      const include = url.searchParams.get('include_variants') === 'true';
      r.fulfill({ json: include ? championsWithVariants : champions.map((c, i) => ({
        ...c,
        pair_variant_id: championsWithVariants[i]?.pair_variant_id ?? null,
      })) });
    });
    await page.route(/\/api\/fleet\/champions\/.*\/compare/, (r) =>
      r.fulfill({ json: compareNilPaired }));
    await page.route(/\/api\/fleet\/champions\/.*\/chart-data.*/, (r) =>
      r.fulfill({ json: chartDataNilPaired }));
    // Reuse from base describe for tabs that don't need pair changes.
    await page.route(/\/api\/fleet\/champions\/.*\/logs.*/, (r) => r.fulfill({ json: logsNil }));
    await page.route(/\/api\/fleet\/champions\/.*\/broker-position.*/, (r) => r.fulfill({ json: brokerNil }));
    await page.route(/\/api\/fleet\/champions\/.*\/edge-attribution.*/, (r) => r.fulfill({ json: edgeAttrNil }));
    await page.route(/\/api\/fleet\/champions\/.*\/quiet-hours.*/, (r) => r.fulfill({ json: quietHoursNil }));
    await page.route('**/api/fleet/liq-heatmap', (r) => r.fulfill({ json: liqHeatmap }));
    await page.route('**/api/fleet/capital-allocation', (r) => r.fulfill({ json: capAlloc }));
    await page.route('**/api/fleet/correlation', (r) => r.fulfill({ json: correlation }));
    await page.route('**/api/fleet/runner-health', (r) => r.fulfill({ json: runnerHealth }));
  });

  test('view toggle is present and defaults to flat', async ({ page }) => {
    await page.goto('/fleet');
    const toggle = page.getByTestId('view-toggle');
    await expect(toggle).toBeVisible();
    await expect(page.getByTestId('toggle-flat')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('toggle-pair')).toHaveAttribute('aria-pressed', 'false');
  });

  test('flat mode shows canonical + sibling rows when include_variants triggers', async ({ page }) => {
    await page.goto('/fleet');
    // ChampionTable fetches with includeVariants=true on mount → both rows visible.
    await expect(page.getByTestId('champion-row-multi_tf_rsi_confluence_nilusdt_x50')).toBeVisible();
    await expect(page.getByTestId('champion-row-multi_tf_rsi_confluence_nilusdt_x50_nofilter'))
      .toBeVisible();
  });

  test('pair view toggle renders paired rows with delta cells', async ({ page }) => {
    await page.goto('/fleet');
    await page.getByTestId('toggle-pair').click();
    await expect(page.getByTestId('pair-view')).toBeVisible();
    // NILUSDT pair: canonical 5.20 vs shadow 8.40 → +3.20 → pos
    const nilRow = page.getByTestId('pair-row-NILUSDT');
    await expect(nilRow).toBeVisible();
    await expect(nilRow).toHaveAttribute('data-delta-tone', 'pos');
    // MEGAUSDT pair: canonical -2.10 vs shadow -4.20 → -2.10 → neg (filter wins)
    const megaRow = page.getByTestId('pair-row-MEGAUSDT');
    await expect(megaRow).toHaveAttribute('data-delta-tone', 'neg');
    await expect(page.getByTestId('pair-delta-NILUSDT')).toContainText('+$3.20');
    await expect(page.getByTestId('pair-delta-MEGAUSDT')).toContainText('-$2.10');
  });

  test('expanded compare tab renders 4th Live (no filter) column when sibling exists', async ({ page }) => {
    await page.goto('/fleet');
    await page.getByTestId('champion-row-multi_tf_rsi_confluence_nilusdt_x50').click();
    const exp = page.getByTestId('champion-expansion-multi_tf_rsi_confluence_nilusdt_x50');
    await expect(exp).toBeVisible();
    await expect(exp.getByText('Live (no filter)')).toBeVisible();
    await expect(exp.getByText('Δ (no-filter vs backtest)')).toBeVisible();
    await expect(exp.getByTestId('compare-pair-badge'))
      .toContainText('multi_tf_rsi_confluence_nilusdt_x50_nofilter');
    // sample size for sibling = 34
    await expect(exp.getByTestId('compare-pair-badge')).toContainText('34');
    // The avg_trades_per_day row carries a live-no-filter cell (13.6 trades)
    await expect(exp.getByTestId('drift-live-nofilter-avg_trades_per_day'))
      .toBeVisible();
  });

  test('chart tab surfaces shadow signal count when sibling exists', async ({ page }) => {
    await page.goto('/fleet');
    await page.getByTestId('champion-row-multi_tf_rsi_confluence_nilusdt_x50').click();
    const exp = page.getByTestId('champion-expansion-multi_tf_rsi_confluence_nilusdt_x50');
    await exp.getByTestId('tab-chart').click();
    // Shadow count badge visible — 3 markers in our fixture
    await expect(exp.getByTestId('shadow-marker-count')).toContainText('3');
    // Chart panel + 3 panel-titles render
    await expect(exp.getByText('Backtest', { exact: true })).toBeVisible();
    await expect(exp.getByText('Live', { exact: true })).toBeVisible();
    // Live panel label mentions the shadow source
    await expect(exp.getByText(/orange = filter-off shadow/)).toBeVisible();
  });
});
