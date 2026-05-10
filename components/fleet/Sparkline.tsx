import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface Props {
  data: { ts: number; pnl: number }[];
  width?: number | string;
  height?: number;
}

/**
 * Compact 24h PnL sparkline for the strategy table row. Color follows the
 * net PnL direction so a row's drift jumps out without reading numbers.
 */
export default function Sparkline({ data, width = 80, height = 22 }: Props) {
  if (!data || data.length < 2) {
    return <span style={{ color: 'var(--color-text-mute)' }}>—</span>;
  }
  const last = data[data.length - 1].pnl;
  const stroke = last >= 0 ? 'var(--color-pos)' : 'var(--color-neg)';
  return (
    <div style={{ width, height }} data-testid="sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="pnl"
            stroke={stroke}
            strokeWidth={1.4}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
