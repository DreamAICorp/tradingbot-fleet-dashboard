/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

const nextConfig = {
  reactStrictMode: true,
  // Proxy /api/* and /ws/* to the tradingbot-platform FastAPI backend so the
  // dashboard runs cross-origin-free in dev. Production uses Caddy in front
  // and the same path prefixes route to the backend service.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/ws/:path*', destination: `${API_URL}/ws/:path*` },
    ];
  },
};

module.exports = nextConfig;
