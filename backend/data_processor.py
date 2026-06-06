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

# Combined ordered map (longer keys first to avoid partial matches)
_ALL_MONTH_KEYS = sorted(
    list(MONTH_MAP_RO.items()) + list(MONTH_MAP_EN.items()),
    key=lambda x: -len(x[0])
)


def _month_from_str(s: str) -> Optional[int]:
    """Extract a month number (1-12) from any string — sheet name, column name, etc."""
    sl = str(s).strip().lower()
    for key, num in _ALL_MONTH_KEYS:
        if key in sl:
            return num
    return None


def _year_from_str(s: str) -> Optional[int]:
    """Extract a 4-digit year from a string. Also handles 2-digit suffix like '26'."""
    s = str(s).strip()
    m = re.search(r'\b(20\d{2})\b', s)
    if m:
        return int(m.group(1))
    m = re.search(r'(\d{2})\s*$', s)
    if m:
        y = int(m.group(1))
        if 20 <= y <= 40:
            return 2000 + y
    return None


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
# Wide-format parsers (month columns instead of month rows)
# ---------------------------------------------------------------------------

def _col_sum(df: pd.DataFrame, col: str) -> Optional[float]:
    """Sum all numeric positive values in a column."""
    try:
        vals = pd.to_numeric(df[col], errors="coerce").dropna()
        vals = vals[vals > 0]
        return float(vals.sum()) if len(vals) > 0 else None
    except Exception:
        return None


def _parse_wide_plan_sheet(sheet_name: str, df: pd.DataFrame, default_year: int) -> List[Dict]:
    """
    Outlook 'P' / 'F' / 'LY' / 'OUTLOOK' sheets:
      rows = metric descriptions, columns = months (Jan, Feb, ..., Dec)
    Strategy: for each month column, sum all positive numeric values.
    """
    # Find month columns by name
    month_cols: Dict[int, str] = {}
    for col in df.columns:
        m = _month_from_str(str(col))
        if m and m not in month_cols:
            # Only treat as a month column if name is short (pure month abbr)
            col_str = str(col).strip().lower()
            if len(col_str) <= 12 and not col_str.startswith("col_"):
                month_cols[m] = col

    if not month_cols:
        logger.warning("Wide plan sheet '%s': no month columns found (cols: %s)", sheet_name, list(df.columns)[:8])
        return []

    logger.info("Wide plan sheet '%s': found month cols for months %s", sheet_name, sorted(month_cols))
    records = []
    for month_num, col in sorted(month_cols.items()):
        total = _col_sum(df, col)
        if total is None:
            continue
        records.append({
            "sheet": sheet_name, "month": month_num, "year": default_year,
            "revenue": None, "bookings": None, "plan": total,
            "ly": None, "agency": None, "zona": None,
        })
    return records


def _parse_wide_target_sheet(sheet_name: str, df: pd.DataFrame) -> List[Dict]:
    """
    'Target 2026' sheet: rows = agencies, columns = Target Jan26, Realizat Jan26, Target Feb26...
    Strategy: for each 'Target MonYY' column, sum agency values → monthly target.
              For matching 'Realizat MonYY' column, sum → monthly actual.
    """
    current_year = date.today().year
    # Collect (month, year, target_col, realizat_col) tuples
    month_data: Dict[Tuple[int, int], Dict] = {}
    for col in df.columns:
        col_str = str(col).strip()
        col_low = col_str.lower()
        if col_low.startswith("target") or col_low.startswith("obiectiv"):
            m = _month_from_str(col_str)
            y = _year_from_str(col_str) or current_year
            if m:
                key = (m, y)
                if key not in month_data:
                    month_data[key] = {"target_col": None, "realizat_col": None}
                month_data[key]["target_col"] = col
        elif col_low.startswith("realizat") or col_low.startswith("actual"):
            m = _month_from_str(col_str)
            y = _year_from_str(col_str) or current_year
            if m:
                key = (m, y)
                if key not in month_data:
                    month_data[key] = {"target_col": None, "realizat_col": None}
                month_data[key]["realizat_col"] = col

    if not month_data:
        logger.warning("Wide target sheet '%s': no Target/Realizat columns found", sheet_name)
        return []

    logger.info("Wide target sheet '%s': found %d month/year combos", sheet_name, len(month_data))
    records = []
    for (month_num, year_num), cols in sorted(month_data.items()):
        plan    = _col_sum(df, cols["target_col"])   if cols.get("target_col")   else None
        revenue = _col_sum(df, cols["realizat_col"]) if cols.get("realizat_col") else None
        if plan is None and revenue is None:
            continue
        records.append({
            "sheet": sheet_name, "month": month_num, "year": year_num,
            "revenue": revenue, "bookings": None, "plan": plan,
            "ly": None, "agency": None, "zona": None,
        })
    return records


def _parse_monthly_named_sheets(sheets: Dict[str, pd.DataFrame], *prefixes: str) -> List[Dict]:
    """
    Handle sheets named like 'etrip ian', 'etrip feb', 'Tina ian', 'Tina Feb', ...
    Each sheet = one month of data; rows = agencies; last large numeric col = revenue.
    Month is extracted from the sheet name.
    """
    current_year = date.today().year
    records = []
    for sheet_name, df in sheets.items():
        name_low = sheet_name.strip().lower()
        # Only process sheets that start with one of the given prefixes
        if not any(name_low.startswith(p.lower()) for p in prefixes):
            continue
        if len(df) < 2:
            continue
        month_num = _month_from_str(sheet_name)
        if not month_num:
            continue

        # Find the revenue column: the numeric column with the largest total
        numeric_sums: Dict[str, float] = {}
        for col in df.columns:
            col_str = str(col).strip()
            if col_str.lower().startswith("col_"):
                continue  # skip unnamed
            try:
                s = pd.to_numeric(df[col], errors="coerce").dropna()
                s = s[s > 0]
                if len(s) > 0:
                    numeric_sums[col] = float(s.sum())
            except Exception:
                pass

        if not numeric_sums:
            # Try unnamed columns (Col_0, Col_1...) — pick the one with largest sum
            for col in df.columns:
                try:
                    s = pd.to_numeric(df[col], errors="coerce").dropna()
                    s = s[s > 0]
                    if len(s) > 0:
                        numeric_sums[col] = float(s.sum())
                except Exception:
                    pass

        if not numeric_sums:
            continue

        # Revenue = column with largest total (most likely the revenue/nett column)
        rev_col = max(numeric_sums, key=numeric_sums.get)
        pax_col = None
        # PAX = numeric column with smallest sum if there are >1 numeric cols
        if len(numeric_sums) > 1:
            other = {c: v for c, v in numeric_sums.items() if c != rev_col}
            pax_col = min(other, key=other.get)

        total_rev = numeric_sums[rev_col]
        total_pax = numeric_sums.get(pax_col) if pax_col else None

        logger.info(
            "Monthly sheet '%s': month=%d rev_col='%s' total=%.0f",
            sheet_name, month_num, rev_col, total_rev
        )
        records.append({
            "sheet": sheet_name, "month": month_num, "year": current_year,
            "revenue": round(total_rev, 2),
            "bookings": round(total_pax, 0) if total_pax else None,
            "plan": None, "ly": None, "agency": None, "zona": None,
        })
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
    """
    B2C Dashboard file → monthly 'etrip ian/feb/...' + 'Tina ian/feb/...' sheets.
    Each sheet name encodes the month; rows are agencies; largest numeric col = revenue.
    Falls back to generic detection if monthly sheets not found.
    """
    records = _parse_monthly_named_sheets(sheets, "etrip", "tina", "e-trip")
    if records:
        logger.info("B2C: parsed %d monthly records from etrip/Tina sheets", len(records))
        return records

    # Fallback: try a single sheet named 'etrip' or 'tina'
    logger.warning("B2C: no monthly etrip/Tina sheets found — trying single-sheet fallback")
    for candidate in ("etrip", "tina", "e-trip", "b2c", "site"):
        name, df = _get_named_sheet(sheets, candidate)
        if df is not None and len(df) >= 5:
            records.extend(_parse_sheet_records(name, df))
    if not records:
        sorted_sheets = sorted(sheets.items(), key=lambda x: len(x[1]), reverse=True)
        for name, d in sorted_sheets:
            if len(d) >= 5:
                records.extend(_parse_sheet_records(name, d))
                break
    return records


def build_plan_timeseries(sheets: Dict[str, pd.DataFrame]) -> List[Dict]:
    """
    Outlook CHR Sales file → 'P' sheet (wide format: Description rows × month columns).
    Also tries 'F' (Forecast) and 'OUTLOOK' sheets as fallback.
    """
    current_year = date.today().year
    for candidate in ("P", "F", "OUTLOOK", "Plan", "Forecast"):
        sheet_name, df = _get_named_sheet(sheets, candidate)
        if df is not None and len(df) >= 3:
            records = _parse_wide_plan_sheet(sheet_name, df, current_year)
            if records:
                logger.info("Plan: parsed %d records from '%s' sheet", len(records), sheet_name)
                return records
    logger.warning("Plan: wide-format parse failed — falling back to row-based parser")
    sorted_sheets = sorted(sheets.items(), key=lambda x: len(x[1]), reverse=True)
    for name, d in sorted_sheets:
        if len(d) >= 3:
            return _parse_sheet_records(name, d, default_year=current_year)
    return []


def build_target_timeseries(sheets: Dict[str, pd.DataFrame]) -> List[Dict]:
    """
    Target B2B file → 'Target 2026' sheet (wide format: agency rows × Target MonYY columns).
    """
    sheet_name, df = _get_named_sheet(sheets, "Target 2026", "Target", "Targets", "Obiective")
    if df is not None and len(df) >= 3:
        records = _parse_wide_target_sheet(sheet_name, df)
        if records:
            logger.info("Target: parsed %d records from '%s' sheet", len(records), sheet_name)
            return records
    logger.warning("Target: wide-format parse failed — falling back to row-based parser")
    current_year = date.today().year
    sorted_sheets = sorted(sheets.items(), key=lambda x: len(x[1]), reverse=True)
    for name, d in sorted_sheets:
        if len(d) >= 3:
            return _parse_sheet_records(name, d, default_year=current_year)
    return []


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
