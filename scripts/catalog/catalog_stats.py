#!/usr/bin/env python3
"""Añade estadísticas de cobertura a public/data/catalog-meta.json."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "cams.sqlite3"
META_PATH = ROOT / "public" / "data" / "catalog-meta.json"


def counts(connection: sqlite3.Connection, field: str) -> dict[str, int]:
    allowed = {"country_name", "country_code", "media_type", "category", "status"}
    if field not in allowed:
        raise ValueError(f"Unsupported statistics field: {field}")
    rows = connection.execute(
        f"SELECT COALESCE(NULLIF(TRIM({field}),''),'Unknown') AS label,COUNT(*) AS total "
        "FROM cameras WHERE active=1 AND is_public=1 GROUP BY label ORDER BY total DESC,label"
    ).fetchall()
    return {str(label): int(total) for label, total in rows}


def main() -> int:
    if not DB_PATH.exists():
        raise SystemExit("data/cams.sqlite3 does not exist")
    metadata = {}
    if META_PATH.exists():
        try:
            metadata = json.loads(META_PATH.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            metadata = {}

    with sqlite3.connect(DB_PATH) as connection:
        metadata["count"] = connection.execute(
            "SELECT COUNT(*) FROM cameras WHERE active=1 AND is_public=1"
        ).fetchone()[0]
        metadata["countries"] = counts(connection, "country_name")
        metadata["countryCodes"] = counts(connection, "country_code")
        metadata["mediaTypes"] = counts(connection, "media_type")
        metadata["categories"] = counts(connection, "category")
        metadata["statuses"] = counts(connection, "status")
        metadata["quality"] = {
            "verifiedOnline": connection.execute(
                "SELECT COUNT(*) FROM cameras WHERE active=1 AND is_public=1 AND status='online'"
            ).fetchone()[0],
            "unknown": connection.execute(
                "SELECT COUNT(*) FROM cameras WHERE active=1 AND is_public=1 AND status='unknown'"
            ).fetchone()[0],
            "archivedLegacyYouTube": connection.execute(
                "SELECT COUNT(*) FROM cameras c JOIN providers p ON p.id=c.provider_id "
                "WHERE p.code='LEGACY_YOUTUBE' AND c.active=0"
            ).fetchone()[0],
        }

    metadata["statisticsGeneratedAt"] = datetime.now(timezone.utc).isoformat()
    META_PATH.parent.mkdir(parents=True, exist_ok=True)
    META_PATH.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Catalog statistics ready for {metadata['count']} cameras in {len(metadata['countries'])} countries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
