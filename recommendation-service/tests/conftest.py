"""
Shared fixtures. No test touches a real database: strategies and endpoints
only ever call `session.execute(text(...))`, so a fake session that answers
by SQL fragment is enough to drive them.
"""

import os
import sys
from pathlib import Path
from types import SimpleNamespace

# Must run before anything imports database.py / security.py: load_dotenv()
# never overrides variables that are already set, so blanking them here keeps
# a developer's real recommendation-service/.env out of the tests.
for name in ("DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "ADMIN_API_KEY", "REFRESH_INTERVAL_MINUTES"):
    os.environ[name] = ""

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402


def row(**fields):
    """A result row: attribute access, like SQLAlchemy's Row."""
    return SimpleNamespace(**fields)


class FakeResult:
    def __init__(self, rows):
        self._rows = list(rows)
        self.rowcount = len(self._rows)

    def fetchall(self):
        return self._rows

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def scalar(self):
        first = self.fetchone()
        return None if first is None else next(iter(vars(first).values()))


class FakeSession:
    """Answers `execute` with the rows of the first handler whose SQL fragment
    appears in the statement. A handler's rows may be a callable taking the
    bound params, for queries whose answer depends on them."""

    def __init__(self, handlers=()):
        self.handlers = list(handlers)
        self.executed = []
        self.commits = 0
        self.rollbacks = 0

    def execute(self, clause, params=None):
        sql = str(clause)
        self.executed.append((sql, params))
        for fragment, rows in self.handlers:
            if fragment in sql:
                return FakeResult(rows(params) if callable(rows) else rows)
        return FakeResult([])

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        pass


# SQL fragments that identify each query the strategies issue.
PLACES_SQL = "FROM places"
COLLAB_SQL = "GROUP BY user_id, place_id, interaction_type"
COUNTS_SQL = "GROUP BY place_id"


def place(id, category, lat, lon, subcategory=None, description=None):
    return row(id=id, category=category, subcategory=subcategory, description=description, lat=lat, lon=lon)


def interaction_group(user_id, place_id, interaction_type="view", cnt=1):
    return row(user_id=user_id, place_id=place_id, interaction_type=interaction_type, cnt=cnt)


@pytest.fixture
def make_session():
    return FakeSession
