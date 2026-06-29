# import pymysql
# import os
# from contextlib import contextmanager

# def get_db():
#     return pymysql.connect(
#         host=os.getenv("DB_HOST"),
#         user=os.getenv("DB_USER"),
#         password=os.getenv("DB_PASS"),
#         database=os.getenv("DB_NAME")
#     )

# @contextmanager
# def get_db_ctx():
#     """
#     Context manager for database connections.
#     Guarantees connection closure even when exceptions are raised.
#     """
#     conn = get_db()
#     try:
#         yield conn
#     finally:
#         conn.close()



# app/db.py
import pymysql
import os
from contextlib import contextmanager
from dbutils.pooled_db import PooledDB

_pool = None

def _get_pool():
    global _pool
    if _pool is None:
        _pool = PooledDB(
            creator=pymysql,
            maxconnections=20,   # tune based on your MySQL max_connections
            mincached=2,
            maxcached=10,
            blocking=True,       # queue requests instead of crashing
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASS"),
            database=os.getenv("DB_NAME"),
            autocommit=False,
        )
    return _pool

def get_db():
    return _get_pool().connection()

@contextmanager
def get_db_ctx():
    conn = get_db()
    try:
        yield conn
    finally:
        conn.close()  # returns to pool, doesn't actually close