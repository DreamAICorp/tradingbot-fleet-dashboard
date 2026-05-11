"""Real-backend test harness for the fleet dashboard e2e suite.

Spawns a real FastAPI (the actual /api/fleet/* router from tradingbot-platform)
on a deterministic port with a SEEDED paper_unified.db so Playwright tests
exercise the production code path end-to-end. Zero fetch mocks.

Usage:
  python -m tests.e2e.harness.seed_backend --port 8765 --fixture paired_bananausdt

`--fixture` picks one of the named seed presets below. Each preset shapes
the DB so a specific feature is testable: e.g. `paired_bananausdt` seeds
one canonical + one _nofilter sibling with 3 trades + 5 rejected
signal_checks, so the Live panel renders all 4 marker tracks.

Why a Python harness rather than mocking page.route(): AI_CONTRIBUTING
forbids fetch-mock e2e ("E2E exhaustive user journey — fetch-mock ban").
The real chain (FastAPI → SQLite → JSON → fetch → React) must be exercised
or the test proves nothing about production.

Exit behaviour:
  - Prints the URL it's listening on to stdout (used by Playwright config)
  - Runs forever until SIGTERM (Playwright spawns + kills it as a webServer)
  - On SIGTERM, cleans up the temp DB
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import tempfile
import time
from pathlib import Path

# Locate the tradingbot-platform backend so we can import its FastAPI app.
# CI sets PLATFORM_DIR env; locally we autodiscover the sibling repo.
PLATFORM_DIR = Path(
    os.environ.get(
        "PLATFORM_DIR",
        str(Path(__file__).resolve().parents[4] / "tradingbot-platform" / "backend"),
    )
)
if not PLATFORM_DIR.exists():
    print(
        f"FATAL: backend dir {PLATFORM_DIR} not found. Set PLATFORM_DIR env.",
        file=sys.stderr,
    )
    sys.exit(2)
sys.path.insert(0, str(PLATFORM_DIR))


# ── seed presets ──────────────────────────────────────────────────────────

def seed_paired_bananausdt(db_path: Path) -> None:
    """Canonical BANANA + _nofilter sibling. Sibling has 3 trades; canonical
    has 5 rejected signal_checks (3 long-rejected, 2 short-rejected). Drives
    every Sprint S1 visual feature in one fixture."""
    from live.paper_store import (
        open_db, upsert_strategy, log_trade, log_signal_check,
    )
    now_ms = int(time.time() * 1000)
    con = open_db(db_path)
    sid_canon = "multi_tf_rsi_confluence_bananausdt_x50"
    sid_shadow = f"{sid_canon}_nofilter"
    for sid in (sid_canon, sid_shadow):
        upsert_strategy(
            con, strategy_id=sid, name=sid, family="multi",
            symbol="BANANAUSDT", leverage=50, initial_equity=100.0,
            params={"leverage": 50}, created_ts=0,
            timeframe_minutes=15, expected_setups_per_day=8.0,
            expected_trades_per_day=4.97, backtest_source="realistic_sweep",
        )
    # Sibling: 3 trades, mixed outcomes, in the last 6h
    for i, (pnl, exit_reason) in enumerate([
        (2.50, "tp1_partial"),
        (1.80, "tp1_partial"),
        (-3.00, "liquidated"),
    ]):
        log_trade(
            con, strategy_id=sid_shadow, symbol="BANANAUSDT", side="long",
            entry_price=1.0, exit_price=1.0 + pnl / 100.0,
            size_usd=10.0, leverage=50, pnl=pnl, fees=0.01,
            exit_reason=exit_reason,
            ts_open=now_ms - (i + 1) * 7_200_000,
            ts_close=now_ms - i * 7_200_000,
        )
    # Canonical: 5 rejected signal_checks (the regime filter killing setups)
    for i, side in enumerate(["long", "long", "long", "short", "short"]):
        ts = now_ms - (i + 1) * 1_800_000  # spaced 30 min back
        log_signal_check(
            con, strategy_id=sid_canon, ts=ts,
            setups_returned=1, setups_acted=0, skip_stale=1,
            dir_strong=1,
            skip_reason=f"regime_not_allowed:choppy",
            rejected_side=side,
        )
    con.close()


SEED_PRESETS = {
    "paired_bananausdt": seed_paired_bananausdt,
}


def build_app(db_path: Path, champ_json: Path, db_for_signals: Path):
    """Mount the real fleet router on a fresh FastAPI app pointed at our
    seeded DB. We monkey-patch fleet.py module constants AFTER setting env
    vars so reload picks them up. _load_candles is also stubbed because
    its path is hardcoded to BASE_DIR/data/candle_cache.db (prod) — for
    e2e we synthesize candles at every signal_check ts so rejected
    markers actually render."""
    os.environ["PAPER_STORE_DB"] = str(db_path)

    import importlib
    import sqlite3
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from api import fleet as fleet_mod
    importlib.reload(fleet_mod)
    fleet_mod.PAPER_DB = db_path
    fleet_mod.CHAMPIONS_JSON = champ_json

    # Synthesize one candle per unique paper_signal_checks ts so
    # _rejected_signals's `close_by_ts` lookup finds prices. We use the
    # ts directly as both bucket key and 1m bar timestamp (the function
    # tries exact match first, then //60_000 bucket — exact ts works).
    def _fake_candles(symbol: str, since_ms: int, limit=None) -> list[dict]:
        con = sqlite3.connect(str(db_for_signals))
        try:
            con.row_factory = sqlite3.Row
            rows = con.execute(
                """SELECT DISTINCT ts FROM paper_signal_checks
                    WHERE ts >= ? ORDER BY ts""",
                (since_ms,),
            ).fetchall()
            trade_rows = con.execute(
                """SELECT ts_open, ts_close, entry_price, exit_price
                     FROM paper_trades WHERE ts_open >= ?""",
                (since_ms,),
            ).fetchall()
        finally:
            con.close()
        out: list[dict] = []
        # Use signal_check ts → close=1.0 (placeholder, the marker just
        # needs a price to be placed at the bar)
        for r in rows:
            ts = int(r["ts"])
            out.append({"ts": ts, "open": 1.0, "high": 1.01, "low": 0.99,
                        "close": 1.0, "volume": 1000.0})
        # Plus trade ts so live_signals are placed
        for tr in trade_rows:
            for ts, px in [(tr["ts_open"], tr["entry_price"]),
                            (tr["ts_close"], tr["exit_price"])]:
                out.append({"ts": int(ts), "open": float(px),
                            "high": float(px) * 1.001, "low": float(px) * 0.999,
                            "close": float(px), "volume": 1000.0})
        # Plus a coarse spine of candles so the chart isn't completely
        # empty (1 candle per 4h over the last 7 days).
        now = int(time.time() * 1000)
        for i in range(7 * 6):  # 7 days × 4 buckets
            ts = now - i * 4 * 3_600_000
            if ts >= since_ms:
                out.append({"ts": ts, "open": 1.0, "high": 1.01, "low": 0.99,
                            "close": 1.0, "volume": 1000.0})
        out.sort(key=lambda x: x["ts"])
        return out
    fleet_mod._load_candles = _fake_candles  # type: ignore

    # Same problem for the backtest engine — it tries to load candles
    # from the prod path. For e2e we don't need real backtest signals;
    # stub the helper to return an empty marker list (or use the fake
    # candles → real engine path, but it requires 1500+ bars which our
    # synthetic spine doesn't provide). Empty backtest is fine — the
    # tests under test target shadow/rejected/live tracks.
    fleet_mod._backtest_signals = lambda *a, **kw: []  # type: ignore

    app = FastAPI(title="fleet-e2e-harness")
    # Playwright runs the Next.js dev on a different origin; allow any
    # local origin so the proxy can hit us without CORS noise.
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"],
        allow_methods=["*"], allow_headers=["*"],
    )
    app.include_router(fleet_mod.router)
    return app


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--fixture", default="paired_bananausdt",
                    choices=sorted(SEED_PRESETS.keys()))
    ap.add_argument("--db-out", type=str, default="",
                    help="optional: write the temp DB path here for debug")
    args = ap.parse_args()

    tmpdir = Path(tempfile.mkdtemp(prefix=f"fleet-e2e-{args.fixture}-"))
    db_path = tmpdir / "paper_unified.db"
    champ_json = tmpdir / "realistic_champions_spot_deployable.json"
    champ_json.write_text(json.dumps({
        "champions": [{
            "symbol": "BANANAUSDT", "variant": "multi_tf_rsi_confluence",
            "leverage": 50, "size_frac": 0.02, "fee_mode": "maker",
            "daily_rate_pct_median": 2.13, "sharpe_median": 3.38,
            "win_rate": 0.59, "n_trades": 280, "max_dd_pct": 8.0,
            "n_liquidations": 5, "liq_rate": 0.018, "days_observed": 56,
            "tf_label": "tf-15m-1h-4h",
            "tf_variant": {"timeframes": ["15m", "1h", "4h"]},
            "spot_volume_usd": 1_597_889,
            "source_strategy_module": "strategies.multi_tf_rsi_confluence",
        }],
    }))

    seed_fn = SEED_PRESETS[args.fixture]
    seed_fn(db_path)
    if args.db_out:
        Path(args.db_out).write_text(str(db_path))

    app = build_app(db_path, champ_json, db_path)
    import uvicorn  # type: ignore

    # SIGTERM hook for clean shutdown (Playwright's webServer kills us)
    def _cleanup(*_):
        try:
            for f in tmpdir.iterdir():
                f.unlink(missing_ok=True)
            tmpdir.rmdir()
        except Exception:
            pass
        sys.exit(0)
    signal.signal(signal.SIGTERM, _cleanup)
    signal.signal(signal.SIGINT, _cleanup)

    print(f"fleet-e2e-harness listening on http://127.0.0.1:{args.port} "
          f"(fixture={args.fixture}, db={db_path})", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
