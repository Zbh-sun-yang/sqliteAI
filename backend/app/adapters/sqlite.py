"""SQLite database adapter."""

import aiosqlite
from typing import Dict, List, Any, Tuple, Optional
from pathlib import Path

from app.adapters.base import (
    DatabaseAdapter,
    ConnectionConfig,
    QueryResult,
    MetadataResult,
)


class SQLiteAdapter(DatabaseAdapter):
    """SQLite database adapter using aiosqlite."""

    def _get_db_path(self) -> str:
        """Extract file path from sqlite:/// URL."""
        url = self.config.url
        # Handle sqlite:///path or sqlite+aiosqlite:///path
        prefix = "sqlite+aiosqlite:///"
        if url.startswith(prefix):
            return url[len(prefix):]
        prefix = "sqlite:///"
        if url.startswith(prefix):
            return url[len(prefix):]
        # Fallback: treat as direct path
        return url

    async def test_connection(self) -> Tuple[bool, Optional[str]]:
        """Test SQLite connection."""
        try:
            db_path = self._get_db_path()
            conn = await aiosqlite.connect(db_path)
            await conn.execute("SELECT 1")
            await conn.close()
            return True, None
        except Exception as e:
            return False, str(e)

    async def get_connection_pool(self) -> aiosqlite.Connection:
        """Get or create SQLite connection (aiosqlite has no pool)."""
        if self._pool is None:
            db_path = self._get_db_path()
            self._pool = await aiosqlite.connect(db_path)
        return self._pool

    async def close_connection_pool(self) -> None:
        """Close SQLite connection."""
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def extract_metadata(self) -> MetadataResult:
        """Extract SQLite metadata from sqlite_master."""
        conn = await self.get_connection_pool()

        tables: List[Dict[str, Any]] = []
        views: List[Dict[str, Any]] = []

        # Get all tables and views
        cursor = await conn.execute(
            "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name"
        )
        rows = await cursor.fetchall()
        await cursor.close()

        for name, obj_type in rows:
            if obj_type == "table":
                columns = await self._get_columns(conn, name)
                row_count = await self._get_row_count(conn, name)
                table_meta = {
                    "name": name,
                    "type": "table",
                    "schemaName": "main",
                    "columns": columns,
                }
                if row_count is not None:
                    table_meta["rowCount"] = row_count
                tables.append(table_meta)
            else:
                columns = await self._get_columns(conn, name)
                views.append({
                    "name": name,
                    "type": "view",
                    "schemaName": "main",
                    "columns": columns,
                })

        return MetadataResult(tables=tables, views=views)

    async def _get_columns(self, conn: aiosqlite.Connection, table_name: str) -> List[Dict[str, Any]]:
        """Get column metadata for a table."""
        cursor = await conn.execute(f'PRAGMA table_info("{table_name}")')
        rows = await cursor.fetchall()
        await cursor.close()

        columns: List[Dict[str, Any]] = []
        for row in rows:
            col_pk = row[5] == 1
            col_notnull = row[3] == 1
            columns.append({
                "name": row[1],
                "dataType": row[2] or "text",
                "nullable": not col_notnull,
                "primaryKey": col_pk,
                "unique": False,
                "defaultValue": row[4],
            })
        return columns

    async def _get_row_count(self, conn: aiosqlite.Connection, table_name: str) -> Optional[int]:
        """Get row count for a table."""
        try:
            cursor = await conn.execute(f'SELECT COUNT(*) FROM "{table_name}"')
            row = await cursor.fetchone()
            await cursor.close()
            return row[0] if row else 0
        except Exception:
            return None

    async def execute_query(self, sql: str) -> QueryResult:
        """Execute query against SQLite."""
        conn = await self.get_connection_pool()

        cursor = await conn.execute(sql)
        rows = await cursor.fetchall()

        # Build column metadata
        columns: List[Dict[str, str]] = []
        if cursor.description:
            for desc in cursor.description:
                columns.append({"name": desc[0], "dataType": "text"})

        # Convert rows to list of dicts
        result_rows: List[Dict[str, Any]] = []
        col_names = [c["name"] for c in columns]
        for row in rows:
            result_rows.append(dict(zip(col_names, row)))

        await cursor.close()

        return QueryResult(
            columns=columns,
            rows=result_rows,
            row_count=len(result_rows)
        )

    def get_dialect_name(self) -> str:
        """Get SQLite dialect name."""
        return "sqlite"

    def get_identifier_quote_char(self) -> str:
        """SQLite uses double quotes."""
        return '"'