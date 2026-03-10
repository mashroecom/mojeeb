'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineChartProps {
  data: Array<{ value: number }>;
  height?: number;
  width?: number;
  color?: string;
}

export function SparklineChart({
  data,
  height = 40,
  width = 160,
  color = '#3b82f6',
}: SparklineChartProps) {
  // Don't render if no data
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-muted/20 rounded"
        style={{ height, width }}
      >
        <span className="text-xs text-muted-foreground">No data</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
