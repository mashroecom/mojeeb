'use client';

import { Loader2, LineChartIcon, AlertCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  [key: string]: string | number;
}

interface LineConfig {
  dataKey: string;
  stroke?: string;
  name?: string;
  strokeWidth?: number;
}

interface MojeebLineChartProps {
  data: DataPoint[];
  lines: LineConfig[];
  xAxisKey: string;
  title?: string;
  height?: number;
  isLoading?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  emptyMessage?: string;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // green
  '#f59e0b', // orange
  '#ef4444', // red
  '#06b6d4', // cyan
];

export function MojeebLineChart({
  data,
  lines,
  xAxisKey,
  title,
  height = 300,
  isLoading = false,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  emptyMessage = 'No data available',
}: MojeebLineChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        {title && (
          <div className="flex items-center gap-2 mb-6">
            <LineChartIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        )}
        <div className="flex items-center justify-center" style={{ height }}>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        {title && (
          <div className="flex items-center gap-2 mb-6">
            <LineChartIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        )}
        <div
          className="flex flex-col items-center justify-center text-muted-foreground"
          style={{ height }}
        >
          <AlertCircle className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      {title && (
        <div className="flex items-center gap-2 mb-6">
          <LineChartIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          )}
          <XAxis
            dataKey={xAxisKey}
            className="text-xs text-muted-foreground"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            className="text-xs text-muted-foreground"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          {showTooltip && (
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
          )}
          {showLegend && <Legend />}
          {lines.map((line, index) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              strokeWidth={line.strokeWidth || 2}
              name={line.name || line.dataKey}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
