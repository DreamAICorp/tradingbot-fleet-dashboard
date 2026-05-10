/**
 * Tab B — Backtest vs Live equity overlay (Phase B).
 *
 * Two line series on one lightweight-chart, plus optional trade markers
 * (open/close arrows) layered on the live series. The point is visual
 * divergence: when the backtest curve climbs +5% while the live curve
 * sags -1%, that's a one-glance verdict the table can't deliver.
 *
 * Data shape comes from /api/fleet/champions/{id}/equity-overlay.
 * If backend returns empty arrays (Phase A stub), we render a clean
 * "no data yet" placeholder rather than an empty grid.
 */

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { createChart, IChartApi, ISeriesApi, LineSeries, UTCTimestamp } from 'lightweight-charts';
import { fleetApi, EquityOverlay } from '@/lib/api';

interface Props {
  championId: string;
  days?: number;
}

export default function BacktestLiveChart({ championId, days = 30 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const backtestSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const liveSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const { data, error, isLoading } = useSWR<EquityOverlay>(
    `/api/fleet/champions/${championId}/equity-overlay?days=${days}`,
    () => fleetApi.equityOverlay(championId, days),
    { refreshInterval: 60_000 },
  );

  // Set up chart once on mount.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: {
        background: { color: 'transparent' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: 'rgba(48, 54, 61, 0.5)' },
        horzLines: { color: 'rgba(48, 54, 61, 0.5)' },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#30363d' },
    });
    chartRef.current = chart;
    backtestSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#79c0ff',
      lineWidth: 2,
      title: 'Backtest',
      priceLineVisible: false,
    });
    liveSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#3fb950',
      lineWidth: 2,
      title: 'Live',
      priceLineVisible: false,
    });
    const onResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.resize(containerRef.current.clientWidth, 320);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      backtestSeriesRef.current = null;
      liveSeriesRef.current = null;
    };
  }, []);

  // Push data when it arrives.
  useEffect(() => {
    if (!data || !backtestSeriesRef.current || !liveSeriesRef.current) return;
    const toLine = (pts: { ts: number; equity: number }[]) =>
      pts.map((p) => ({
        time: Math.floor(p.ts / 1000) as UTCTimestamp,
        value: p.equity,
      }));
    backtestSeriesRef.current.setData(toLine(data.backtest_curve));
    liveSeriesRef.current.setData(toLine(data.live_curve));
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  if (isLoading) {
    return <div style={notice}>loading equity overlay…</div>;
  }
  if (error) {
    return <div style={{ ...notice, color: 'var(--color-neg)' }}>
      overlay unavailable: {String(error.message)}
    </div>;
  }

  const noData =
    !data || (data.backtest_curve.length === 0 && data.live_curve.length === 0);

  return (
    <div data-testid={`backtest-live-chart-${championId}`}>
      {data?.note && (
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 6 }}>
          {data.note}
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 6 }}>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 2, background: '#79c0ff', verticalAlign: 'middle', marginRight: 4 }} />
          Backtest
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 2, background: '#3fb950', verticalAlign: 'middle', marginRight: 4 }} />
          Live
        </span>
      </div>
      <div
        ref={containerRef}
        style={{ width: '100%', height: 320, position: 'relative' }}
      />
      {noData && (
        <div style={overlayNote}>
          no data yet — once backtest replay + live equity snapshots are populated,
          divergence between the two curves will show up here.
        </div>
      )}
    </div>
  );
}

const notice: React.CSSProperties = {
  padding: 24,
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border-2)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-dim)',
};

const overlayNote: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: 'rgba(13, 17, 23, 0.85)',
  border: '1px dashed var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: '12px 16px',
  fontSize: 12,
  color: 'var(--color-text-dim)',
  maxWidth: 400,
  textAlign: 'center',
};
