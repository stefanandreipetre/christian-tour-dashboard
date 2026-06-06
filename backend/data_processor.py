"""
Flexible Excel parser and data processor.

Strategy:
  1. Load every sheet from every Excel file.
  2. Auto-detect which columns contain months, years, revenue, bookings, etc.
     using fuzzy name matching (Romanian & English keywords).
  3. Expose normalised DataFrames for the API layer.
  4. Also expose raw sheet contents so the frontend can show a "configure" view.
"""

import io
import re
import logging
from typing import Dict, Optional, List, Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Column detection keywords (Romanian + English, case-insensitive)
# ---------------------------------------------------------------------------
MONTH_KEYWORDS = ["luna", "month", "lună", "perioada", "period", "data", "date", "mon", "month only"]
YEAR_KEYWORDS = ["year", "an", "ani"]
REVENUE_KEYWORDS = [
    "nett", "net", "revenue", "vanzari", "vânzări", "cifra", "valoare",
    "incasari", "încasări", "sales", "rulaj", "suma", "sumă", "lei", "ron", "eur", "usd",
]
BOOKING_KEYWORDS = [
    "pax", "rezervari", "rezervări", "bookings", "numar", "număr", "pasageri",
    "călători", "calatori", "nr.", "contracts", "contracte",
]
PLAN_KEYWORDS = ["plan", "target", "buget", "budget", "obiectiv", "forecast", "prognoza"]
LY_KEYWORDS = ["an anterior", "precedent", "2024", "2023", "prev year", "anterior", "last year", "ly "]
AGENCY_KEYWORDS = ["client name", "client", "agentie", "agenție", "agency", "partener", "partner", "denumire"]

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


def _score_col(col_name: str, keywords: List[str]) -> int:
    """Return how many keywords appear in the column name."""
    low = str(col_name).lower()
    return sum(1 for kw in keywords if kw in low)


def _detect_col(df: pd.DataFrame, keywords: List[str], exclude: Optional[List[str]] = None) -> Optional[str]:
    """Return the column name that best matches the given keywords."""
    scores = {c: _score_col(c, keywords) for c in df.columns}
    if exclude:
        for ex in exclude:
            for kw in exclude:
                scores = {c: s for c, s in scores.items() if kw not in str(c).lower()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else None


def _parse_month(val) -> Optional[int]:
    """Try to convert a cell value to a month number 1-12."""
    if pd.isna(val):
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


def _clean_numeric(series: pd.Series) -> pd.Series:
    """Coerce a series to numeric, handling spaces / commas as thousand separators."""
    return pd.to_numeric(
        series.astype(str).str.replace(r"[^\d.\-]", "", regex=True),
        errors="coerce",
    )


def load_excel_bytes(raw: bytes, source_key: str) -> Dict[str, pd.DataFrame]:
    """
    Parse all sheets from an Excel file.
    Returns {sheet_name: DataFrame}.
    Skips completely empty sheets.
    """
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
        # Try to auto-detect header row (first row with many non-null values)
        df = _promote_header(df)
        df.columns = [str(c).strip() for c in df.columns]
        # Drop rows where all values are null
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
# Normalised data builders
# ---------------------------------------------------------------------------

def build_b2b_timeseries(sheets: Dict[str, pd.DataFrame]) -> List[Dict]:
    """
    Build a month-by-month B2B revenue timeseries from the B2B Monthly file.
    Prefers larger transactional sheets over small pivot/summary sheets.
    """
    records = []
    # Sort: largest sheets first, skip tiny ones
    sorted_sheets = sorted(sheets.items(), key=lambda x: len(x[1]), reverse=True)
    for sheet_name, df in sorted_sheets:
        if len(df) < 5:
            continue  # skip near-empty sheets
        month_col = _detect_col(df, MONTH_KEYWORDS)
        year_col = _detect_col(df, YEAR_KEYWORDS)
        revenue_col = _detect_col(df, REVENUE_KEYWORDS)
        booking_col = _detect_col(df, BOOKING_KEYWORDS)
        plan_col = _detect_col(df, PLAN_KEYWORDS)
        ly_col = _detect_col(df, LY_KEYWORDS)
        agency_col = _detect_col(df, AGENCY_KEYWORDS)

        for _, row in df.iterrows():
            month_val = _parse_month(row.get(month_col)) if month_col else None
            year_val = None
            if year_col:
                try:
                    year_val = int(float(str(row.get(year_col)).replace(",", ".")))
                except Exception:
                    pass

            def safe_float(col):
                if not col:
                    return None
                val = row.get(col)
                if val is None or (isinstance(val, float) and pd.isna(val)):
                    return None
                try:
                    cleaned = str(val).strip().replace(",", ".").replace(" ", "")
                    return float(cleaned) if cleaned and cleaned not in ("-", "–", "N/A", "") else None
                except (ValueError, TypeError):
                    return None

            rec = {
                "sheet": sheet_name,
                "month": month_val,
                "year": year_val,
                "revenue": safe_float(revenue_col),
                "bookings": safe_float(booking_col),
                "plan": safe_float(plan_col),
                "ly": safe_float(ly_col),
                "agency": str(row[agency_col]) if agency_col and pd.notna(row.get(agency_col)) else None,
            }
            # Only include rows that have at least month or revenue
            if rec["month"] or rec["revenue"]:
                records.append(rec)

    return records


def get_summary_stats(timeseries: List[Dict], year: Optional[int] = None, month: Optional[int] = None) -> Dict:
    """Aggregate KPIs from the timeseries."""
    rows = timeseries
    if year:
        rows = [r for r in rows if r.get("year") == year]
    if month:
        rows = [r for r in rows if r.get("month") == month]

    def safe_sum(key):
        vals = [r[key] for r in rows if r.get(key) is not None]
        return round(sum(vals), 2) if vals else None

    revenue = safe_sum("revenue")
    plan = safe_sum("plan")
    ly = safe_sum("ly")
    bookings = safe_sum("bookings")

    return {
        "revenue": revenue,
        "bookings": bookings,
        "plan": plan,
        "ly": ly,
        "vs_plan_pct": round((revenue / plan - 1) * 100, 1) if revenue and plan else None,
        "vs_ly_pct": round((revenue / ly - 1) * 100, 1) if revenue and ly else None,
        "record_count": len(rows),
    }


def get_monthly_chart(timeseries: List[Dict], year: Optional[int] = None, compare_year: Optional[int] = None) -> List[Dict]:
    """Aggregate revenue by month, optionally for two years."""
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
    cmp_rows = [r for r in timeseries if compare_year and r.get("year") == compare_year]

    base_by_month = agg_by_month(base_rows)
    cmp_by_month = agg_by_month(cmp_rows)

    result = []
    for i, name in enumerate(MONTH_NAMES, 1):
        entry = {"month": i, "monthName": name}
        if base_by_month.get(i) is not None:
            entry["revenue"] = round(base_by_month[i], 0)
        if cmp_by_month.get(i) is not None:
            entry["revenueLY"] = round(cmp_by_month[i], 0)
        if base_rows and any(r.get("plan") for r in base_rows):
            plan_vals = [r["plan"] for r in base_rows if r.get("month") == i and r.get("plan")]
            if plan_vals:
                entry["plan"] = round(sum(plan_vals), 0)
        result.append(entry)

    return result


def get_agency_breakdown(timeseries: List[Dict], year: Optional[int] = None, top: int = 20) -> List[Dict]:
    """Top agencies by revenue."""
    rows = [r for r in timeseries if r.get("agency") and (not year or r.get("year") == year)]
    by_agency: Dict[str, Dict] = {}
    for r in rows:
        ag = r["agency"]
        if ag not in by_agency:
            by_agency[ag] = {"agency": ag, "revenue": 0, "bookings": 0, "plan": 0}
        by_agency[ag]["revenue"] += r.get("revenue") or 0
        by_agency[ag]["bookings"] += r.get("bookings") or 0
        by_agency[ag]["plan"] += r.get("plan") or 0

    sorted_agencies = sorted(by_agency.values(), key=lambda x: x["revenue"], reverse=True)
    result = []
    for a in sorted_agencies[:top]:
        a["revenue"] = round(a["revenue"], 0)
        a["plan"] = round(a["plan"], 0)
        a["vs_plan_pct"] = round((a["revenue"] / a["plan"] - 1) * 100, 1) if a["plan"] else None
        result.append(a)
    return result


def sheets_metadata(sheets: Dict[str, pd.DataFrame]) -> Dict:
    """Return column names and sample rows for each sheet (for configuration UI)."""
    meta = {}
    for name, df in sheets.items():
        sample = df.head(5).replace({np.nan: None}).to_dict(orient="records")
        meta[name] = {
            "columns": list(df.columns),
            "rows": len(df),
            "sample": sample,
        }
    return meta
