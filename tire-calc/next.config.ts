import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/tire_calculator',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
