"""
SharePoint client — downloads Excel files using username/password auth.
Falls back gracefully so the rest of the app still starts if credentials
are missing or wrong; each endpoint returns a clear error instead of crashing.
"""

import os
import io
import logging
from typing import Optional
from office365.runtime.auth.user_credential import UserCredential
from office365.sharepoint.client_context import ClientContext

logger = logging.getLogger(__name__)

SHAREPOINT_URL = os.getenv("SHAREPOINT_URL", "https://christiantourro-my.sharepoint.com")
USERNAME = os.getenv("SHAREPOINT_USERNAME", "")
PASSWORD = os.getenv("SHAREPOINT_PASSWORD", "")

# Paths relative to the SharePoint personal site root
FILE_PATHS = {
    "b2b": os.getenv(
        "FILE_B2B_PATH",
        "/personal/stefan_petre_christiantour_ro/Documents/B2B Monthly 2024_2025 - Copy.xlsx",
    ),
    "b2c": os.getenv(
        "FILE_B2C_PATH",
        "/personal/stefan_petre_christiantour_ro/Documents/Dashboard Performance ( b2c)_2026.xlsx",
    ),
    "outlook": os.getenv(
        "FILE_OUTLOOK_PATH",
        "/personal/stefan_petre_christiantour_ro/Documents/Outlook _CHR_Sales_2026_Site separat.xlsm",
    ),
    "target": os.getenv(
        "FILE_TARGET_PATH",
        "/personal/stefan_petre_christiantour_ro/Documents/Target B2B 2026_Refacut.xlsx.xlsx",
    ),
}


class SharePointClient:
    def __init__(self):
        self._ctx: Optional[ClientContext] = None

    def _get_context(self) -> ClientContext:
        if self._ctx is None:
            if not USERNAME or not PASSWORD:
                raise RuntimeError(
                    "SHAREPOINT_USERNAME and SHAREPOINT_PASSWORD must be set in environment."
                )
            creds = UserCredential(USERNAME, PASSWORD)
            self._ctx = ClientContext(SHAREPOINT_URL).with_credentials(creds)
        return self._ctx

    def download_file(self, file_key: str) -> bytes:
        """Download a file by its key and return raw bytes."""
        path = FILE_PATHS.get(file_key)
        if not path:
            raise ValueError(f"Unknown file key: {file_key}")

        ctx = self._get_context()
        buf = io.BytesIO()
        try:
            ctx.web.get_file_by_server_relative_url(path).download(buf).execute_query()
        except Exception as exc:
            # Reset context so next call re-authenticates
            self._ctx = None
            raise RuntimeError(f"Failed to download '{file_key}' from SharePoint: {exc}") from exc

        buf.seek(0)
        logger.info("Downloaded %s (%d bytes)", file_key, len(buf.getvalue()))
        return buf.read()

    def list_files(self) -> dict:
        """Return configured file paths (for diagnostics)."""
        return FILE_PATHS.copy()
