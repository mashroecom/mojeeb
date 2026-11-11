import path from 'path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from '@ducanh2912/next-pwa';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  // Push / notificationclick handlers: compiled to public/worker-<hash>.js and
  // imported by the generated sw.js (never edit public/sw.js by hand)
  customWorkerSrc: path.join(__dirname, 'worker'),
});

const nextConfig: NextConfig = {
  ...(process.env.DOCKER === 'true' ? { output: 'standalone' as const } : {}),
  transpilePackages: ['@mojeeb/shared-types', '@mojeeb/shared-utils'],
};

export default withPWA(withNextIntl(nextConfig));
