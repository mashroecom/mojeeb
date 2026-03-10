'use client';

import { Loader2, BarChart3, AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
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

interface BarConfig {
  dataKey?: string;
  key?: string; // alias for dataKey
  fill?: string;
  color?: string; // alias for fill
  name?: string;
  stackId?: string;
}

interface MojeebBarChartProps {
  data: DataPoint[];
  bars: BarConfig[];
  xAxisKey?: string;
  xKey?: string; // alias for xAxisKey
  title?: string;
  height?: number;
  isLoading?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  emptyMessage?: string;
  noDataMessage?: string; // alias for emptyMessage
  formatX?: (value: any) => string;
  formatY?: (value: any) => string;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // green
  '#f59e0b', // orange
  '#ef4444', // red
  '#06b6d4', // cyan
];

export function MojeebBarChart({
  data,
  bars,
  xAxisKey,
  xKey,
  title,
  height = 300,
  isLoading = false,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  emptyMessage,
  noDataMessage,
  formatX,
  formatY,
}: MojeebBarChartProps) {
  const actualXKey = xAxisKey || xKey || 'x';
  const actualEmptyMessage = emptyMessage || noDataMessage || 'No data available';
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        {title && (
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
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
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        )}
        <div
          className="flex flex-col items-center justify-center text-muted-foreground"
          style={{ height }}
        >
          <AlertCircle className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">{actualEmptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      {title && (
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          )}
          <XAxis
            dataKey={actualXKey}
            className="text-xs text-muted-foreground"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={formatX}
          />
          <YAxis
            className="text-xs text-muted-foreground"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={formatY}
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
          {bars.map((bar, index) => {
            const dataKey = bar.dataKey || bar.key || `bar-${index}`;
            const fill = bar.fill || bar.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
            return (
              <Bar
                key={dataKey}
                dataKey={dataKey}
                fill={fill}
                name={bar.name || dataKey}
                stackId={bar.stackId}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
