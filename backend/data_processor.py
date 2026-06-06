"""
Flexible Excel parser and data processor.

Strategy:
  1. Load every sheet from every Excel file.
  2. For each source, select the correct named sheet(s) by name.
  3. Auto-detect column roles using fuzzy name matching (Romanian + English keywords).
  4. Expose normalised DataFrames for the API layer.
"""

import io
import re
import logging
from datetime import date
from typing import Dict, Optional, List, Any, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Column detection keywords (Romanian + English, case-insensitive)
# ---------------------------------------------------------------------------
MONTH_KEYWORDS   = ["luna", "month", "lună", "perioada", "period", "mon", "month only"]
YEAR_KEYWORDS    = ["year", "an", "ani"]
DATE_KEYWORDS    = ["data", "date", "zi", "day"]
REVENUE_KEYWORDS = [
    "nett", "net", "revenue", "vanzari", "vânzări", "cifra", "valoare",
    "incasari", "încasări", "sales", "rulaj", "suma", "sumă", "lei", "ron", "eur", "usd",
]
BOOKING_KEYWORDS = [
    "pax", "rezervari", "rezervări", "bookings", "numar", "număr", "pasageri",
    "călători", "calatori", "nr.", "contracts", "contracte",
]
PLAN_KEYWORDS    = ["plan", "target", "buget", "budget", "obiectiv", "forecast", "prognoza"]
LY_KEYWORDS      = ["an anterior", "precedent", "2024", "2023", "prev year", "anterior", "last year", "ly "]
AGENCY_KEYWORDS  = ["client name", "client", "agentie", "agenție", "agency", "partener", "partner", "denumire"]
ZONA_KEYWORDS    = ["zona", "zonă", "branch", "sucursala", "sucursală", "region", "regiune", "city", "oras", "oraș", "birou"]

MONTH_MAP_RO = {
    "ian": 1, "ianuarie": 1, "feb": 2, "februarie": 2, "mar": 3, "martie": 3,
    "apr": 4, "aprilie": 4, "mai": 5, "iun": 6, "iunie": 6,
    "iul": 7, "iulie": 7, "aug": 8, "august": 8, "sep": 9, "septembrie": 9,
    "oct": 10, "octombrie": 10, "noi": 11, "noiembrie": 11, "dec": 12, "decembrie": 12,
}
MONTH_MAP_EN = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6,
    "jul": 7, "july": 7, "aug": 8, "august": 8, "sep": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}


# ---------------------------------------------------------------------------
# Column detection helpers
# ---------------------------------------------------------------------------

def _score_col(col_name: str, keywords: List[str]) -> int:
    low = str(col_name).lower()
    return sum(1 for kw in keywords if kw in low)


def _detect_col(df: pd.DataFrame, keywords: List[str], exclude_cols: Optional[List[str]] = None) -> Optional[str]:
    candidates = [c for c in df.columns if not exclude_cols or c not in exclude_cols]
    scores = {c: _score_col(c, keywords) for c in candidates}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else None


def _parse_month(val) -> Optional[int]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, (int, float)):
        v = int(val)
        return v if 1 <= v <= 12 else None
    s = str(val).strip().lower()
    for mapping in (MONTH_MAP_RO, MONTH_MAP_EN):
        for key, num in mapping.items():
            if s.startswith(key):
                return num
    m = re.search(r"\d+", s)
    if m:
        v = int(m.group())
        return v if 1 <= v <= 12 else None
    return None


def _safe_float(val) -> Optional[float]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        cleaned = str(val).strip().replace(",", ".").replace(" ", "").replace("\xa0", "")
        if not cleaned or cleaned in ("-", "–", "N/A", "n/a", "#N/A", ""):
            return None
        return float(cleaned)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Sheet-level helpers
# ---------------------------------------------------------------------------

def _get_named_sheet(sheets: Dict[str, pd.DataFrame], *candidates: str) -> Tuple[Optional[str], Optional[pd.DataFrame]]:
    """Return (name, df) for the first sheet matching any candidate name (case-insensitive substring)."""
    for name, df in sheets.items():
        name_low = name.strip().lower()
        for c in candidates:
            if c.lower() in name_low or name_low == c.lower():
                return name, df
    return None, None


def load_excel_bytes(raw: bytes, source_key: str) -> Dict[str, pd.DataFrame]:
    """Parse all sheets from an Excel file. Returns {sheet_name: DataFrame}."""
    buf = io.BytesIO(raw)
    try:
        sheets = pd.read_excel(buf, sheet_name=None, header=None)
    except Exception as exc:
        logger.error("Failed to parse %s: %s", source_key, exc)
        return {}

    result = {}
    for name, df in sheets.items():
        if df.empty or df.dropna(how="all").empty:
            continue
        df = _promote_header(df)
        df.columns = [str(c).strip() for c in df.columns]
        df = df.dropna(how="all").reset_index(drop=True)
        result[name] = df
    return result


def _promote_header(df: pd.DataFrame) -> pd.DataFrame:
    """Detect and promote the header row."""
    for i, row in df.iterrows():
        non_null = row.dropna()
        if len(non_null) >= max(3, df.shape[1] * 0.4):
            header = row.values
            df = df.iloc[i + 1:].reset_index(drop=True)
            df.columns = header
            return df
    df.columns = [f"Col_{i}" for i in range(df.shape[1])]
    return df


# ---------------------------------------------------------------------------
# Core record parser — used by all source-specific builders
# ---------------------------------------------------------------------------

def _parse_sheet_records(sheet_name: str, df: pd.DataFrame, default_year: Optional[int] = None) -> List[Dict]:
    """Extract normalised records from a DataFrame using keyword-based column detection."""
    if df is None or len(df) < 2:
        return []

    month_col   = _detect_col(df, MONTH_KEYWORDS)
    year_col    = _detect_col(df, YEAR_KEYWORDS)
    revenue_col = _detect_col(df, REVENUE_KEYWORDS)
    booking_col = _detect_col(df, BOOKING_KEYWORDS)
    plan_col    = _detect_col(df, PLAN_KEYWORDS)
    ly_col      = _detect_col(df, LY_KEYWORDS)
    agency_col  = _detect_col(df, AGENCY_KEYWORDS)
    zona_col    = _detect_col(df, ZONA_KEYWORDS)

    # Avoid zona_col overlapping with agency_col
    if zona_col and agency_col and zona_col == agency_col:
        zona_col = None

    logger.debug(
        "Sheet '%s': month=%s year=%s revenue=%s booking=%s plan=%s ly=%s agency=%s zona=%s",
        sheet_name, month_col, year_col, revenue_col, booking_col, plan_col, ly_col, agency_col, zona_col,
    )

    records = []
    for _, row in df.iterrows():
        month_val = _parse_month(row.get(month_col)) if month_col else None
        year_val = default_year
        if year_col:
            try:
                raw_year = row.get(year_col)
                if raw_year is not None and not (isinstance(raw_year, float) and pd.isna(raw_year)):
                    y = int(float(str(raw_year).replace(",", ".")))
                    if 2000 <= y <= 2100:
                        year_val = y
            except Exception:
                pass

        revenue  = _safe_float(row.get(revenue_col)  if revenue_col  else None)
        bookings = _safe_float(row.get(booking_col)  if booking_col  else None)
        plan     = _safe_float(row.get(plan_col)     if plan_col     else None)
        ly       = _safe_float(row.get(ly_col)       if ly_col       else None)

        agency = None
        if agency_col and pd.notna(row.get(agency_col)):
            agency = str(row[agency_col]).strip()
            if not agency or agency.lower() in ("nan", "none", "total", "grand total"):
                agency = None

        zona = None
        if zona_col and pd.notna(row.get(zona_col)):
            zona = str(row[zona_col]).strip()
            if not zona or zona.lower() in ("nan", "none", "total", "grand total"):
                zona = None

        rec = {
            "sheet":    sheet_name,
            "month":    month_val,
            "year":     year_val,
            "revenue":  revenue,
            "bookings": bookings,
            "plan":     plan,
            "ly":       ly,
            "agency":   agency,
            "zona":     zona,
        }
        if rec["month"] or rec["revenue"]:
            records.append(rec)

    return records


# ---------------------------------------------------------------------------
# Source-specific timeseries builders
# ---------------------------------------------------------------------------

def build_b2b_timeseries(sheets: Dict[str, pd.DataFrame]) -> List[Dict]:
    """B2B Monthly file → use 'Data' sheet (transactional, ~22k rows)."""
    sheet_name, df = _get_named_sheet(sheets, "Data")
    if df is None or len(df) < 5:
        # fallback: largest sheet
        sorted_sheets = sorted(sheets.items(), key=lambda x: len(x[1]), reverse=True)
        for name, d in sorted_sheets:
            if len(d) >= 5:
                sheet_name, df = name, d
                break
    if df is None:
        logger.warning("B2B: no usable sheet found")
        return []
    logger.info("B2B: using sheet '%s' (%d rows)", sheet_name, len(df))
    return _parse_sheet_records(sheet_name, df)


def build_b2c_timeseries(sheets: Dict[str, pd.DataFrame]) -> List[Dict]:
    """B2C Dashboard file → combine 'etrip' + 'tina' sheets."""
    records = []
    found_any = False
    for candidate in ("etrip", "tina", "e-trip", "b2c", "site"):
        name, df = _get_named_sheet(sheets, candidate)
        if df is not None and len(df) >= 5:
            logger.info("B2C: using sheet '%s' (%d rows)", name, len(df))
            records.extend(_parse_sheet_records(name, df))
            found_any = True
    if not found_any:
        logger.warning("B2C: 'etrip'/'tina' sheets not found — falling back to largest sheet")
        sorted_sheets = sorted(sheets.items(), key=lambda x: len(x[1]), reverse=True)
        for name, d in sorted_sheets:
            if len(d) >= 5:
                records.extend(_parse_sheet_records(name, d))
                break
    return records


def build_plan_timeseries(sheets: Dict[str, pd.DataFrame]) -> List[Dict]:
    """Outlook CHR Sales file → 'P' sheet contains the plan/forecast."""
    sheet_name, df = _get_named_sheet(sheets, "P", "Plan", "Previziuni", "Forecast", "Budget")
    if df is None or len(df) < 3:
        logger.warning("Plan: no 'P' sheet found — falling back to largest sheet")
        sorted_sheets = sorted(sheets.items(), key=lambda x: len(x[1]), reverse=True)
        for name, d in sorted_sheets:
            if len(d) >= 3:
                sheet_name, df = name, d
                break
    if df is None:
        return []
    logger.info("Plan: using sheet '%s' (%d rows)", sheet_name, len(df))
    # Default to current year if no year column
    current_year = date.today().year
    return _parse_sheet_records(sheet_name, df, default_year=current_year)


def build_target_timeseries(sheets: Dict[str, pd.DataFrame]) -> List[Dict]:
    """Target B2B file → 'Target 2026' sheet."""
    sheet_name, df = _get_named_sheet(sheets, "Target 2026", "Target", "Targets", "Obiective")
    if df is None or len(df) < 3:
        sorted_sheets = sorted(sheets.items(), key=lambda x: len(x[1]), reverse=True)
        for name, d in sorted_sheets:
            if len(d) >= 3:
                sheet_name, df = name, d
                break
    if df is None:
        return []
    logger.info("Target: using sheet '%s' (%d rows)", sheet_name, len(df))
    current_year = date.today().year
    return _parse_sheet_records(sheet_name, df, default_year=current_year)


# ---------------------------------------------------------------------------
# Aggregation helpers
# ---------------------------------------------------------------------------

def get_summary_stats(timeseries: List[Dict], year: Optional[int] = None, month: Optional[int] = None) -> Dict:
    rows = timeseries
    if year:
        rows = [r for r in rows if r.get("year") == year]
    if month:
        rows = [r for r in rows if r.get("month") == month]

    def safe_sum(key):
        vals = [r[key] for r in rows if r.get(key) is not None]
        return round(sum(vals), 2) if vals else None

    revenue  = safe_sum("revenue")
    plan     = safe_sum("plan")
    ly       = safe_sum("ly")
    bookings = safe_sum("bookings")

    return {
        "revenue":      revenue,
        "bookings":     bookings,
        "plan":         plan,
        "ly":           ly,
        "vs_plan_pct":  round((revenue / plan - 1) * 100, 1) if revenue and plan else None,
        "vs_ly_pct":    round((revenue / ly - 1) * 100, 1)   if revenue and ly   else None,
        "record_count": len(rows),
    }


def get_monthly_chart(timeseries: List[Dict], year: Optional[int] = None, compare_year: Optional[int] = None) -> List[Dict]:
    MONTH_NAMES = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    def agg_by_month(rows):
        by_month: Dict[int, float] = {}
        for r in rows:
            m = r.get("month")
            v = r.get("revenue")
            if m and v is not None:
                by_month[m] = by_month.get(m, 0) + v
        return by_month

    base_rows = [r for r in timeseries if not year or r.get("year") == year]
    cmp_rows  = [r for r in timeseries if compare_year and r.get("year") == compare_year]

    base_by_month = agg_by_month(base_rows)
    cmp_by_month  = agg_by_month(cmp_rows)

    result = []
    for i, name in enumerate(MONTH_NAMES, 1):
        entry = {"month": i, "monthName": name}
        if base_by_month.get(i) is not None:
            entry["revenue"] = round(base_by_month[i], 0)
        if cmp_by_month.get(i) is not None:
            entry["revenueLY"] = round(cmp_by_month[i], 0)
        plan_vals = [r["plan"] for r in base_rows if r.get("month") == i and r.get("plan")]
        if plan_vals:
            entry["plan"] = round(sum(plan_vals), 0)
        result.append(entry)

    return result


def get_yearly_summary(timeseries: List[Dict]) -> List[Dict]:
    """Revenue + bookings aggregated by year."""
    by_year: Dict[int, Dict] = {}
    for r in timeseries:
        y = r.get("year")
        if not y or not isinstance(y, int) or y < 2000:
            continue
        if y not in by_year:
            by_year[y] = {"year": y, "revenue": 0.0, "bookings": 0.0}
        by_year[y]["revenue"]  += r.get("revenue")  or 0
        by_year[y]["bookings"] += r.get("bookings") or 0

    result = sorted(by_year.values(), key=lambda x: x["year"])
    for row in result:
        row["revenue"]  = round(row["revenue"],  0)
        row["bookings"] = round(row["bookings"], 0)
    return result


def get_agency_breakdown(timeseries: List[Dict], year: Optional[int] = None, top: int = 20) -> List[Dict]:
    """Top agencies by revenue."""
    rows = [r for r in timeseries if r.get("agency") and (not year or r.get("year") == year)]
    by_agency: Dict[str, Dict] = {}
    for r in rows:
        ag = r["agency"]
        if ag not in by_agency:
            by_agency[ag] = {"agency": ag, "revenue": 0.0, "bookings": 0.0, "plan": 0.0}
        by_agency[ag]["revenue"]  += r.get("revenue")  or 0
        by_agency[ag]["bookings"] += r.get("bookings") or 0
        by_agency[ag]["plan"]     += r.get("plan")     or 0

    sorted_agencies = sorted(by_agency.values(), key=lambda x: x["revenue"], reverse=True)
    result = []
    for a in sorted_agencies[:top]:
        a["revenue"]     = round(a["revenue"], 0)
        a["plan"]        = round(a["plan"], 0)
        a["vs_plan_pct"] = round((a["revenue"] / a["plan"] - 1) * 100, 1) if a["plan"] else None
        result.append(a)
    return result


def get_branch_breakdown(timeseries: List[Dict], year: Optional[int] = None, top: int = 30) -> List[Dict]:
    """Revenue + bookings grouped by zona/branch."""
    rows = [r for r in timeseries if r.get("zona") and (not year or r.get("year") == year)]
    by_zona: Dict[str, Dict] = {}
    for r in rows:
        z = r["zona"]
        if z not in by_zona:
            by_zona[z] = {"branch": z, "revenue": 0.0, "bookings": 0.0}
        by_zona[z]["revenue"]  += r.get("revenue")  or 0
        by_zona[z]["bookings"] += r.get("bookings") or 0

    result = sorted(by_zona.values(), key=lambda x: x["revenue"], reverse=True)
    for row in result[:top]:
        row["revenue"]  = round(row["revenue"],  0)
        row["bookings"] = round(row["bookings"], 0)
    return result[:top]


def get_recent_months(timeseries: List[Dict], n: int = 6) -> List[Dict]:
    """Last N months of data sorted by year+month for 'recent trend' view."""
    MONTH_NAMES = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    by_ym: Dict[Tuple[int, int], Dict] = {}
    for r in timeseries:
        y, m = r.get("year"), r.get("month")
        if not y or not m:
            continue
        key = (y, m)
        if key not in by_ym:
            by_ym[key] = {"year": y, "month": m, "monthName": f"{MONTH_NAMES[m-1]} {str(y)[-2:]}", "revenue": 0.0, "bookings": 0.0}
        by_ym[key]["revenue"]  += r.get("revenue")  or 0
        by_ym[key]["bookings"] += r.get("bookings") or 0

    sorted_ym = sorted(by_ym.values(), key=lambda x: (x["year"], x["month"]))
    result = sorted_ym[-n:]
    for row in result:
        row["revenue"]  = round(row["revenue"],  0)
        row["bookings"] = round(row["bookings"], 0)
    return result


def sheets_metadata(sheets: Dict[str, pd.DataFrame]) -> Dict:
    """Return column names and sample rows for each sheet (for configuration UI)."""
    meta = {}
    for name, df in sheets.items():
        sample = df.head(5).replace({np.nan: None}).to_dict(orient="records")
        meta[name] = {
            "columns": list(df.columns),
            "rows":    len(df),
            "sample":  sample,
        }
    return meta
