import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: [
    '@repo/auth',
    '@repo/community-agent',
    '@repo/database',
    '@repo/moderation',
    '@repo/notifications',
    '@repo/observability',
    '@repo/sdg',
    '@repo/trust',
  ],
};

export default config;
