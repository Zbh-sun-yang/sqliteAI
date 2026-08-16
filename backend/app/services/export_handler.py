"""Data export service: execute a query and render the result as CSV or JSON."""

from typing import Literal
from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models.database import DatabaseConnection
from app.models.query import QuerySource
from app.services.query_wrapper import execute_query_with_service
from app.services.export_service import rows_to_csv, rows_to_json
from app.services.sql_validator import SqlValidationError

ExportFormat = Literal["csv", "json"]  # type: ignore


async def export_query(
    session: Session,
    database_name: str,
    sql: str,
    fmt: ExportFormat,
) -> tuple[str, str, str]:
    """Execute a SQL query against a database and return the exported data.

    Args:
        session: SQLite database session
        database_name: Database connection name
        sql: SQL SELECT query to export
        fmt: Export format, "csv" or "json"

    Returns:
        (content, filename, media_type) tuple for the exported file.

    Raises:
        HTTPException: If database is not found, query fails, or format is invalid
    """
    statement = select(DatabaseConnection).where(
        DatabaseConnection.name == database_name
    )
    connection = session.exec(statement).first()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Database connection '{database_name}' not found",
        )

    try:
        result = await execute_query_with_service(
            session,
            database_name,
            connection.db_type,
            connection.url,
            sql,
            QuerySource.MANUAL,
        )
    except SqlValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query execution failed: {str(e)}",
        )

    column_names = [c.name for c in result.columns]

    if fmt == "csv":
        content = rows_to_csv(column_names, result.rows)
        filename = f"{database_name}_export.csv"
        media_type = "text/csv; charset=utf-8"
    elif fmt == "json":
        content = rows_to_json(column_names, result.rows)
        filename = f"{database_name}_export.json"
        media_type = "application/json; charset=utf-8"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported export format: {fmt}",
        )

    return content, filename, media_type