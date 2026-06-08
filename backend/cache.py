"""
In-memory cache — stores ONLY timeseries (slim dicts), never raw DataFrames.
Raw sheets are parsed and immediately discarded to stay within 512 MB RAM.
"""

import time
import threading
from typing import Dict, Any, Optional

_lock  = threading.Lock()
_store: Dict[str, Dict] = {}


def set_data(key: str, _raw_sheets_ignored: Any, timeseries: list) -> None:
    """Store timeseries for a source. Raw sheets are NOT stored."""
    with _lock:
        _store[key] = {
            "timeseries": timeseries,
            "updated_at": time.time(),
        }


def get_data(key: str) -> Optional[Dict]:
    with _lock:
        return _store.get(key)


def get_all_updated_at() -> Dict[str, Optional[float]]:
    with _lock:
        return {k: v.get("updated_at") for k, v in _store.items()}


def is_loaded(key: str) -> bool:
    with _lock:
        return key in _store
