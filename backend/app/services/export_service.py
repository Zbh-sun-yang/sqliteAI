"""Data export service (CSV / JSON rendering)."""

import csv
import io
import json
from typing import Any
from datetime import datetime, date


def _json_serializable(value: Any) -> Any:
    """Convert non-JSON-serializable values (datetime, date, etc.) to strings."""
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode(errors="replace")
    return value


def rows_to_json(columns: list[str], rows: list[dict[str, Any]]) -> str:
    """Render query rows as a JSON array of objects.

    Args:
        columns: Ordered column names.
        rows: Query result rows (dicts keyed by column name).

    Returns:
        Pretty-printed JSON string.
    """
    data = [
        {col: _json_serializable(row.get(col)) for col in columns}
        for row in rows
    ]
    return json.dumps(data, ensure_ascii=False, indent=2)


def rows_to_csv(columns: list[str], rows: list[dict[str, Any]]) -> str:
    """Render query rows as CSV text (UTF-8, with BOM for Excel compatibility).

    Args:
        columns: Ordered column names.
        rows: Query result rows (dicts keyed by column name).

    Returns:
        CSV string.
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(columns)
    for row in rows:
        writer.writerow(
            [_serialize_cell(_json_serializable(row.get(col))) for col in columns]
        )
    # Prepend UTF-8 BOM so Excel opens the file with correct encoding.
    return "﻿" + buffer.getvalue()


def _serialize_cell(value: Any) -> str:
    """Flatten a cell value for CSV output."""
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)