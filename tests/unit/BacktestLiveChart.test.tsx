/**
 * Sprint S1 — BacktestLiveChart 3-color markers unit tests.
 *
 * The chart itself uses lightweight-charts (canvas + d3), which is hostile
 * to jsdom. We test the marker-building logic + color palette in isolation
 * via the exported `signalToMarker` helper and color constants — that's
 * the only logic that determines what the operator sees on screen.
 *
 * AC: "Vitest test asserts marker series count = 2 in legacy mode,
 *      = 3 in paired mode" — interpreted as the dashboard renders 2 marker
 * colors in legacy mode (cyan backtest + green live) vs 3 in paired mode
 * (+ orange shadow). We assert that by counting distinct colors produced
 * by signalToMarker across the three signal sources.
 */
import { describe, it, expect } from 'vitest';
import {
  signalToMarker,
  BACKTEST_MARKER_COLOR,
  LIVE_MARKER_COLOR,
  SHADOW_MARKER_COLOR,
  REJECTED_MARKER_COLOR,
} from '@/components/fleet/BacktestLiveChart';
import type { ChartSignal } from '@/lib/api';

const sig = (s: 'long' | 'short', t: 'entry' | 'exit', pnl?: number): ChartSignal => ({
  ts: 1_700_000_000_000,
  side: s,
  type: t,
  price: 1.0,
  pnl,
});

describe('signalToMarker', () => {
  it('long-entry below the bar with arrowUp', () => {
    const m = signalToMarker(sig('long', 'entry'), LIVE_MARKER_COLOR);
    expect(m.position).toBe('belowBar');
    expect(m.shape).toBe('arrowUp');
    expect(m.color).toBe(LIVE_MARKER_COLOR);
    expect(m.text).toBe('L');
  });

  it('short-entry above the bar with arrowDown', () => {
    const m = signalToMarker(sig('short', 'entry'), LIVE_MARKER_COLOR);
    expect(m.position).toBe('aboveBar');
    expect(m.shape).toBe('arrowDown');
    expect(m.text).toBe('S');
  });

  it('exit with pnl renders ±$X label', () => {
    expect(signalToMarker(sig('long', 'exit', 2.5), LIVE_MARKER_COLOR).text)
      .toBe('+$2.50');
    expect(signalToMarker(sig('short', 'exit', -1.25), LIVE_MARKER_COLOR).text)
      .toBe('-$1.25');
  });

  it('preserves the caller-supplied color (cyan for backtest)', () => {
    expect(signalToMarker(sig('long', 'entry'), BACKTEST_MARKER_COLOR).color)
      .toBe('#79c0ff');
  });

  it('preserves the caller-supplied color (orange for shadow)', () => {
    expect(signalToMarker(sig('long', 'entry'), SHADOW_MARKER_COLOR).color)
      .toBe('#f39f3a');
  });
});

describe('marker palette — 3-color scheme', () => {
  // Building a synthetic chart-data scenario for the legacy vs paired
  // modes, the operator sees N distinct marker colors based on which
  // signal arrays are populated.
  function distinctColorsForScenario(
    backtest: ChartSignal[],
    live: ChartSignal[],
    shadow: ChartSignal[] | null,
  ): Set<string> {
    const all = [
      ...backtest.map((s) => signalToMarker(s, BACKTEST_MARKER_COLOR)),
      ...live.map((s) => signalToMarker(s, LIVE_MARKER_COLOR)),
      ...(shadow ?? []).map((s) => signalToMarker(s, SHADOW_MARKER_COLOR)),
    ];
    return new Set(all.map((m) => m.color));
  }

  it('legacy mode (no shadow) yields 2 distinct marker colors', () => {
    const colors = distinctColorsForScenario(
      [sig('long', 'entry')],
      [sig('long', 'entry')],
      null,
    );
    expect(colors.size).toBe(2);
    expect(colors).toContain(BACKTEST_MARKER_COLOR);
    expect(colors).toContain(LIVE_MARKER_COLOR);
    expect(colors).not.toContain(SHADOW_MARKER_COLOR);
  });

  it('paired mode (with shadow) yields 3 distinct marker colors', () => {
    const colors = distinctColorsForScenario(
      [sig('long', 'entry')],
      [sig('long', 'entry')],
      [sig('long', 'entry')],
    );
    expect(colors.size).toBe(3);
    expect(colors).toContain(BACKTEST_MARKER_COLOR);
    expect(colors).toContain(LIVE_MARKER_COLOR);
    expect(colors).toContain(SHADOW_MARKER_COLOR);
  });

  it('paired mode with empty shadow array yields 2 colors (no orange paint)', () => {
    // Empty array != null; both must skip orange.
    const colors = distinctColorsForScenario(
      [sig('long', 'entry')],
      [sig('long', 'entry')],
      [],
    );
    expect(colors.size).toBe(2);
    expect(colors).not.toContain(SHADOW_MARKER_COLOR);
  });

  it('palette uses spec-locked hex values (regression guard)', () => {
    // The hex values are the contract with the operator's mental model
    // ("cyan / green / orange / red") — locking them down so a casual
    // refactor can't silently break the visual semantics.
    expect(BACKTEST_MARKER_COLOR).toBe('#79c0ff');
    expect(LIVE_MARKER_COLOR).toBe('#3fb950');
    expect(SHADOW_MARKER_COLOR).toBe('#f39f3a');
    expect(REJECTED_MARKER_COLOR).toBe('#f85149');
  });
});

describe('rejected markers — Sprint S1 follow-up', () => {
  const rej = (s: 'long' | 'short' | null, reason = 'regime_not_allowed:choppy'): ChartSignal => ({
    ts: 1_700_000_000_000,
    side: s,
    type: 'rejected',
    price: 1.0,
    exit_reason: reason,
  });

  it('uses circle shape + aboveBar position regardless of side', () => {
    const m = signalToMarker(rej('long'), REJECTED_MARKER_COLOR);
    expect(m.shape).toBe('circle');
    expect(m.position).toBe('aboveBar');
    expect(m.color).toBe('#f85149');
  });

  it('renders L✕ when side is long', () => {
    expect(signalToMarker(rej('long'), REJECTED_MARKER_COLOR).text).toBe('L✕');
  });

  it('renders S✕ when side is short', () => {
    expect(signalToMarker(rej('short'), REJECTED_MARKER_COLOR).text).toBe('S✕');
  });

  it('renders plain ✕ when side is null (pre-fix DB rows)', () => {
    expect(signalToMarker(rej(null), REJECTED_MARKER_COLOR).text).toBe('✕');
  });

  it('paired mode (3 sources) + rejected = 4 distinct marker colors', () => {
    const all = [
      signalToMarker(
        { ts: 1, side: 'long', type: 'entry', price: 1 },
        BACKTEST_MARKER_COLOR,
      ),
      signalToMarker(
        { ts: 2, side: 'long', type: 'entry', price: 1 },
        LIVE_MARKER_COLOR,
      ),
      signalToMarker(
        { ts: 3, side: 'long', type: 'entry', price: 1 },
        SHADOW_MARKER_COLOR,
      ),
      signalToMarker(rej('long'), REJECTED_MARKER_COLOR),
    ];
    const colors = new Set(all.map((m) => m.color));
    expect(colors.size).toBe(4);
    expect(colors).toContain(REJECTED_MARKER_COLOR);
  });
});
