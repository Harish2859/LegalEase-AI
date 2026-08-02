from contextlib import contextmanager
from psycopg import connect
from psycopg.rows import dict_row

from .config import settings


@contextmanager
def get_conn():
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is required")
    conn = connect(settings.database_url, row_factory=dict_row)
    try:
        yield conn
    finally:
        conn.close()
