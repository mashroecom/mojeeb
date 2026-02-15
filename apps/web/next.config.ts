import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  ...(process.env.DOCKER === 'true' ? { output: 'standalone' as const } : {}),
  transpilePackages: ['@mojeeb/shared-types', '@mojeeb/shared-utils'],
};

export default withNextIntl(nextConfig);
