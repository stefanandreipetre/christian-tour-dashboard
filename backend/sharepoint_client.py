"""
SharePoint client — downloads Excel files via public sharing links.
No authentication required if the links are shared as "Anyone with the link".
"""

import os
import logging
import requests

logger = logging.getLogger(__name__)

# Public sharing links (set these in Render environment variables)
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
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}


class SharePointClient:

    def download_file(self, file_key: str) -> bytes:
        """Download a file via its public sharing link."""
        url = FILE_URLS.get(file_key)
        if not url:
            raise ValueError(f"Unknown file key: {file_key}")

        # Append &download=1 to trigger direct file download
        download_url = url + ("&" if "?" in url else "?") + "download=1"

        session = requests.Session()
        session.headers.update(HEADERS)

        try:
            resp = session.get(download_url, allow_redirects=True, timeout=30)
            resp.raise_for_status()
        except requests.RequestException as exc:
            raise RuntimeError(
                f"Failed to download '{file_key}' from SharePoint: {exc}"
            ) from exc

        content = resp.content
        logger.info("Downloaded %s (%d bytes)", file_key, len(content))
        return content

    def list_files(self) -> dict:
        return FILE_URLS.copy()
