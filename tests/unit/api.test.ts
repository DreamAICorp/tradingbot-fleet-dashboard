import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fleetApi, ApiError } from '@/lib/api';

describe('fleet REST client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('overview hits /api/fleet/overview and returns parsed JSON', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ champions_active: 5, champions_total: 15, drift_pct: 33,
                            last_tick_ts: 1, windows: {} }),
    });
    const r = await fleetApi.overview();
    expect(r.champions_active).toBe(5);
    expect(fetch).toHaveBeenCalledWith('/api/fleet/overview', undefined);
  });

  it('throws ApiError with status + body on non-2xx', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'backend down for maintenance',
    });
    await expect(fleetApi.overview()).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
    });
  });

  it('compare URL-encodes the champion id', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ champion_id: 'x', metrics: [], sample_size: 0 }),
    });
    await fleetApi.compare('multi/tf rsi/btc');
    expect(fetch).toHaveBeenCalledWith(
      '/api/fleet/champions/multi%2Ftf%20rsi%2Fbtc/compare',
      undefined,
    );
  });

  it('logs uses default lines=200 and level=INFO', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    await fleetApi.logs('btc');
    expect(fetch).toHaveBeenCalledWith(
      '/api/fleet/champions/btc/logs?lines=200&level=INFO',
      undefined,
    );
  });

  it('decisions limit defaults to 200', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    await fleetApi.decisions('btc');
    expect(fetch).toHaveBeenCalledWith(
      '/api/fleet/champions/btc/decisions?limit=200',
      undefined,
    );
  });

  it('ApiError exposes status + truncated body', () => {
    const e = new ApiError(500, 'a'.repeat(500));
    expect(e.status).toBe(500);
    expect(e.message.length).toBeLessThan(220);
    expect(e.message.startsWith('HTTP 500:')).toBe(true);
  });
});
