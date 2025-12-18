import type { NextConfig } from "next";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

const nextConfig: NextConfig = {
  // Disable static generation for pages with client components
  // This avoids hydration errors with Zustand and Radix UI
  output: 'standalone',

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  // Disable strict mode to avoid double rendering issues
  reactStrictMode: false,

  // Disable server-side fetch cache completely
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ]
  },
};

export default nextConfig;
