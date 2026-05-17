import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@repo/auth',
    '@repo/database',
    '@repo/design-system',
    '@repo/i18n',
    '@repo/moderation',
    '@repo/notifications',
    '@repo/observability',
    '@repo/sdg',
    '@repo/trust',
  ],
  experimental: {
    typedRoutes: true,
  },
};

export default withNextIntl(config);
