"""
Simple in-memory data cache with timestamps.
Keyed by source name ('b2b', 'b2c', 'outlook', 'target').
"""

import time
import threading
from typing import Dict, Any, Optional

_lock = threading.Lock()
_store: Dict[str, Dict] = {}


def set_data(key: str, raw_sheets: Dict, timeseries: list) -> None:
    with _lock:
        _store[key] = {
            "sheets": raw_sheets,
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
