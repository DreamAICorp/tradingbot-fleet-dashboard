/**
 * Tab B — Candlestick OHLCV with entry/exit markers, side-by-side for
 * Backtest and Live.
 *
 * Two stacked lightweight-charts panels share the same time axis:
 *   - Top: BACKTEST candles + signals (entries from realistic_backtest engine)
 *   - Bottom: LIVE candles + signals (entries/exits from paper_trades)
 *
 * Visual divergence is the killer feature — when the backtest fired 8 entries
 * in a window and live fired 30, the marker count tells the story before
 * any number does.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  createChart,
  CandlestickSeries,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  SeriesMarker,
  LineStyle,
  createSeriesMarkers,
} from 'lightweight-charts';
import { fleetApi, ChartData, ChartSignal } from '@/lib/api';

interface Props {
  championId: string;
}

const INTERVAL_OPTIONS = [
  { label: '1m',  v: 1   },
  { label: '5m',  v: 5   },
  { label: '15m', v: 15  },
  { label: '1h',  v: 60  },
  { label: '4h',  v: 240 },
];
const DAYS_OPTIONS = [1, 3, 7, 14, 30];

export default function BacktestLiveChart({ championId }: Props) {
  const [days, setDays] = useState(7);
  const [interval, setInterval] = useState(15);

  const { data, error, isLoading } = useSWR<ChartData>(
    `/api/fleet/champions/${championId}/chart-data?days=${days}&interval=${interval}`,
    () => fleetApi.chartData(championId, days, interval),
    { refreshInterval: 60_000 },
  );

  return (
    <div data-testid={`backtest-live-chart-${championId}`}>
      <div style={controlBar}>
        <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
          {data?.symbol} · {data?.candles?.length ?? 0} bars · live signals: {data?.live_signals?.length ?? 0} · backtest signals: {data?.backtest_signals?.length ?? 0}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
                  style={selectStyle}>
            {DAYS_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}d</option>
            ))}
          </select>
          <select value={interval} onChange={(e) => setInterval(Number(e.target.value))}
                  style={selectStyle}>
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <div style={notice}>loading chart data…</div>}
      {error && (
        <div style={{ ...notice, color: 'var(--color-neg)' }}>
          chart data unavailable: {String(error.message)}
        </div>
      )}
      {data && (
        <>
          <ChartPanel
            title="Backtest"
            label="signals replayed by realistic_backtest engine"
            candles={data.candles}
            signals={data.backtest_signals}
            color="#79c0ff"
          />
          <ChartPanel
            title="Live"
            label="signals from paper_trades"
            candles={data.candles}
            signals={data.live_signals}
            color="#3fb950"
          />
        </>
      )}
    </div>
  );
}

interface PanelProps {
  title: string;
  label: string;
  candles: ChartData['candles'];
  signals: ChartSignal[];
  color: string;
}

function ChartPanel({ title, label, candles, signals, color }: PanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Convert candles to lightweight-charts format
  const chartCandles = useMemo(
    () =>
      candles.map((c) => ({
        time: Math.floor(c.ts / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    [candles],
  );

  // Convert signals to markers
  const markers = useMemo<SeriesMarker<UTCTimestamp>[]>(
    () =>
      signals
        .map<SeriesMarker<UTCTimestamp> | null>((s) => {
          const buy = (s.side === 'long' && s.type === 'entry')
                    || (s.side === 'short' && s.type === 'exit');
          return {
            time: Math.floor(s.ts / 1000) as UTCTimestamp,
            position: buy ? 'belowBar' : 'aboveBar',
            color: buy ? '#26a69a' : '#ef5350',
            shape: buy ? 'arrowUp' : 'arrowDown',
            text:
              s.type === 'entry'
                ? (s.side === 'long' ? 'L' : 'S')
                : (s.pnl !== undefined
                    ? (s.pnl >= 0 ? `+$${s.pnl.toFixed(2)}` : `-$${Math.abs(s.pnl).toFixed(2)}`)
                    : 'X'),
          };
        })
        .filter((m): m is SeriesMarker<UTCTimestamp> => m !== null)
        .sort((a, b) => (a.time as number) - (b.time as number)),
    [signals],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 260,
      layout: {
        background: { color: 'transparent' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: 'rgba(48, 54, 61, 0.4)' },
        horzLines: { color: 'rgba(48, 54, 61, 0.4)' },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#30363d' },
      rightPriceScale: { borderColor: '#30363d' },
      crosshair: { mode: 1, vertLine: { style: LineStyle.Dashed }, horzLine: { style: LineStyle.Dashed } },
    });
    chartRef.current = chart;
    seriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    const onResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.resize(containerRef.current.clientWidth, 260);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(chartCandles);
    if (markers.length > 0) {
      createSeriesMarkers(seriesRef.current, markers);
    }
    chartRef.current?.timeScale().fitContent();
  }, [chartCandles, markers]);

  return (
    <section style={panelStyle} data-testid={`panel-${title.toLowerCase()}`}>
      <header style={panelHeader}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <strong style={{ color }}>{title}</strong>
          <span style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>
            {label} · {signals.length} markers
          </span>
        </div>
      </header>
      <div ref={containerRef} style={{ width: '100%', height: 260 }} />
      {chartCandles.length === 0 && (
        <div style={emptyOverlay}>
          no candles in cache for this window
        </div>
      )}
      {chartCandles.length > 0 && signals.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-dim)',
                       textAlign: 'center', marginTop: 4 }}>
          no signals in this window
        </div>
      )}
    </section>
  );
}

const controlBar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
};

const selectStyle: React.CSSProperties = {
  background: 'var(--color-bg-elev)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  padding: '3px 6px',
  fontSize: 12,
};

const panelStyle: React.CSSProperties = {
  marginBottom: 12,
};

const panelHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 4,
};

const notice: React.CSSProperties = {
  padding: 16,
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border-2)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-dim)',
};

const emptyOverlay: React.CSSProperties = {
  textAlign: 'center',
  padding: 8,
  color: 'var(--color-text-dim)',
  fontSize: 12,
};
