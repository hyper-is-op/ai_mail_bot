import pymysql
import os
from contextlib import contextmanager

def get_db():
    return pymysql.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASS"),
        database=os.getenv("DB_NAME")
    )

@contextmanager
def get_db_ctx():
    """
    Context manager for database connections.
    Guarantees connection closure even when exceptions are raised.
    """
    conn = get_db()
    try:
        yield conn
    finally:
        conn.close()



