import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
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
  experimental: {
    typedRoutes: true,
  },
};

export default withNextIntl(config);
