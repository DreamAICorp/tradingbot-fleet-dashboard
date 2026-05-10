/**
 * Phase C — capital allocation across the fleet (3 grouping axes).
 *
 * Shows which family / symbol / leverage tier holds % of fleet equity.
 * Concentration above 50% in any single slice = ensemble risk.
 */

import useSWR from 'swr';
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { fleetApi, CapitalAllocationPayload, AllocationSlice } from '@/lib/api';
import { fmtUsd, fmtPct } from '@/lib/format';

const PALETTE = [
  '#58a6ff', '#3fb950', '#d29922', '#f85149', '#79c0ff',
  '#a371f7', '#26a69a', '#ef5350', '#7bc8a4', '#bd561d',
];

interface AxisProps {
  title: string;
  slices: AllocationSlice[];
}

function AllocationAxis({ title, slices }: AxisProps) {
  if (!slices || slices.length === 0) {
    return (
      <div style={card}>
        <div style={cardHeading}>{title}</div>
        <div style={{ color: 'var(--color-text-dim)' }}>no allocation</div>
      </div>
    );
  }
  // Sort desc, top 8 + "other"
  const sorted = [...slices].sort((a, b) => b.pct - a.pct);
  const display = sorted.length > 8
    ? [...sorted.slice(0, 7), {
        key: 'other',
        pct: sorted.slice(7).reduce((s, x) => s + x.pct, 0),
        equity_usd: sorted.slice(7).reduce((s, x) => s + x.equity_usd, 0),
      }]
    : sorted;

  return (
    <div style={card} data-testid={`alloc-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div style={cardHeading}>{title}</div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={display}
              dataKey="pct"
              nameKey="key"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              isAnimationActive={false}
              label={(p: any) => p.pct >= 5 ? `${p.key} ${p.pct.toFixed(0)}%` : ''}
              labelLine={false}
            >
              {display.map((_s, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--color-bg-elev)',
                border: '1px solid var(--color-border)',
                fontSize: 12,
              }}
              formatter={(v: number, _n: string, ent: any) => [
                `${fmtPct(v, 1)} (${fmtUsd(ent?.payload?.equity_usd)})`,
                ent?.payload?.key,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function CapitalAllocationPie() {
  const { data, error, isLoading } = useSWR<CapitalAllocationPayload>(
    '/api/fleet/capital-allocation',
    fleetApi.capitalAlloc,
    { refreshInterval: 60_000 },
  );

  if (isLoading) return <div style={notice}>loading capital allocation…</div>;
  if (error) return <div style={{ ...notice, color: 'var(--color-neg)' }}>
    capital allocation unavailable: {String(error.message)}
  </div>;
  if (!data) return null;

  return (
    <section data-testid="capital-allocation">
      <h3 style={heading}>Capital allocation</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <AllocationAxis title="By family"        slices={data.by_family} />
        <AllocationAxis title="By symbol"        slices={data.by_symbol} />
        <AllocationAxis title="By leverage tier" slices={data.by_leverage_tier} />
      </div>
    </section>
  );
}

const heading: React.CSSProperties = {
  fontSize: 13,
  margin: '0 0 8px 0',
  color: 'var(--color-text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const card: React.CSSProperties = {
  background: 'var(--color-bg-elev)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: 12,
};

const cardHeading: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--color-text-dim)',
  marginBottom: 4,
};

const notice: React.CSSProperties = {
  padding: 16,
  background: 'var(--color-bg-elev)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  color: 'var(--color-text-dim)',
};
