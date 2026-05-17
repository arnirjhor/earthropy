import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@repo/auth',
    '@repo/database',
    '@repo/moderation',
    '@repo/notifications',
    '@repo/observability',
    '@repo/sdg',
    '@repo/trust',
  ],
};

export default config;
