const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  cacheComponents: true,
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      },
    ],
  },
}

module.exports = nextConfig
