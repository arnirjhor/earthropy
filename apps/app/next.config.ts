import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: [
    '@repo/auth',
    '@repo/comments',
    '@repo/database',
    '@repo/design-system',
    '@repo/groups',
    '@repo/posts',
    '@repo/i18n',
    '@repo/moderation',
    '@repo/notifications',
    '@repo/observability',
    '@repo/sdg',
    '@repo/ratelimit',
    '@repo/trust',
  ],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  experimental: {
    typedRoutes: true,
  },
};

export default withNextIntl(config);
