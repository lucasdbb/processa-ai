import type { NextConfig } from "next";

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
};

export default nextConfig;
