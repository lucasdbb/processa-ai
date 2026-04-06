"""Shared CSV export utilities."""

import csv
import io
from typing import Any, Sequence


def rows_to_csv(headers: list[str], rows: Sequence[Sequence[Any]]) -> str:
    """Convert rows to CSV string with BOM for Excel compatibility."""
    output = io.StringIO()
    # UTF-8 BOM so Excel opens with correct encoding
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    return output.getvalue()
