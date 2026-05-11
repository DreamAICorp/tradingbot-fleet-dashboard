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
  // directly via its /api/* match, but in dev the browser bundle fetches
  // /api/* without the basePath prefix — basePath:false lets the rewrite
  // catch /api/* at root regardless of next.basePath ('/fleet'). Without
  // this, dev API calls 404 because the rewrite would be auto-prefixed
  // to /fleet/api/* and the browser doesn't add /fleet to its fetches.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/api/:path*`, basePath: false },
      { source: '/ws/:path*',  destination: `${API_URL}/ws/:path*`,  basePath: false },
    ];
  },
};

module.exports = nextConfig;
