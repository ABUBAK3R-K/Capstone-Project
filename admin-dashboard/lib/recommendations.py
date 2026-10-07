"""Asks the recommendation service to rebuild its similarity cache.

Approving a business mirrors it into `places` (migration 008), but the
service only sees new places when its in-memory matrix is rebuilt — so
without this, a freshly approved listing had no "Similar places" (and never
appeared in anyone else's) until the next restart or periodic refresh.

Fire-and-forget on a background thread: the rebuild is O(N^2) and can take
seconds, and the reviewer shouldn't wait on it. Optional — a no-op unless
both RECOMMENDATIONS_URL and ADMIN_API_KEY are set.
"""

import logging
import os
import threading
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

RECOMMENDATIONS_URL = os.environ.get("RECOMMENDATIONS_URL", "").rstrip("/")
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "")
REFRESH_TIMEOUT_SECONDS = 120


def is_configured() -> bool:
    return bool(RECOMMENDATIONS_URL and ADMIN_API_KEY)


def _post_refresh() -> None:
    request = urllib.request.Request(
        f"{RECOMMENDATIONS_URL}/recommendations/refresh",
        method="POST",
        headers={"X-Admin-Key": ADMIN_API_KEY},
    )
    try:
        with urllib.request.urlopen(request, timeout=REFRESH_TIMEOUT_SECONDS) as response:
            logger.info("Recommendation refresh: HTTP %s", response.status)
    except (urllib.error.URLError, TimeoutError) as e:
        logger.warning("Recommendation refresh failed: %s", e)


def trigger_refresh() -> bool:
    """Start a background refresh. Returns False if the service isn't configured."""
    if not is_configured():
        return False
    threading.Thread(target=_post_refresh, name="recommendation-refresh", daemon=True).start()
    return True
