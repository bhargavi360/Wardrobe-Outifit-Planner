import type { NextConfig } from 'next';

const wardrobeApiOrigin = process.env.WARDROBE_API_ORIGIN?.replace(/\/+$/, '');

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next-thread',
  async rewrites() {
    if (!wardrobeApiOrigin) {
      return [];
    }

    return [
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

export default nextConfig;
