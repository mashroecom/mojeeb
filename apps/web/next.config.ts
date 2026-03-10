import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from '@ducanh2912/next-pwa';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  ...(process.env.DOCKER === 'true' ? { output: 'standalone' as const } : {}),
  transpilePackages: ['@mojeeb/shared-types', '@mojeeb/shared-utils'],
};

export default withPWA(withNextIntl(nextConfig));
