'use client';

import { Loader2, Grid3x3, AlertCircle } from 'lucide-react';

interface HeatmapDataPoint {
  x: string | number;
  y: string | number;
  value: number;
}

interface MojeebHeatmapChartProps {
  data: HeatmapDataPoint[];
  title?: string;
  height?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  colorScale?: {
    min: string;
    max: string;
  };
  showValues?: boolean;
  cellSize?: number;
}

const DEFAULT_COLOR_SCALE = {
  min: '#dbeafe', // blue-100
  max: '#1e40af', // blue-800
};

function getColor(
  value: number,
  min: number,
  max: number,
  colorScale: { min: string; max: string },
): string {
  if (min === max) {
    return colorScale.max;
  }

  const normalized = (value - min) / (max - min);

  // Parse hex colors
  const parseHex = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  };

  const minColor = parseHex(colorScale.min);
  const maxColor = parseHex(colorScale.max);

  const r = Math.round(minColor.r + normalized * (maxColor.r - minColor.r));
  const g = Math.round(minColor.g + normalized * (maxColor.g - minColor.g));
  const b = Math.round(minColor.b + normalized * (maxColor.b - minColor.b));

  return `rgb(${r}, ${g}, ${b})`;
}

export function MojeebHeatmapChart({
  data,
  title,
  height = 400,
  isLoading = false,
  emptyMessage = 'No data available',
  colorScale = DEFAULT_COLOR_SCALE,
  showValues = false,
  cellSize = 40,
}: MojeebHeatmapChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        {title && (
          <div className="flex items-center gap-2 mb-6">
            <Grid3x3 className="h-5 w-5 text-muted-foreground" />
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
            <Grid3x3 className="h-5 w-5 text-muted-foreground" />
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

  // Extract unique x and y labels
  const xLabels = Array.from(new Set(data.map((d) => d.x))).sort();
  const yLabels = Array.from(new Set(data.map((d) => d.y))).sort();

  // Create a map for quick lookup
  const dataMap = new Map<string, number>();
  data.forEach((d) => {
    dataMap.set(`${d.x}-${d.y}`, d.value);
  });

  // Calculate min and max values for color scaling
  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  // Calculate SVG dimensions
  const labelWidth = 80;
  const labelHeight = 30;
  const padding = 20;
  const svgWidth = labelWidth + xLabels.length * cellSize + padding * 2;
  const svgHeight = labelHeight + yLabels.length * cellSize + padding * 2;

  return (
    <div className="rounded-lg border bg-card p-6">
      {title && (
        <div className="flex items-center gap-2 mb-6">
          <Grid3x3 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      )}

      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="text-foreground"
          style={{ minHeight: height }}
        >
          {/* Y-axis labels */}
          {yLabels.map((label, i) => (
            <text
              key={`y-${label}`}
              x={labelWidth - 5}
              y={labelHeight + i * cellSize + cellSize / 2 + padding}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-xs fill-muted-foreground"
            >
              {label}
            </text>
          ))}

          {/* X-axis labels */}
          {xLabels.map((label, i) => (
            <text
              key={`x-${label}`}
              x={labelWidth + i * cellSize + cellSize / 2 + padding}
              y={labelHeight - 5}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-muted-foreground"
            >
              {label}
            </text>
          ))}

          {/* Heatmap cells */}
          {yLabels.map((yLabel, yi) =>
            xLabels.map((xLabel, xi) => {
              const value = dataMap.get(`${xLabel}-${yLabel}`) ?? 0;
              const color = getColor(value, minValue, maxValue, colorScale);

              return (
                <g key={`cell-${xLabel}-${yLabel}`}>
                  <rect
                    x={labelWidth + xi * cellSize + padding}
                    y={labelHeight + yi * cellSize + padding}
                    width={cellSize - 2}
                    height={cellSize - 2}
                    fill={color}
                    className="stroke-card"
                    strokeWidth={2}
                    rx={4}
                  >
                    <title>{`${xLabel}, ${yLabel}: ${value}`}</title>
                  </rect>
                  {showValues && value > 0 && (
                    <text
                      x={labelWidth + xi * cellSize + cellSize / 2 + padding}
                      y={labelHeight + yi * cellSize + cellSize / 2 + padding}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xs font-medium pointer-events-none"
                      fill={value > (minValue + maxValue) / 2 ? '#ffffff' : '#000000'}
                    >
                      {value}
                    </text>
                  )}
                </g>
              );
            }),
          )}
        </svg>
      </div>

      {/* Color scale legend */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>Low</span>
        <div className="flex h-4 w-32 rounded overflow-hidden">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div
              key={i}
              className="flex-1"
              style={{
                backgroundColor: getColor(
                  minValue + (i / 9) * (maxValue - minValue),
                  minValue,
                  maxValue,
                  colorScale,
                ),
              }}
            />
          ))}
        </div>
        <span>High</span>
        <span className="ml-2">
          ({minValue.toFixed(0)} - {maxValue.toFixed(0)})
        </span>
      </div>
    </div>
  );
}
