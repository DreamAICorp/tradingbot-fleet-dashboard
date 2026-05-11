/**
 * Typed REST client for the tradingbot-platform fleet endpoints.
 *
 * All paths go through Next's rewrite proxy in dev (next.config.js) or
 * Caddy in prod, so callers never embed a host. Errors throw with a
 * structured shape; caller decides whether to surface to the user.
 */

export type Window = '1d' | '7d' | '30d' | '60d' | '90d' | '1yr';

export interface FleetOverview {
  windows: Record<Window, {
    pnl_usd: number;
    fees_usd: number;
    n_trades: number;
    n_wins: number;
    win_rate: number | null;
  }>;
  champions_active: number;
  champions_total: number;
  drift_pct: number;        // % of champions with any RED divergence flag
  last_tick_ts: number;     // most-recent tick across all champions, ms
}

export interface ChampionRow {
  champion_id: string;
  symbol: string;
  family: string;
  variant: string;
  tf_label: string;
  leverage: number;
  status: 'GREEN' | 'YELLOW' | 'RED' | 'SUSPECT' | 'STALE';
  pnl_24h_usd: number;
  pnl_24h_sparkline: { ts: number; pnl: number }[];
  win_rate_24h: number | null;
  fees_pct_24h: number | null;     // fees / |gross_pnl|
  trades_ratio: number | null;     // live actual / contract expected
  liq_distance_pct: number | null; // null when no open position
  last_tick_ts: number | null;
  /** S1 — sibling strategy_id ("<id>_nofilter") when paired shadow exists. */
  pair_variant_id: string | null;
}

export interface DriftCompare {
  champion_id: string;
  /** S1 — _nofilter sibling strategy_id when paired shadow exists. */
  pair_variant_id: string | null;
  metrics: {
    name: string;
    backtest: number | null;
    simulation: number | null;
    live: number | null;
    /** S1 — same metric computed against the _nofilter sibling. null when no pair. */
    live_no_filter: number | null;
    delta_pct: number | null;       // (live - backtest) / backtest
    /** S1 — (live_no_filter - backtest) / backtest, mirrors delta_pct shape. */
    delta_pct_no_filter: number | null;
    unit: 'pct' | 'count' | 'usd' | 'ratio';
  }[];
  sample_size: number;              // n_trades live — drives confidence intervals
  /** S1 — n_trades on the _nofilter sibling within the same 24h window. */
  sample_size_no_filter: number | null;
}

export interface DecisionRow {
  ts: number;
  setups_returned: number;
  setups_acted: number;
  skip_stale: number;
  skip_dedup: number;
  skip_position_open: number;
  dir_weak: number;
  dir_medium: number;
  dir_strong: number;
}

export interface LogLine {
  ts: number;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
}

export interface Candle {
  ts: number;       // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartSignal {
  ts: number;
  /** side is null for rejected setups when the runner didn't record it
   *  (older paper_signal_checks rows pre-rejected_side column). */
  side: 'long' | 'short' | null;
  /** 'rejected' = strategy generated a setup the runner refused to act
   *  on (regime gate / stale / dedup / position open). Renders as a red
   *  ✕ on the Live panel. */
  type: 'entry' | 'exit' | 'rejected';
  price: number;
  pnl?: number;
  exit_reason?: string;
}

export interface ChartData {
  champion_id: string;
  /** S1 — _nofilter sibling strategy_id when paired shadow exists. */
  pair_variant_id: string | null;
  symbol: string;
  interval_minutes: number;
  days: number;
  candles: Candle[];
  live_signals: ChartSignal[];
  backtest_signals: ChartSignal[];
  /** S1 — entry+exit markers from the _nofilter sibling; null when no pair. */
  shadow_signals: ChartSignal[] | null;
  /** S1 follow-up — setups the canonical runner SAW but REFUSED to act
   *  on (regime filter / stale / dedup / position open). Rendered as
   *  red ✕ on the Live panel so the operator visually identifies where
   *  the filter mord. Always present; empty array when no rejects. */
  rejected_signals: ChartSignal[];
}

export interface EquityCurvePoint {
  ts: number;
  equity: number;
}

export interface TradeMarker {
  ts: number;
  price: number;
  side: 'long' | 'short';
  source: 'backtest' | 'live';
  pnl?: number;
}

export interface EquityOverlay {
  champion_id: string;
  days: number;
  backtest_curve: EquityCurvePoint[];
  live_curve: EquityCurvePoint[];
  backtest_markers?: TradeMarker[];
  live_markers?: TradeMarker[];
  note?: string;
}

export interface BrokerPosition {
  champion_id: string;
  venue: 'weex' | 'blofin' | 'paper';
  symbol: string;
  side: 'long' | 'short' | null;
  entry: number | null;
  mark: number | null;
  size: number | null;
  unrealized_pnl: number | null;
  liq_price: number | null;
  liq_distance_pct: number | null;
  fetched_at: number;
  available: boolean;     // false when broker client unavailable (Phase A)
}

class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = 'ApiError';
  }
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body);
  }
  return (await res.json()) as T;
}

/* Phase C — fleet-level analytics */

export interface OpenPositionRow {
  champion_id: string;
  symbol: string;
  side: 'long' | 'short';
  leverage: number;
  entry: number;
  mark: number;
  liq_price: number;
  liq_distance_pct: number;   // 100 = at entry, 0 = at liq line
  unrealized_pnl_usd: number;
}

export interface LiqHeatmapPayload {
  ts: number;
  positions: OpenPositionRow[];
}

export interface AllocationSlice {
  key: string;            // family or symbol or leverage tier
  pct: number;
  equity_usd: number;
}

export interface CapitalAllocationPayload {
  ts: number;
  by_family: AllocationSlice[];
  by_symbol: AllocationSlice[];
  by_leverage_tier: AllocationSlice[];
}

export interface QuietHoursCell {
  hour_utc: number;        // 0..23
  n_trades: number;
  pnl_usd: number;
}

export interface QuietHoursPayload {
  champion_id: string;
  cells: QuietHoursCell[];   // exactly 24 entries
  expected_per_hour: number; // contract / 24
}

export interface CorrelationCell {
  a: string;   // champion_id
  b: string;
  rho: number; // -1..1
  n_overlap: number; // bars overlap
}

export interface CorrelationPayload {
  ts: number;
  champions: string[];
  cells: CorrelationCell[];
}

export interface RunnerHealthRow {
  champion_id: string;
  unit: string;
  n_restarts: number;
  ws_reconnects_24h: number;
  last_tick_age_sec: number | null;
  active_since: number | null;
}

export interface RunnerHealthPayload {
  ts: number;
  rows: RunnerHealthRow[];
}

export interface EdgeAttributionPoint {
  ts: number;
  strategy: number;        // strategy equity at this point
  buy_and_hold: number;    // BTC/ETH/symbol naive long
  do_nothing: number;      // 100 forever
}

export interface EdgeAttributionPayload {
  champion_id: string;
  days: number;
  curves: EdgeAttributionPoint[];
}

export const fleetApi = {
  overview: () => getJson<FleetOverview>('/api/fleet/overview'),

  champions: (includeVariants = false) =>
    getJson<ChampionRow[]>(
      `/api/fleet/champions${includeVariants ? '?include_variants=true' : ''}`,
    ),

  compare: (id: string) =>
    getJson<DriftCompare>(`/api/fleet/champions/${encodeURIComponent(id)}/compare`),

  decisions: (id: string, limit = 200) =>
    getJson<DecisionRow[]>(
      `/api/fleet/champions/${encodeURIComponent(id)}/decisions?limit=${limit}`,
    ),

  logs: (id: string, lines = 200, level: LogLine['level'] = 'INFO') =>
    getJson<LogLine[]>(
      `/api/fleet/champions/${encodeURIComponent(id)}/logs?lines=${lines}&level=${level}`,
    ),

  equityOverlay: (id: string, days = 30) =>
    getJson<EquityOverlay>(
      `/api/fleet/champions/${encodeURIComponent(id)}/equity-overlay?days=${days}`,
    ),

  chartData: (id: string, days = 7, interval_minutes = 15) =>
    getJson<ChartData>(
      `/api/fleet/champions/${encodeURIComponent(id)}/chart-data?days=${days}&interval_minutes=${interval_minutes}`,
    ),

  brokerPosition: (id: string) =>
    getJson<BrokerPosition>(
      `/api/fleet/champions/${encodeURIComponent(id)}/broker-position`,
    ),

  // Phase C
  liqHeatmap:    () => getJson<LiqHeatmapPayload>('/api/fleet/liq-heatmap'),
  capitalAlloc:  () => getJson<CapitalAllocationPayload>('/api/fleet/capital-allocation'),
  correlation:   () => getJson<CorrelationPayload>('/api/fleet/correlation'),
  runnerHealth:  () => getJson<RunnerHealthPayload>('/api/fleet/runner-health'),
  quietHours:    (id: string) =>
    getJson<QuietHoursPayload>(`/api/fleet/champions/${encodeURIComponent(id)}/quiet-hours`),
  edgeAttribution: (id: string, days = 30) =>
    getJson<EdgeAttributionPayload>(
      `/api/fleet/champions/${encodeURIComponent(id)}/edge-attribution?days=${days}`,
    ),
};

export { ApiError };
