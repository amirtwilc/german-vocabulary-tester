import type { NextConfig } from 'next';

const basePath = process.env.BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: basePath || undefined,
};

export default nextConfig;
