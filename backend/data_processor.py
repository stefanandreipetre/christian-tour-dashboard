"""
Christian Tour Dashboard — data processor
Single source: CT Dashboard.xlsx

Sheets used:
  B2C 2026 Actuals  — wide: branch | region | Jan..Dec  (k EUR actuals 2026)
  P                 — wide: branch | region | Jan..Dec  (k EUR plan 2026)
  LY                — wide: branch | region | Jan..Dec  (k EUR actuals 2025)
  B2C Daily         — long: date | branch | pax | reservations | revenue  (EUR)
  B2B Daily         — long: partner | pax | actuals | month           (k EUR)
  B2B P             — wide or long monthly 2026 plan for B2B           (k EUR)

All k-EUR values are multiplied by 1000 on ingest → stored as EUR.
"""

import io
import re
import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Set, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

# ─── constants ─────────────────────────────────────────────────────────────

K_EUR = 1_000.0   # k EUR → EUR

MONTH_ABBR = {
    "ian": 1, "jan": 1, "january": 1, "ianuarie": 1,
    "feb": 2, "february": 2, "februarie": 2,
    "mar": 3, "march": 3, "martie": 3,
    "apr": 4, "april": 4, "aprilie": 4,
    "mai": 5, "may": 5,
    "iun": 6, "jun": 6, "june": 6, "iunie": 6,
    "iul": 7, "jul": 7, "july": 7, "iulie": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9, "septembrie": 9,
    "oct": 10, "october": 10, "octombrie": 10,
    "nov": 11, "november": 11, "noiembrie": 11,
    "dec": 12, "december": 12, "decembrie": 12,
}

SHEETS_NEEDED = ["B2C 2026 Actuals", "P", "LY", "B2C Daily", "B2B Daily", "B2B P"]

# ─── helpers ───────────────────────────────────────────────────────────────

def _num(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v) if not pd.isna(v) else None
    s = str(v).replace(",", ".").replace("\xa0", "").strip()
    if s in ("", "-", "—", "n/a", "na", "#n/a"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _col_to_month(col: Any) -> Optional[int]:
    """Map a column header to month number (1-12), or None."""
    if isinstance(col, datetime):
        return col.month
    if isinstance(col, int) and 1 <= col <= 12:
        return col
    s = str(col).strip().lower()[:10]
    # try numeric
    try:
        m = int(float(s))
        if 1 <= m <= 12:
            return m
    except ValueError:
        pass
    # try abbreviation / name
    for kw, m in MONTH_ABBR.items():
        if s.startswith(kw):
            return m
    return None


def _find_header_row(df: pd.DataFrame) -> int:
    """
    Find the first row index where ≥3 cells are non-empty strings
    (i.e. looks like a real header row, not blank/numeric preamble).
    Returns 0 if not found.
    """
    for i, row in df.iterrows():
        str_vals = [c for c in row if isinstance(c, str) and c.strip()]
        if len(str_vals) >= 3:
            return int(i)
    return 0


def _promote_header(df: pd.DataFrame) -> pd.DataFrame:
    """Use first good-looking header row as column names."""
    if df.empty:
        return df
    idx = _find_header_row(df)
    if idx == 0 and not any(isinstance(c, str) and c.strip() for c in df.iloc[0]):
        pass  # already ok or empty
    elif idx > 0 or not any(isinstance(c, str) for c in df.columns):
        df.columns = [str(c).strip() if c is not None else f"col_{i}"
                      for i, c in enumerate(df.iloc[idx])]
        df = df.iloc[idx + 1:].reset_index(drop=True)
    return df


def _detect_branch_col(df: pd.DataFrame) -> Optional[str]:
    """Return the column name most likely to hold branch/channel names."""
    candidates = []
    for col in df.columns:
        s = str(col).lower()
        if any(kw in s for kw in ("branch", "agentie", "canal", "channel", "sucursala",
                                   "denumire", "name", "unitate", "punct")):
            return col
        # fallback: first string column with mostly non-empty values
        if df[col].dtype == object:
            fill = df[col].dropna().shape[0] / max(df.shape[0], 1)
            candidates.append((fill, col))
    if candidates:
        return max(candidates, key=lambda x: x[0])[1]
    return None


def _detect_region_col(df: pd.DataFrame, branch_col: Optional[str]) -> Optional[str]:
    for col in df.columns:
        if col == branch_col:
            continue
        s = str(col).lower()
        if any(kw in s for kw in ("region", "regiune", "zona", "zone", "area")):
            return col
    return None


# ─── B2C wide sheets (B2C 2026 Actuals / P / LY) ──────────────────────────

def parse_b2c_wide_sheet(
    raw_df: pd.DataFrame,
    sheet_name: str,
    field: str,           # "revenue" | "plan" | "ly"
    year: int,
) -> List[Dict]:
    """
    Parse a wide-format B2C sheet: branch | region | Jan | Feb | ... | Dec
    Values are in k EUR → multiply by K_EUR.
    Returns list of records keyed by (year, month, branch).
    """
    df = _promote_header(raw_df.copy())
    if df.empty:
        logger.warning("%s: empty after header promotion", sheet_name)
        return []

    branch_col  = _detect_branch_col(df)
    region_col  = _detect_region_col(df, branch_col)

    # Find month columns
    month_map: Dict[str, int] = {}
    for col in df.columns:
        m = _col_to_month(col)
        if m:
            month_map[col] = m

    if len(month_map) < 2:
        logger.warning("%s: only %d month columns detected — columns: %s",
                       sheet_name, len(month_map), list(df.columns)[:20])
        return []

    logger.info("%s: branch_col=%s region_col=%s month_cols=%d",
                sheet_name, branch_col, region_col, len(month_map))

    records = []
    for _, row in df.iterrows():
        branch = str(row[branch_col]).strip() if branch_col and pd.notna(row.get(branch_col)) else None
        if not branch or branch.lower() in ("nan", "none", "", "-"):
            continue
        # Skip header-like rows repeated in body
        if _col_to_month(branch) is not None:
            continue

        region = str(row[region_col]).strip() if region_col and pd.notna(row.get(region_col)) else None

        for col, m in month_map.items():
            v = _num(row.get(col))
            if v is None:
                continue
            eur = round(v * K_EUR, 2)
            rec = {
                "sheet":   sheet_name,
                "year":    year,
                "month":   m,
                "branch":  branch,
                "region":  region,
                field:     eur,
            }
            records.append(rec)

    logger.info("%s: parsed %d records", sheet_name, len(records))
    return records


# ─── B2C Daily ─────────────────────────────────────────────────────────────

def _detect_date_col(df: pd.DataFrame) -> Optional[str]:
    for col in df.columns:
        s = str(col).lower()
        if any(kw in s for kw in ("date", "data", "zi", "day", "datum")):
            return col
    # fallback: first col with datetime-like values
    for col in df.columns:
        sample = df[col].dropna().head(10)
        if sample.apply(lambda x: isinstance(x, (datetime, date))).mean() > 0.5:
            return col
    return None


def parse_b2c_daily(
    raw_df: pd.DataFrame,
    valid_branches: Set[str],
) -> List[Dict]:
    """
    Parse B2C Daily sheet. Filter rows to only valid B2C branches.
    Aggregates by (year, month, branch) → revenue, pax, reservations.
    Values assumed to be in EUR (daily sheet, not k EUR).
    """
    df = _promote_header(raw_df.copy())
    if df.empty:
        return []

    date_col   = _detect_date_col(df)
    branch_col = _detect_branch_col(df)

    # Detect pax, reservations, revenue cols
    def _find_col(*keywords):
        for col in df.columns:
            s = str(col).lower()
            if any(kw in s for kw in keywords):
                return col
        return None

    pax_col  = _find_col("pax", "pasageri", "persons", "persoane")
    res_col  = _find_col("rezervari", "reservations", "bookings", "rezerv")
    rev_col  = _find_col("valoare", "value", "revenue", "vanzari", "sales", "incasari", "total")

    logger.info("B2C Daily: date=%s branch=%s pax=%s res=%s rev=%s",
                date_col, branch_col, pax_col, res_col, rev_col)

    if not branch_col:
        logger.warning("B2C Daily: no branch column detected")
        return []

    # Normalize valid_branches for case-insensitive match
    norm_valid = {b.strip().lower() for b in valid_branches}

    # Aggregate: {(year, month, branch) -> {revenue, pax, res}}
    agg: Dict[Tuple, Dict] = {}

    for _, row in df.iterrows():
        branch = str(row[branch_col]).strip() if pd.notna(row.get(branch_col)) else None
        if not branch or branch.lower() not in norm_valid:
            continue

        # Parse date
        dt = row.get(date_col) if date_col else None
        if isinstance(dt, str):
            for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                try:
                    dt = datetime.strptime(dt.strip(), fmt)
                    break
                except ValueError:
                    dt = None
        if not isinstance(dt, (datetime, date)):
            continue

        yr = dt.year if isinstance(dt, datetime) else dt.year
        mo = dt.month if isinstance(dt, datetime) else dt.month

        key = (yr, mo, branch)
        if key not in agg:
            agg[key] = {"revenue": 0.0, "pax": 0, "reservations": 0}

        rev = _num(row.get(rev_col)) if rev_col else None
        if rev:
            agg[key]["revenue"] += rev
        pax = _num(row.get(pax_col)) if pax_col else None
        if pax:
            agg[key]["pax"] += int(pax)
        res = _num(row.get(res_col)) if res_col else None
        if res:
            agg[key]["reservations"] += int(res)

    records = []
    for (yr, mo, branch), vals in agg.items():
        records.append({
            "sheet":        "B2C Daily",
            "year":         yr,
            "month":        mo,
            "branch":       branch,
            "region":       None,
            "revenue_daily": round(vals["revenue"], 2),
            "pax":          vals["pax"] or None,
            "reservations": vals["reservations"] or None,
        })

    logger.info("B2C Daily: %d aggregated (year,month,branch) records", len(records))
    return records


# ─── B2B Daily ─────────────────────────────────────────────────────────────

def parse_b2b_daily(raw_df: pd.DataFrame) -> List[Dict]:
    """
    Parse B2B Daily: partner name | pax | actuals | month (k EUR → EUR).
    Month may be a number, date, or name. Year inferred from column or today.
    """
    df = _promote_header(raw_df.copy())
    if df.empty:
        return []

    def _find_col(*keywords):
        for col in df.columns:
            s = str(col).lower()
            if any(kw in s for kw in keywords):
                return col
        return None

    partner_col = _find_col("partner", "client", "agentie", "agency", "denumire", "name", "partener")
    pax_col     = _find_col("pax", "pasageri", "persons")
    rev_col     = _find_col("valoare", "value", "revenue", "vanzari", "realizat", "actual", "sales", "incasat", "total")
    month_col   = _find_col("luna", "month", "lună", "period", "data", "date")
    year_col    = _find_col("year", "an", "anul")

    logger.info("B2B Daily: partner=%s pax=%s rev=%s month=%s year=%s",
                partner_col, pax_col, rev_col, month_col, year_col)

    current_year = date.today().year
    records = []

    for _, row in df.iterrows():
        partner = str(row[partner_col]).strip() if partner_col and pd.notna(row.get(partner_col)) else None
        if not partner or partner.lower() in ("nan", "none", "", "-"):
            continue

        # Parse month
        raw_month = row.get(month_col) if month_col else None
        mo = None
        yr = current_year

        if isinstance(raw_month, (datetime, date)):
            mo = raw_month.month
            yr = raw_month.year
        elif raw_month is not None:
            mo = _col_to_month(raw_month)
            if not mo:
                # try as date string
                for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%m/%Y", "%d/%m/%Y"):
                    try:
                        dt = datetime.strptime(str(raw_month).strip(), fmt)
                        mo = dt.month
                        yr = dt.year
                        break
                    except ValueError:
                        pass

        if year_col:
            y = _num(row.get(year_col))
            if y:
                yr = int(y)

        if not mo:
            continue

        rev = _num(row.get(rev_col)) if rev_col else None
        pax = _num(row.get(pax_col)) if pax_col else None

        records.append({
            "sheet":   "B2B Daily",
            "year":    yr,
            "month":   mo,
            "agency":  partner,
            "revenue": round(rev * K_EUR, 2) if rev is not None else None,
            "pax":     int(pax) if pax is not None else None,
            "plan":    None,
            "ly":      None,
        })

    logger.info("B2B Daily: %d records", len(records))
    return records


# ─── B2B Plan ──────────────────────────────────────────────────────────────

def parse_b2b_plan(raw_df: pd.DataFrame) -> List[Dict]:
    """
    Parse B2B P sheet — monthly 2026 B2B plan (k EUR → EUR).
    Accepts both wide (Jan..Dec as columns) and long (month | value) format.
    """
    df = _promote_header(raw_df.copy())
    if df.empty:
        return []

    current_year = date.today().year

    # Detect month columns (wide format)
    month_map: Dict[str, int] = {}
    for col in df.columns:
        m = _col_to_month(col)
        if m:
            month_map[col] = m

    records = []

    if len(month_map) >= 3:
        # Wide format: possibly one total row or per-partner rows
        def _find_col(*keywords):
            for col in df.columns:
                s = str(col).lower()
                if any(kw in s for kw in keywords):
                    return col
            return None

        partner_col = _find_col("partner", "client", "agentie", "denumire", "name", "partener")

        for _, row in df.iterrows():
            partner = str(row[partner_col]).strip() if partner_col and pd.notna(row.get(partner_col)) else "TOTAL"
            if partner.lower() in ("nan", "none", ""):
                partner = "TOTAL"

            for col, m in month_map.items():
                v = _num(row.get(col))
                if v is None:
                    continue
                records.append({
                    "sheet":  "B2B P",
                    "year":   current_year,
                    "month":  m,
                    "agency": partner,
                    "plan":   round(v * K_EUR, 2),
                    "revenue": None,
                    "ly":     None,
                    "pax":    None,
                })
    else:
        # Long format: month | plan columns
        def _find_col(*keywords):
            for col in df.columns:
                s = str(col).lower()
                if any(kw in s for kw in keywords):
                    return col
            return None

        month_col   = _find_col("luna", "month", "lună", "period", "mon")
        plan_col    = _find_col("plan", "target", "buget", "budget", "forecast", "value", "valoare")
        partner_col = _find_col("partner", "client", "agentie", "denumire", "name")

        for _, row in df.iterrows():
            mo = _col_to_month(row.get(month_col)) if month_col else None
            if not mo:
                continue
            v = _num(row.get(plan_col)) if plan_col else None
            if v is None:
                continue
            partner = str(row[partner_col]).strip() if partner_col and pd.notna(row.get(partner_col)) else "TOTAL"
            records.append({
                "sheet":  "B2B P",
                "year":   current_year,
                "month":  mo,
                "agency": partner,
                "plan":   round(v * K_EUR, 2),
                "revenue": None,
                "ly":     None,
                "pax":    None,
            })

    logger.info("B2B Plan: %d records", len(records))
    return records


# ─── Master builder ────────────────────────────────────────────────────────

def load_excel_bytes(raw_bytes: bytes) -> Dict[str, pd.DataFrame]:
    """
    Load only the needed sheets using openpyxl read_only (streaming).

    pd.ExcelFile() decompresses the ENTIRE zip on open — for an 89 MB file
    that balloons to ~400 MB of XML and OOMs on the 512 MB free tier.
    openpyxl read_only reads each sheet's XML lazily, one at a time.
    """
    import gc
    import openpyxl

    wb = openpyxl.load_workbook(
        io.BytesIO(raw_bytes), read_only=True, data_only=True
    )
    try:
        available = wb.sheetnames
        logger.info("CT Dashboard.xlsx sheets: %s", available)

        to_load = [s for s in SHEETS_NEEDED if s in available]
        missing  = [s for s in SHEETS_NEEDED if s not in available]
        if missing:
            logger.warning("Missing sheets: %s", missing)

        sheets: Dict[str, pd.DataFrame] = {}
        for sname in to_load:
            ws = wb[sname]
            rows = [list(row) for row in ws.iter_rows(values_only=True)]
            try:
                ws.reset_dimensions()   # releases the XML stream
            except Exception:
                pass
            sheets[sname] = pd.DataFrame(rows)
            del rows
            gc.collect()
            logger.info("Loaded sheet %s: %d rows × %d cols",
                        sname, len(sheets[sname]),
                        len(sheets[sname].columns) if not sheets[sname].empty else 0)

        return sheets
    finally:
        wb.close()
        gc.collect()


def build_b2c_timeseries(sheets: Dict[str, pd.DataFrame]) -> List[Dict]:
    """
    Combine B2C 2026 Actuals + P + LY into a unified timeseries keyed by
    (year, month, branch). B2C Daily adds pax/reservations but does NOT
    override the monthly revenue from the wide sheets.
    """
    current_year = date.today().year

    # Wide sheet parsers
    actuals_recs = parse_b2c_wide_sheet(
        sheets.get("B2C 2026 Actuals", pd.DataFrame()),
        "B2C 2026 Actuals", "revenue", current_year)

    plan_recs = parse_b2c_wide_sheet(
        sheets.get("P", pd.DataFrame()),
        "P", "plan", current_year)

    # LY parsed with current_year so it merges into same (year,month,branch) key
    # The "ly" field itself indicates it is last-year's value
    ly_recs = parse_b2c_wide_sheet(
        sheets.get("LY", pd.DataFrame()),
        "LY", "ly", current_year)

    # Collect valid branch names (union of all three sheets)
    valid_branches: Set[str] = set()
    for rec in actuals_recs + plan_recs + ly_recs:
        if rec.get("branch"):
            valid_branches.add(rec["branch"])

    # B2C Daily (EUR, not k EUR)
    daily_recs = parse_b2c_daily(
        sheets.get("B2C Daily", pd.DataFrame()),
        valid_branches)

    # Merge into (year, month, branch) dict
    key_map: Dict[Tuple, Dict] = {}

    def _upsert(rec: Dict, fields):
        k = (rec["year"], rec["month"], rec.get("branch", ""))
        if k not in key_map:
            key_map[k] = {
                "sheet": rec.get("sheet", ""),
                "year":  rec["year"],
                "month": rec["month"],
                "branch": rec.get("branch"),
                "region": rec.get("region"),
                "revenue": None,
                "plan":    None,
                "ly":      None,
                "pax":     None,
                "reservations": None,
            }
        for f in fields:
            if rec.get(f) is not None:
                key_map[k][f] = rec[f]

    for r in actuals_recs:
        _upsert(r, ["revenue", "region"])
    for r in plan_recs:
        _upsert(r, ["plan", "region"])
    for r in ly_recs:
        _upsert(r, ["ly", "region"])
    for r in daily_recs:
        _upsert(r, ["pax", "reservations"])

    result = list(key_map.values())
    logger.info("B2C timeseries: %d records (branches: %d)", len(result), len(valid_branches))
    return result


def build_b2b_timeseries(sheets: Dict[str, pd.DataFrame]) -> List[Dict]:
    """
    Combine B2B Daily (actuals) + B2B P (plan) into B2B timeseries.
    """
    daily_recs = parse_b2b_daily(sheets.get("B2B Daily", pd.DataFrame()))
    plan_recs  = parse_b2b_plan(sheets.get("B2B P", pd.DataFrame()))

    # Merge by (year, month, agency)
    key_map: Dict[Tuple, Dict] = {}

    def _upsert(rec: Dict, fields):
        k = (rec["year"], rec["month"], rec.get("agency", ""))
        if k not in key_map:
            key_map[k] = {
                "sheet":   rec.get("sheet", ""),
                "year":    rec["year"],
                "month":   rec["month"],
                "agency":  rec.get("agency"),
                "revenue": None,
                "plan":    None,
                "ly":      None,
                "pax":     None,
            }
        for f in fields:
            if rec.get(f) is not None:
                key_map[k][f] = rec[f]

    for r in daily_recs:
        _upsert(r, ["revenue", "pax"])
    for r in plan_recs:
        _upsert(r, ["plan"])

    result = list(key_map.values())
    logger.info("B2B timeseries: %d records", len(result))
    return result


def build_dashboard(sheets: Dict[str, pd.DataFrame]) -> Tuple[List[Dict], List[Dict]]:
    """Return (b2c_records, b2b_records)."""
    b2c = build_b2c_timeseries(sheets)
    b2b = build_b2b_timeseries(sheets)
    return b2c, b2b
