/**
 * Phase C — edge attribution overlay.
 *
 * Three lines on the same chart:
 *   - strategy live equity
 *   - buy-and-hold the same symbol over the same period
 *   - do-nothing baseline (constant 100)
 *
 * If strategy doesn't beat buy-and-hold by enough margin to justify
 * the leverage + fee risk, it's spinning.
 */

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { createChart, IChartApi, ISeriesApi, LineSeries, UTCTimestamp } from 'lightweight-charts';
import { fleetApi, EdgeAttributionPayload } from '@/lib/api';

interface Props {
  championId: string;
  days?: number;
}

export default function EdgeAttributionChart({ championId, days = 30 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const stratRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bnhRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dnRef = useRef<ISeriesApi<'Line'> | null>(null);

  const { data, error, isLoading } = useSWR<EdgeAttributionPayload>(
    `/api/fleet/champions/${championId}/edge-attribution?days=${days}`,
    () => fleetApi.edgeAttribution(championId, days),
    { refreshInterval: 5 * 60_000 },
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 280,
      layout: { background: { color: 'transparent' }, textColor: '#8b949e' },
      grid: {
        vertLines: { color: 'rgba(48, 54, 61, 0.5)' },
        horzLines: { color: 'rgba(48, 54, 61, 0.5)' },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#30363d' },
    });
    chartRef.current = chart;
    stratRef.current = chart.addSeries(LineSeries, { color: '#3fb950', lineWidth: 2, title: 'Strategy' });
    bnhRef.current   = chart.addSeries(LineSeries, { color: '#79c0ff', lineWidth: 2, title: 'Buy & hold' });
    dnRef.current    = chart.addSeries(LineSeries, { color: '#8b949e', lineWidth: 1, title: 'Do nothing' });
    const onResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.resize(containerRef.current.clientWidth, 280);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      stratRef.current = null;
      bnhRef.current = null;
      dnRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!data || !stratRef.current || !bnhRef.current || !dnRef.current) return;
    const time = (ts: number) => Math.floor(ts / 1000) as UTCTimestamp;
    stratRef.current.setData(data.curves.map((p) => ({ time: time(p.ts), value: p.strategy })));
    bnhRef.current.setData(data.curves.map((p)   => ({ time: time(p.ts), value: p.buy_and_hold })));
    dnRef.current.setData(data.curves.map((p)    => ({ time: time(p.ts), value: p.do_nothing })));
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  if (isLoading) return <div style={notice}>loading edge attribution…</div>;
  if (error) return <div style={{ ...notice, color: 'var(--color-neg)' }}>
    edge attribution unavailable: {String(error.message)}
  </div>;

  const noData = !data || data.curves.length === 0;

  return (
    <section data-testid={`edge-attribution-${championId}`}>
      <h3 style={heading}>Edge attribution · strategy vs buy-and-hold vs do-nothing</h3>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 6 }}>
        <span><span style={dot('#3fb950')} />Strategy</span>
        <span><span style={dot('#79c0ff')} />Buy &amp; hold</span>
        <span><span style={dot('#8b949e')} />Do nothing (100)</span>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 280, position: 'relative' }} />
      {noData && (
        <div style={overlayNote}>
          no overlap yet between live equity snapshots and the symbol&apos;s price history.
          Edge attribution becomes meaningful at ≥5 trade-days.
        </div>
      )}
    </section>
  );
}

function dot(color: string): React.CSSProperties {
  return {
    display: 'inline-block',
    width: 10,
    height: 2,
    background: color,
    verticalAlign: 'middle',
    marginRight: 4,
  };
}

const heading: React.CSSProperties = {
  fontSize: 13,
  margin: '0 0 8px 0',
  color: 'var(--color-text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const notice: React.CSSProperties = {
  padding: 16,
  background: 'var(--color-bg-elev)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  color: 'var(--color-text-dim)',
};

const overlayNote: React.CSSProperties = {
  position: 'absolute',
  top: '50%', left: '50%',
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
