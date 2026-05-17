import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/design-system', '@repo/i18n', '@repo/sdg'],
};

export default withNextIntl(config);
