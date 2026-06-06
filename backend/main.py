"""
Christian Tour Sales Dashboard — FastAPI Backend
"""

import os
import logging
import time
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

sp = SharePointClient()
scheduler = BackgroundScheduler()
REFRESH_INTERVAL = int(os.getenv("REFRESH_INTERVAL", 3600))

SOURCES = ["b2b", "b2c", "outlook", "target"]


def load_source(key: str) -> None:
    """Download one Excel file from SharePoint, parse it, and store in cache."""
    try:
        logger.info("Loading %s …", key)
        raw = sp.download_file(key)
        sheets = dp.load_excel_bytes(raw, key)
        ts = dp.build_b2b_timeseries(sheets)
        cache.set_data(key, sheets, ts)
        logger.info("Loaded %s: %d sheets, %d rows", key, len(sheets), len(ts))
    except Exception as exc:
        logger.error("Error loading %s: %s", key, exc)


def refresh_all() -> None:
    for key in SOURCES:
        load_source(key)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initial load (best-effort; if creds missing, endpoints return 503)
    try:
        refresh_all()
    except Exception as exc:
        logger.warning("Initial load failed (check credentials): %s", exc)

    scheduler.add_job(refresh_all, "interval", seconds=REFRESH_INTERVAL, id="refresh")
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Christian Tour Dashboard API", version="1.0.0", lifespan=lifespan)

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
            detail=f"Data for '{key}' not loaded yet. Check SharePoint credentials and /api/status.",
        )
    return entry


# ── status ───────────────────────────────────────────────────────────────────

@app.get("/api/status")
def status():
    ts = cache.get_all_updated_at()
    return {
        "sources": {
            k: {
                "loaded": cache.is_loaded(k),
                "updated_at": ts.get(k),
                "updated_at_human": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts[k])) if ts.get(k) else None,
            }
            for k in SOURCES
        },
        "refresh_interval_seconds": REFRESH_INTERVAL,
        "next_refresh": scheduler.get_job("refresh").next_run_time.isoformat() if scheduler.get_job("refresh") else None,
    }


@app.post("/api/refresh")
def manual_refresh(background_tasks: BackgroundTasks):
    """Trigger an immediate refresh in the background."""
    background_tasks.add_task(refresh_all)
    return {"message": "Refresh started"}


# ── raw data (for configuration / debugging) ─────────────────────────────────

@app.get("/api/raw/{source}")
def raw(source: str, sheet: Optional[str] = Query(None)):
    if source not in SOURCES:
        raise HTTPException(400, f"source must be one of {SOURCES}")
    entry = _require(source)
    sheets = entry["sheets"]
    if sheet:
        if sheet not in sheets:
            raise HTTPException(404, f"Sheet '{sheet}' not found. Available: {list(sheets.keys())}")
        return dp.sheets_metadata({sheet: sheets[sheet]})
    return dp.sheets_metadata(sheets)


# ── B2B endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/b2b/summary")
def b2b_summary(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
):
    entry = _require("b2b")
    return dp.get_summary_stats(entry["timeseries"], year=year, month=month)


@app.get("/api/b2b/monthly")
def b2b_monthly(
    year: Optional[int] = Query(None),
    compare_year: Optional[int] = Query(None),
):
    entry = _require("b2b")
    return dp.get_monthly_chart(entry["timeseries"], year=year, compare_year=compare_year)


@app.get("/api/b2b/agencies")
def b2b_agencies(
    year: Optional[int] = Query(None),
    top: int = Query(20, ge=1, le=100),
):
    entry = _require("b2b")
    return dp.get_agency_breakdown(entry["timeseries"], year=year, top=top)


@app.get("/api/b2b/vs-target")
def b2b_vs_target(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
):
    b2b = _require("b2b")
    tgt = _require("target")

    actual = dp.get_summary_stats(b2b["timeseries"], year=year, month=month)
    target = dp.get_summary_stats(tgt["timeseries"], year=year, month=month)

    # Monthly chart with both actual and target
    actual_monthly = dp.get_monthly_chart(b2b["timeseries"], year=year)
    target_monthly = dp.get_monthly_chart(tgt["timeseries"], year=year)

    combined = []
    for a, t in zip(actual_monthly, target_monthly):
        combined.append({
            **a,
            "target": t.get("revenue"),
        })

    return {
        "actual": actual,
        "target_kpi": target,
        "monthly": combined,
    }


# ── B2C endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/b2c/summary")
def b2c_summary(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
):
    entry = _require("b2c")
    return dp.get_summary_stats(entry["timeseries"], year=year, month=month)


@app.get("/api/b2c/monthly")
def b2c_monthly(
    year: Optional[int] = Query(None),
    compare_year: Optional[int] = Query(None),
):
    entry = _require("b2c")
    return dp.get_monthly_chart(entry["timeseries"], year=year, compare_year=compare_year)


# ── Outlook / forecast ────────────────────────────────────────────────────────

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
    """One call that powers the main dashboard overview."""
    result = {"year": year or 2025}

    for key in SOURCES:
        if cache.is_loaded(key):
            entry = cache.get_data(key)
            result[key] = {
                "summary": dp.get_summary_stats(entry["timeseries"], year=year),
                "monthly": dp.get_monthly_chart(entry["timeseries"], year=year),
            }
        else:
            result[key] = None

    return result
