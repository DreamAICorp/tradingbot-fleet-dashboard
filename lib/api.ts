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
}

export interface DriftCompare {
  champion_id: string;
  metrics: {
    name: string;
    backtest: number | null;
    simulation: number | null;
    live: number | null;
    delta_pct: number | null;       // (live - backtest) / backtest
    unit: 'pct' | 'count' | 'usd' | 'ratio';
  }[];
  sample_size: number;              // n_trades live — drives confidence intervals
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

export const fleetApi = {
  overview: () => getJson<FleetOverview>('/api/fleet/overview'),

  champions: () => getJson<ChampionRow[]>('/api/fleet/champions'),

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
};

export { ApiError };
