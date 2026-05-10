/**
 * Multiplexed WebSocket for fleet live updates. One socket for the whole
 * dashboard — components subscribe to per-champion event streams via the
 * same connection rather than opening 15 sockets.
 *
 * Phase A reuses the existing /ws/paper channel from tradingbot-platform.
 * Phase B switches to /ws/fleet/champions which adds drift_flag_raised events
 * and proper subscription filters.
 */

export type FleetEvent =
  | { type: 'trade_closed';     champion_id: string; ts: number; pnl_usd: number; side: 'long' | 'short'; }
  | { type: 'equity_updated';   champion_id: string; ts: number; equity_usd: number; }
  | { type: 'position_opened';  champion_id: string; ts: number; entry: number; side: 'long' | 'short'; }
  | { type: 'position_closed';  champion_id: string; ts: number; pnl_usd: number; }
  | { type: 'drift_flag_raised'; champion_id: string; ts: number; flag: string; severity: 'YELLOW' | 'RED'; }
  | { type: 'ping';             ts: number; };

type Listener = (ev: FleetEvent) => void;

export interface FleetWsClient {
  subscribe(listener: Listener): () => void;
  close(): void;
  readonly connected: boolean;
}

export function connectFleetWs(path: string = '/ws/paper'): FleetWsClient {
  // Build an absolute ws:// URL — Next's rewrites handle plain HTTP fetch
  // but the WebSocket constructor needs an absolute origin in the browser.
  let url: string;
  if (typeof window === 'undefined') {
    url = path; // SSR — the client will reconnect once mounted
  } else {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    url = `${proto}//${window.location.host}${path}`;
  }

  let ws: WebSocket | null = null;
  let listeners: Listener[] = [];
  let alive = true;
  let reconnectDelay = 1000;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let connected = false;

  function open() {
    if (!alive || typeof window === 'undefined') return;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      connected = true;
      reconnectDelay = 1000;
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as FleetEvent;
        listeners.forEach((l) => l(data));
      } catch {
        // ignore malformed frames; backend sends 30s ping as JSON {type:'ping'}
      }
    };
    ws.onerror = () => {
      // onerror is informational — onclose handles the reconnect
    };
    ws.onclose = () => {
      connected = false;
      ws = null;
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (!alive) return;
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      open();
    }, reconnectDelay);
  }

  open();

  return {
    subscribe(listener) {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
    close() {
      alive = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) ws.close();
      listeners = [];
    },
    get connected() {
      return connected;
    },
  };
}
