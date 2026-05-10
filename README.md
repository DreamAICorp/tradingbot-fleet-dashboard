# tradingbot-fleet-dashboard

Single-page Next.js dashboard for the realistic-sweep champion fleet running on `sona-vps`. Surfaces backtest-vs-live drift in seconds, not after a calendar-day aggregate.

> **Why this exists:** the existing 157-strategy fleet bleeds −$696/24h and 91 of 99 strategies diverge from backtest. We're about to deploy 15 fresh champions from PR #287; without instant drift visibility per strategy, we can't tell which are working and which are spinning fees. This dashboard is a deploy-blocker for those champions.

## Stack

- Next.js 14.2.3 (pages router) + TypeScript
- lightweight-charts 5.1.0 (Phase B backtest+live overlay) + recharts 2.12.4 (sparklines, pie)
- SWR 2.2.5 (REST polling) + native WebSocket (live tick stream)
- Vitest + Playwright + GitHub Actions CI
- No Tailwind, no shadcn — custom CSS variables match the existing tradingbot-platform GitHub-dark palette

Backend: this dashboard does NOT have its own backend. It consumes the existing tradingbot-platform FastAPI over CORS-allowed `/api/fleet/*` routes (added separately in tradingbot-platform). In dev, Next's rewrites in `next.config.js` proxy to `NEXT_PUBLIC_API_URL` (default `http://localhost:8010`).

## Getting started

```bash
npm install
npm run dev          # http://localhost:3100
npm run typecheck
npm test             # vitest unit tests
npm run test:e2e     # playwright (uses mocked endpoints — no backend needed)
```

## Layout

The dashboard is one page (`/`) with four zones:

1. **Fleet header** — cumulative PnL across 1d/7d/30d/60d/90d/1yr, trade counts, fleet drift score, last-tick age
2. **Champion table** — one row per champion. Click to expand
3. **Expansion panel** — 4 tabs:
   - **Drift compare** (Phase A): backtest / simulation / live triple-stat with colored Δ
   - **Backtest vs Live** chart overlay (Phase B)
   - **Broker position** — live Weex / BloFin position (Phase B)
   - **Decisions + logs** — recent signals + tail of paper.log (Phase A: logs; Phase B: decision-stream with skip_reason)
4. **Footer** — capital allocation pie, recent error stream, correlation matrix (Phase C)

## Phasing

| Phase | Days | Scope |
|---|---|---|
| A | 5-7 | Bootstrap + zones 1+2 + drift compare tab + logs tab + tests |
| B | 1-2w | Chart overlay + broker position + decision stream + drift writer + simulation replay |
| C | 1w | Liq heatmap, edge attribution, correlation, WS-gap, quiet-hours heatmap |

See `/Users/beniben/.claude/plans/mossy-marinating-hinton.md` for the full plan.

## Project briefs (Sona)

- Detailed plan: Sona note `mossy-marinating-hinton.md`
- Engineering process SSOT: Sona note `f9f595bc-d37d-40e7-a945-4456c95b61dc` — mirrored here as `AI_CONTRIBUTING.md`. Read it before contributing.

## Backend endpoints consumed

All hosted by tradingbot-platform's FastAPI (added in a separate PR there):

- `GET /api/fleet/overview` — Zone 1 rolling-window aggregates
- `GET /api/fleet/champions` — Zone 2 table rows
- `GET /api/fleet/champions/{id}/compare` — Tab A drift triple-stat
- `GET /api/fleet/champions/{id}/equity-overlay?days=N` — Tab B chart (Phase B)
- `GET /api/fleet/champions/{id}/decisions?limit=N` — Tab D decision stream (Phase B for skip_reason detail)
- `GET /api/fleet/champions/{id}/logs?lines=N&level=L` — Tab D paper.log tail
- `WS /ws/paper` — live trade/equity events (Phase A reuses existing channel; Phase B switches to `/ws/fleet/champions` with subscription filters)

## Deploy

Phase A: `npm run build && npm run start` on sona-vps via Tailscale-served-only Caddy. No public exposure.

Phase B+: GitHub Actions workflow (in `.github/workflows/deploy.yml`) ships static export to the VPS through the self-hosted runner.
