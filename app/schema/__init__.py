"""
app.schema: Centralized database schema definitions and registry for MySQL.
Provides the single source of truth for all 25 application tables.
"""
from app.schema.tables import ALL_TABLES, TABLE_DEFINITIONS

__all__ = ["ALL_TABLES", "TABLE_DEFINITIONS"]
