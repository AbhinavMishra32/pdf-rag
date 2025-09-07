import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Always alias 'canvas' to a stub; pdfjs tries to require it in Node context.
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: path.resolve(__dirname, 'stubs/canvas.js'),
    } as any;
    return config;
  },
};

export default nextConfig;
