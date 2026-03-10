import dynamic from 'next/dynamic';

/**
 * Lazy-loaded chart components using Next.js dynamic()
 *
 * All chart components are loaded with { ssr: false } to:
 * 1. Reduce initial bundle size by code-splitting recharts (~250KB gzipped)
 * 2. Only load chart code when needed (analytics/admin pages)
 * 3. Avoid SSR issues with recharts' DOM dependencies
 */

export const SparklineChart = dynamic(
  () => import('./SparklineChart').then((mod) => mod.SparklineChart),
  { ssr: false }
);

export const MojeebLineChart = dynamic(
  () => import('./MojeebLineChart').then((mod) => mod.MojeebLineChart),
  { ssr: false }
);

export const MojeebBarChart = dynamic(
  () => import('./MojeebBarChart').then((mod) => mod.MojeebBarChart),
  { ssr: false }
);

export const MojeebDonutChart = dynamic(
  () => import('./MojeebDonutChart').then((mod) => mod.MojeebDonutChart),
  { ssr: false }
);

export const MojeebHeatmapChart = dynamic(
  () => import('./MojeebHeatmapChart').then((mod) => mod.MojeebHeatmapChart),
  { ssr: false }
);
