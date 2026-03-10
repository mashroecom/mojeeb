'use client';

import { Loader2, PieChart as PieChartIcon, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DataPoint {
  name: string;
  value: number;
  color?: string;
}

interface MojeebDonutChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
  isLoading?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  emptyMessage?: string;
  noDataMessage?: string; // alias for emptyMessage
  innerRadius?: number;
  outerRadius?: number;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // green
  '#f59e0b', // orange
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
];

export function MojeebDonutChart({
  data,
  title,
  height = 300,
  isLoading = false,
  showLegend = true,
  showTooltip = true,
  emptyMessage,
  noDataMessage,
  innerRadius = 60,
  outerRadius = 100,
}: MojeebDonutChartProps) {
  const actualEmptyMessage = emptyMessage || noDataMessage || 'No data available';
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        {title && (
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="h-5 w-5 text-muted-foreground" />
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
            <PieChartIcon className="h-5 w-5 text-muted-foreground" />
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
          <PieChartIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={true}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              />
            ))}
          </Pie>
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
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
