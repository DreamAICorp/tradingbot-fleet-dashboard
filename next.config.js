/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

const nextConfig = {
  reactStrictMode: true,
  // basePath so the public Caddy route `/fleet*` proxies cleanly to this
  // app — Next.js self-rewrites every asset URL under /fleet/_next/...,
  // avoiding the /_next collision with the existing tradingbot frontend
  // on port 3005.
  basePath: '/fleet',
  // Proxy /api/* and /ws/* to the tradingbot-platform FastAPI backend so
  // local dev is cross-origin-free. Caddy in production hits the backend
  // directly via its /api/* match.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/ws/:path*', destination: `${API_URL}/ws/:path*` },
    ];
  },
};

module.exports = nextConfig;
