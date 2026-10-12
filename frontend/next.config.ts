import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const wardrobeApiOrigin = (
  process.env.WARDROBE_API_ORIGIN || 'http://127.0.0.1:8000'
).replace(/\/+$/, '');

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/docs/:path*',
        destination: `${wardrobeApiOrigin}/docs/:path*`,
      },
      {
        source: '/openapi.json',
        destination: `${wardrobeApiOrigin}/openapi.json`,
      },
      {
        source: '/api/:path*',
        destination: `${wardrobeApiOrigin}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
    ],
  },
};

export default function config(phase: string): NextConfig {
  return {
    ...nextConfig,
    distDir: process.env.NEXT_DIST_DIR || (
      phase === PHASE_DEVELOPMENT_SERVER ? '.next-thread-dev' : '.next-thread'
    ),
  };
}
