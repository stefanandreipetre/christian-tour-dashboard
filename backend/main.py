"""
Christian Tour Sales Dashboard — FastAPI Backend
"""

import os
import logging
import time
import threading
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

import cache
import data_processor as dp
from sharepoint_client import SharePointClient

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)

sp        = SharePointClient()
scheduler = BackgroundScheduler()
REFRESH_INTERVAL = int(os.getenv("REFRESH_INTERVAL", 3600))

SOURCES = ["b2b", "b2c", "outlook", "target"]

# Map each source key to the correct timeseries builder
BUILDERS = {
    "b2b":     dp.build_b2b_timeseries,
    "b2c":     dp.build_b2c_timeseries,
    "outlook": dp.build_plan_timeseries,
    "target":  dp.build_target_timeseries,
}


def load_source(key: str) -> None:
    """Download one Excel file from SharePoint, parse with the correct builder, store in cache."""
    try:
        logger.info("Loading %s …", key)
        raw    = sp.download_file(key)
        sheets = dp.load_excel_bytes(raw, key)
        build  = BUILDERS.get(key, dp.build_b2b_timeseries)
        ts     = build(sheets)
        cache.set_data(key, sheets, ts)
        logger.info("Loaded %s: %d sheets, %d rows", key, len(sheets), len(ts))

        # After loading the target file, derive B2C as a fallback if b2c wasn't loaded yet.
        # The target file's IAN/FEB/.../DEC sheets contain TOTAL = etrip+Tina per agency.
        if key == "target":
            existing = cache.get_data("b2c")
            b2c_ok = existing and len(existing.get("timeseries") or []) > 0
            if not b2c_ok:
                b2c_ts = dp.build_b2c_timeseries(sheets)
                if b2c_ts:
                    cache.set_data("b2c", sheets, b2c_ts)
                    logger.info("B2C fallback from target file: %d rows", len(b2c_ts))

    except Exception as exc:
        logger.error("Error loading %s: %s", key, exc, exc_info=True)


def refresh_all() -> None:
    for key in SOURCES:
        load_source(key)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load data in a background thread so uvicorn binds to the port immediately.
    # Render's port scanner times out if startup takes > ~60s (our files take 2-3 min).
    # Endpoints return 503 until data is ready — that's acceptable.
    thread = threading.Thread(target=refresh_all, daemon=True, name="initial-load")
    thread.start()
    logger.info("Initial data load started in background thread")

    scheduler.add_job(refresh_all, "interval", seconds=REFRESH_INTERVAL, id="refresh")
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Christian Tour Dashboard API", version="2.0.0", lifespan=lifespan)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── helpers ──────────────────────────────────────────────────────────────────

def _require(key: str):
    entry = cache.get_data(key)
    if not entry:
        raise HTTPException(
            status_code=503,
            detail=f"Data for '{key}' not loaded yet. Check /api/status.",
        )
    return entry


# ── status ───────────────────────────────────────────────────────────────────

@app.get("/api/status")
def status():
    ts = cache.get_all_updated_at()
    return {
        "sources": {
            k: {
                "loaded":           cache.is_loaded(k),
                "updated_at":       ts.get(k),
                "updated_at_human": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts[k])) if ts.get(k) else None,
            }
            for k in SOURCES
        },
        "refresh_interval_seconds": REFRESH_INTERVAL,
        "next_refresh": scheduler.get_job("refresh").next_run_time.isoformat() if scheduler.get_job("refresh") else None,
    }


@app.post("/api/refresh")
def manual_refresh(background_tasks: BackgroundTasks):
    background_tasks.add_task(refresh_all)
    return {"message": "Refresh started"}


# ── raw data ─────────────────────────────────────────────────────────────────

@app.get("/api/raw/{source}")
def raw(source: str, sheet: Optional[str] = Query(None)):
    if source not in SOURCES:
        raise HTTPException(400, f"source must be one of {SOURCES}")
    entry  = _require(source)
    sheets = entry["sheets"]
    if sheet:
        if sheet not in sheets:
            raise HTTPException(404, f"Sheet '{sheet}' not found. Available: {list(sheets.keys())}")
        return dp.sheets_metadata({sheet: sheets[sheet]})
    return dp.sheets_metadata(sheets)


# ── B2B endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/b2b/summary")
def b2b_summary(year: Optional[int] = Query(None), month: Optional[int] = Query(None)):
    entry = _require("b2b")
    return dp.get_summary_stats(entry["timeseries"], year=year, month=month)


@app.get("/api/b2b/monthly")
def b2b_monthly(year: Optional[int] = Query(None), compare_year: Optional[int] = Query(None)):
    entry = _require("b2b")
    return dp.get_monthly_chart(entry["timeseries"], year=year, compare_year=compare_year)


@app.get("/api/b2b/yearly")
def b2b_yearly():
    entry = _require("b2b")
    return dp.get_yearly_summary(entry["timeseries"])


@app.get("/api/b2b/recent")
def b2b_recent(n: int = Query(8, ge=2, le=24)):
    entry = _require("b2b")
    return dp.get_recent_months(entry["timeseries"], n=n)


@app.get("/api/b2b/agencies")
def b2b_agencies(year: Optional[int] = Query(None), month: Optional[int] = Query(None), top: int = Query(20, ge=1, le=100)):
    entry = _require("b2b")
    return dp.get_agency_breakdown(entry["timeseries"], year=year, month=month, top=top)


@app.get("/api/b2b/branches")
def b2b_branches(year: Optional[int] = Query(None), month: Optional[int] = Query(None), top: int = Query(30, ge=1, le=100)):
    entry = _require("b2b")
    return dp.get_branch_breakdown(entry["timeseries"], year=year, month=month, top=top)


@app.get("/api/b2b/vs-target")
def b2b_vs_target(year: Optional[int] = Query(None), month: Optional[int] = Query(None)):
    b2b = _require("b2b")
    tgt = _require("target")

    actual         = dp.get_summary_stats(b2b["timeseries"], year=year, month=month)
    target         = dp.get_summary_stats(tgt["timeseries"], year=year, month=month)
    actual_monthly = dp.get_monthly_chart(b2b["timeseries"], year=year)
    target_monthly = dp.get_monthly_chart(tgt["timeseries"], year=year)

    combined = []
    for a, t in zip(actual_monthly, target_monthly):
        combined.append({**a, "target": t.get("revenue")})

    return {"actual": actual, "target_kpi": target, "monthly": combined}


# ── B2C endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/b2c/summary")
def b2c_summary(year: Optional[int] = Query(None), month: Optional[int] = Query(None)):
    entry = _require("b2c")
    return dp.get_summary_stats(entry["timeseries"], year=year, month=month)


@app.get("/api/b2c/monthly")
def b2c_monthly(year: Optional[int] = Query(None), compare_year: Optional[int] = Query(None)):
    entry = _require("b2c")
    return dp.get_monthly_chart(entry["timeseries"], year=year, compare_year=compare_year)


@app.get("/api/b2c/yearly")
def b2c_yearly():
    entry = _require("b2c")
    return dp.get_yearly_summary(entry["timeseries"])


@app.get("/api/b2c/recent")
def b2c_recent(n: int = Query(8, ge=2, le=24)):
    entry = _require("b2c")
    return dp.get_recent_months(entry["timeseries"], n=n)


@app.get("/api/b2c/branches")
def b2c_branches(year: Optional[int] = Query(None), month: Optional[int] = Query(None), top: int = Query(30, ge=1, le=100)):
    entry = _require("b2c")
    return dp.get_branch_breakdown(entry["timeseries"], year=year, month=month, top=top)


@app.get("/api/b2c/daily")
def b2c_daily(days: int = Query(30, ge=7, le=365)):
    """Last N days of B2C revenue with same-day LY comparison."""
    entry = _require("b2c")
    return dp.get_daily_chart(entry["timeseries"], days=days)


@app.get("/api/b2c/weekly")
def b2c_weekly(year: Optional[int] = Query(None), n: int = Query(16, ge=4, le=52)):
    """Last N ISO weeks of B2C revenue with same-week LY comparison."""
    entry = _require("b2c")
    return dp.get_weekly_chart(entry["timeseries"], year=year, n=n)


# ── Outlook / Plan ────────────────────────────────────────────────────────────

@app.get("/api/outlook/monthly")
def outlook_monthly(year: Optional[int] = Query(None)):
    entry = _require("outlook")
    return dp.get_monthly_chart(entry["timeseries"], year=year)


@app.get("/api/outlook/summary")
def outlook_summary(year: Optional[int] = Query(None)):
    entry = _require("outlook")
    return dp.get_summary_stats(entry["timeseries"], year=year)


# ── Combined overview ─────────────────────────────────────────────────────────

@app.get("/api/overview")
def overview(year: Optional[int] = Query(None)):
    result = {"year": year or 2026}
    for key in SOURCES:
        if cache.is_loaded(key):
            entry       = cache.get_data(key)
            result[key] = {
                "summary": dp.get_summary_stats(entry["timeseries"], year=year),
                "monthly": dp.get_monthly_chart(entry["timeseries"], year=year),
            }
        else:
            result[key] = None
    return result


# ── Debug endpoints ──────────────────────────────────────────────────────────

@app.get("/api/debug/load")
def debug_load(source: str = "b2b"):
    """Run the full load pipeline for one source and return structure + sample."""
    try:
        raw    = sp.download_file(source)
        sheets = dp.load_excel_bytes(raw, source)
        build  = BUILDERS.get(source, dp.build_b2b_timeseries)
        ts     = build(sheets)
        cache.set_data(source, sheets, ts)
        return {
            "success":         True,
            "bytes":           len(raw),
            "sheets":          {k: {"rows": len(v), "columns": list(v.columns)[:12]} for k, v in sheets.items()},
            "timeseries_rows": len(ts),
            "sample":          ts[:5] if ts else [],
            "years_found":     sorted(set(r["year"] for r in ts if r.get("year"))),
        }
    except Exception as exc:
        import traceback
        return {"success": False, "error": str(exc), "traceback": traceback.format_exc()}


@app.get("/api/debug/download")
def debug_download(source: str = "b2b"):
    """Test what SharePoint returns for a sharing link."""
    import requests as req
    from sharepoint_client import FILE_URLS
    url = FILE_URLS.get(source, "")
    if not url:
        return {"error": "unknown source"}
    download_url = url + ("&" if "?" in url else "?") + "download=1"
    try:
        r = req.get(download_url, allow_redirects=True, timeout=20,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 1