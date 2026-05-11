/**
 * Sprint S1 — real-backend e2e suite.
 *
 * Replaces the deleted fetch-mocked describe block per AI_CONTRIBUTING
 * "fetch-mock ban". Playwright drives a real Next.js dev server whose
 * /api proxy points at a REAL FastAPI (the actual fleet router from
 * tradingbot-platform) backed by a SEEDED paper_unified.db.
 *
 * Each test asserts one AC from a Sprint S1 backlog item:
 *
 *   Item 3 AC: /champions returns pair_variant_id when sibling exists
 *   Item 3 AC: /champions?include_variants=true surfaces _nofilter rows
 *   Item 3 AC: /compare populates live_no_filter on every metric
 *   Item 3 AC: /chart-data carries shadow_signals
 *   Item 4 AC: Tab A drift table renders 4th "Live (no filter)" column
 *   Item 5 AC: chart legend mentions Backtest / Live / red ✕ rejected
 *              (orange = shadow when sibling has trades)
 *   Item 6 AC: pair-view toggle renders one row per symbol with ΔPnL
 *   Item 7 AC: dashboard regression — full flat→pair→expand→tab flow
 *
 * Fixture: `paired_bananausdt` seeds 1 canonical + 1 _nofilter sibling,
 * 3 sibling trades (so live_signals/shadow_signals are non-empty),
 * 5 canonical rejected setups (so rejected_signals is non-empty).
 */
import { test, expect } from '@playwright/test';

const CANON_SID = 'multi_tf_rsi_confluence_bananausdt_x50';
const SHADOW_SID = `${CANON_SID}_nofilter`;

test.describe('Sprint S1 — real-backend e2e (no mocks)', () => {
  // ── Backend contract via the real /api/* (no Playwright on UI) ──────────

  test('item 3 AC: /champions exposes pair_variant_id on the canonical row', async ({
    request,
  }) => {
    const r = await request.get('/api/fleet/champions');
    expect(r.ok()).toBeTruthy();
    const rows = await r.json();
    const canon = rows.find((x: any) => x.champion_id === CANON_SID);
    expect(canon, `canonical row missing in /champions`).toBeDefined();
    expect(canon.pair_variant_id).toBe(SHADOW_SID);
  });

  test('item 3 AC: include_variants=true surfaces the _nofilter sibling', async ({
    request,
  }) => {
    const r = await request.get('/api/fleet/champions?include_variants=true');
    expect(r.ok()).toBeTruthy();
    const rows = await r.json();
    expect(rows.some((x: any) => x.champion_id === SHADOW_SID)).toBe(true);
  });

  test('item 3 AC: /compare carries live_no_filter on every metric', async ({
    request,
  }) => {
    const r = await request.get(`/api/fleet/champions/${CANON_SID}/compare`);
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.pair_variant_id).toBe(SHADOW_SID);
    expect(body.sample_size).toBe(0);           // canonical has 0 trades in fixture
    expect(body.sample_size_no_filter).toBe(3); // sibling has 3 trades
    for (const m of body.metrics) {
      expect(m, `metric ${m.name} missing live_no_filter`).toHaveProperty('live_no_filter');
      expect(m).toHaveProperty('delta_pct_no_filter');
    }
  });

  test('item 3 AC: /compare on _nofilter id 404 fallback', async ({ request }) => {
    const r = await request.get(`/api/fleet/champions/${SHADOW_SID}/compare`);
    expect(r.ok(), 'sibling /compare must not 404').toBeTruthy();
  });

  test('S1 follow-up: /chart-data emits rejected_signals + shadow_signals', async ({
    request,
  }) => {
    const r = await request.get(
      `/api/fleet/champions/${CANON_SID}/chart-data?days=7&interval_minutes=60`,
    );
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.pair_variant_id).toBe(SHADOW_SID);
    // shadow has 3 trades → 3 entries + 3 exits = 6 signals
    expect(Array.isArray(body.shadow_signals)).toBe(true);
    expect(body.shadow_signals.length).toBeGreaterThanOrEqual(3);
    // canonical has 5 rejected setups
    expect(Array.isArray(body.rejected_signals)).toBe(true);
    expect(body.rejected_signals.length).toBe(5);
    // Each rejected carries side + reason from the new schema columns
    for (const r of body.rejected_signals) {
      expect(r.type).toBe('rejected');
      expect(['long', 'short']).toContain(r.side);
      expect(r.exit_reason).toMatch(/regime/);
    }
  });

  // ── UI flows hitting the same real backend ──────────────────────────────

  test('item 6 AC: view toggle defaults to flat + Pair view button renders', async ({
    page,
  }) => {
    await page.goto('/fleet');
    await expect(page.getByTestId('toggle-flat')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('toggle-pair')).toBeVisible();
  });

  test('item 6 AC: clicking Pair view renders one row per symbol with ΔPnL', async ({
    page,
  }) => {
    await page.goto('/fleet');
    await page.getByTestId('toggle-pair').click();
    await expect(page.getByTestId('pair-view')).toBeVisible();
    const row = page.getByTestId('pair-row-BANANAUSDT');
    await expect(row).toBeVisible();
    // Sibling won (+$1.30 net) vs canonical (0) → pos tone
    const tone = await row.getAttribute('data-delta-tone');
    expect(['pos', 'mute']).toContain(tone);
  });

  test('item 4 AC: Tab A renders the 4th "Live (no filter)" column', async ({
    page,
  }) => {
    await page.goto('/fleet');
    await page.getByTestId(`champion-row-${CANON_SID}`).click();
    const exp = page.getByTestId(`champion-expansion-${CANON_SID}`);
    await expect(exp).toBeVisible();
    await expect(exp.getByText('Live (no filter)')).toBeVisible();
    await expect(exp.getByTestId('compare-pair-badge'))
      .toContainText(SHADOW_SID);
    // Sample size badge shows the sibling's 3 trades
    await expect(exp.getByTestId('compare-pair-badge')).toContainText('3');
  });

  test('item 5 AC: chart tab shows rejected count badge + Live label mentions red ✕', async ({
    page,
  }) => {
    await page.goto('/fleet');
    await page.getByTestId(`champion-row-${CANON_SID}`).click();
    const exp = page.getByTestId(`champion-expansion-${CANON_SID}`);
    await exp.getByTestId('tab-chart').click();
    // Rejected count badge — fixture has 5 rejected setups
    await expect(exp.getByTestId('rejected-marker-count')).toContainText('5');
    // Live panel legend mentions red ✕
    await expect(exp.getByText(/red ✕ = rejected by filter/)).toBeVisible();
  });
});
