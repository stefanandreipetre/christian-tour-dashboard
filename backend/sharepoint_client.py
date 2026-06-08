"""
SharePoint client — single consolidated Excel file (CT Dashboard.xlsx).
"""

import os
import logging
import requests

logger = logging.getLogger(__name__)

DASHBOARD_URL = os.getenv(
    "FILE_DASHBOARD_URL",
    "https://christiantourro-my.sharepoint.com/:x:/g/personal/stefan_petre_christiantour_ro/IQChAr85ZKmtQL1GlppSom5aAa_gUQQei2D4NK62bnZYA_0?e=I2fQmr",
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
}

EXCEL_MAGIC = (b"PK\x03\x04", b"\xd0\xcf\x11\xe0")


def _is_excel(data: bytes) -> bool:
    return any(data[:4] == m for m in EXCEL_MAGIC)


def _build_candidates(url: str) -> list[str]:
    """Return ordered list of download URL candidates."""
    base = url.split("?")[0]
    query = url.split("?")[1] if "?" in url else ""
    return [
        url + "&download=1",
        url + "&action=default&mobileredirect=true",
        base + "?" + query + "&download=1" if query else base + "?download=1",
        base.replace("/:x:/g/", "/_layouts/15/download.aspx?share=") + "?" + query,
    ]


class SharePointClient:
    def download_file(self, _key: str = "dashboard") -> bytes:
        """Download CT Dashboard.xlsx. key param kept for API compatibility."""
        candidates = _build_candidates(DASHBOARD_URL)
        last_err = None
        for url in candidates:
            try:
                logger.info("Trying download URL: %s", url[:80])
                r = requests.get(url, headers=HEADERS, timeout=120, allow_redirects=True)
                r.raise_for_status()
                data = r.content
                if _is_excel(data):
                    logger.info("Downloaded CT Dashboard.xlsx: %d bytes", len(data))
                    return data
                logger.warning("URL returned non-Excel content (%d bytes, type=%s), trying next",
                               len(data), r.headers.get("Content-Type", "?"))
            except Exception as exc:
                last_err = exc
                logger.warning("Download attempt failed: %s", exc)
        raise RuntimeError(f"All download attempts failed. Last error: {last_err}")
