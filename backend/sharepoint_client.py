"""
SharePoint client — downloads Excel files via public sharing links.
Handles SharePoint's multi-step redirect / auth-wall patterns.
"""

import os
import re
import logging
import requests

logger = logging.getLogger(__name__)

FILE_URLS = {
    "b2b": os.getenv(
        "FILE_B2B_URL",
        "https://christiantourro-my.sharepoint.com/:x:/g/personal/stefan_petre_christiantour_ro/IQCRyA9Y8q_XQr6_YYGDMG63ATEjf4c0UwKZGbJgXqo1lnk?e=tgBmsv",
    ),
    "b2c": os.getenv(
        "FILE_B2C_URL",
        "https://christiantourro-my.sharepoint.com/:x:/g/personal/stefan_petre_christiantour_ro/IQD31dYpBNtfTqZKa7Cp_cQ-AZ2HlaCC9hA3CZeSt8hAeec?e=Dnkbb2",
    ),
    "outlook": os.getenv(
        "FILE_OUTLOOK_URL",
        "https://christiantourro-my.sharepoint.com/:x:/g/personal/stefan_petre_christiantour_ro/IQCxyTKBHSRPRYgXkZ1szebIARogcnzsHXbdkp8G3oUP1zI?e=mBKGOU",
    ),
    "target": os.getenv(
        "FILE_TARGET_URL",
        "https://christiantourro-my.sharepoint.com/:x:/g/personal/stefan_petre_christiantour_ro/IQCcb7Zu7HDjQpIwDe3DTY0aAYETijgWJvzxFprlD2acn5w?e=HGg40E",
    ),
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument"
        ".spreadsheetml.sheet,*/*;q=0.8"
    ),
}

EXCEL_MAGIC = (
    b"PK\x03\x04",           # xlsx/xlsm (zip-based)
    b"\xd0\xcf\x11\xe0",     # xls (OLE2)
)


def _is_excel(data: bytes) -> bool:
    return any(data[:4] == m for m in EXCEL_MAGIC)


def _sharing_link_to_download(url: str) -> list[str]:
    """
    Build a prioritised list of download URL candidates from a SharePoint sharing link.
    SharePoint /:x:/g/... links support several download patterns; try them in order.
    """
    candidates = []

    # 1. Direct download=1 appended to sharing link
    sep = "&" if "?" in url else "?"
    candidates.append(url + sep + "download=1")

    # 2. Replace /r/ or /:x:/g/ path with /_layouts/15/download.aspx?UniqueId=
    #    Extract the encoded UniqueId from the URL path segment after the last "/"
    uid_match = re.search(r"/([A-Za-z0-9_\-]{20,})\?", url)
    if uid_match:
        uid = uid_match.group(1)
        base = re.match(r"(https://[^/]+)", url)
        if base:
            candidates.append(
                f"{base.group(1)}/_layouts/15/download.aspx?UniqueId={uid}&e="
                + (re.search(r"\?e=(\w+)", url) or type("", (), {"group": lambda s, n: ""})()).group(1)
            )

    # 3. Append &action=default&mobileredirect=true (sometimes needed for auth flow)
    candidates.append(url + sep + "action=default&mobileredirect=true")

    return candidates


class SharePointClient:

    def download_file(self, file_key: str) -> bytes:
        url = FILE_URLS.get(file_key)
        if not url:
            raise ValueError(f"Unknown file key: {file_key}")

        session = requests.Session()
        session.headers.update(HEADERS)

        candidates = _sharing_link_to_download(url)
        last_error = None
        last_content_type = ""
        last_size = 0

        for attempt_url in candidates:
            try:
                logger.info("SP download '%s' attempt: %s", file_key, attempt_url[:80])
                resp = session.get(attempt_url, allow_redirects=True, timeout=45)

                ct = resp.headers.get("content-type", "")
                size = len(resp.content)
                last_content_type = ct
                last_size = size
                logger.info("  → HTTP %d  ct=%s  size=%d", resp.status_code, ct, size)

                if resp.status_code != 200:
                    last_error = f"HTTP {resp.status_code}"
                    continue

                if _is_excel(resp.content):
                    logger.info("SP '%s': Excel magic bytes confirmed (%d bytes)", file_key, size)
                    return resp.content

                if "html" in ct.lower():
                    # Got a login/redirect page — log first 300 chars for diagnosis
                    logger.warning(
                        "SP '%s': got HTML instead of file (ct=%s, size=%d). "
                        "First 300 chars: %s",
                        file_key, ct, size, resp.text[:300].replace("\n", " ")
                    )
                    last_error = f"HTML response (not a file): {resp.text[:120]}"
                    continue

                # No magic bytes but not HTML — may be a valid variant (csv, etc.)
                if size > 5_000:
                    logger.warning(
                        "SP '%s': no Excel magic but size=%d, ct=%s — trying anyway",
                        file_key, size, ct
                    )
                    return resp.content

                last_error = f"Response too small or unrecognised format (size={size}, ct={ct})"

            except requests.RequestException as exc:
                last_error = str(exc)
                logger.warning("SP '%s' attempt failed: %s", file_key, exc)
                continue

        raise RuntimeError(
            f"All download attempts failed for '{file_key}'. "
            f"Last error: {last_error}. Last ct={last_content_type}, size={last_size}. "
            "Check that the SharePoint sharing link is still valid ('Anyone with the link')."
        )

    def list_files(self) -> dict:
        return FILE_URLS.copy()
