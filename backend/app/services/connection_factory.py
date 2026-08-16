"""Connection factory for routing to PostgreSQL, MySQL, or SQLite services."""

from app.models.database import DatabaseType
from app.services import db_connection as pg_connection
from app.services import mysql_connection


async def test_connection(db_type: DatabaseType, url: str) -> tuple[bool, str | None]:
    """
    Test database connection based on database type.

    Args:
        db_type: Database type (PostgreSQL, MySQL, or SQLite)
        url: Database connection URL

    Returns:
        Tuple of (success, error_message)
    """
    if db_type == DatabaseType.POSTGRESQL:
        return await pg_connection.test_connection(url)
    elif db_type == DatabaseType.MYSQL:
        return await mysql_connection.test_connection(url)
    elif db_type == DatabaseType.SQLITE:
        import aiosqlite
        try:
            import urllib.parse
            path = urllib.parse.urlparse(url).path
            if not path:
                return False, "Invalid SQLite URL: no path"
            conn = await aiosqlite.connect(path)
            await conn.execute("SELECT 1")
            await conn.close()
            return True, None
        except Exception as e:
            return False, str(e)
    else:
        return False, f"Unsupported database type: {db_type}"


async def get_connection_pool(
    db_type: DatabaseType, name: str, url: str, min_size: int = 1, max_size: int = 5
) -> object:
    """
    Get or create connection pool based on database type.

    Args:
        db_type: Database type (PostgreSQL, MySQL, or SQLite)
        name: Database connection name
        url: Database connection URL
        min_size: Minimum pool size
        max_size: Maximum pool size

    Returns:
        Connection pool (asyncpg.Pool, aiomysql.Pool, or aiosqlite.Connection)
    """
    if db_type == DatabaseType.POSTGRESQL:
        return await pg_connection.get_connection_pool(name, url, min_size, max_size)
    elif db_type == DatabaseType.MYSQL:
        return await mysql_connection.get_connection_pool(name, url, min_size, max_size)
    elif db_type == DatabaseType.SQLITE:
        import aiosqlite
        import urllib.parse
        path = urllib.parse.urlparse(url).path
        if not path:
            raise ValueError("Invalid SQLite URL: no path")
        return await aiosqlite.connect(path)
    else:
        raise ValueError(f"Unsupported database type: {db_type}")


async def close_connection_pool(db_type: DatabaseType, name: str) -> None:
    """
    Close connection pool based on database type.

    Args:
        db_type: Database type (PostgreSQL, MySQL, or SQLite)
        name: Database connection name
    """
    if db_type == DatabaseType.POSTGRESQL:
        await pg_connection.close_connection_pool(name)
    elif db_type == DatabaseType.MYSQL:
        await mysql_connection.close_connection_pool(name)
    elif db_type == DatabaseType.SQLITE:
        # aiosqlite connections are closed per-query, no pool to manage
        pass
    else:
        raise ValueError(f"Unsupported database type: {db_type}")
