#!/usr/bin/env python3
"""Aplica reglas de calidad antes de publicar el catálogo de Cams.

Los vídeos históricos de YouTube se conservan en SQLite, pero quedan inactivos salvo
que aparezcan explícitamente en data/verified_youtube.json. Esto evita publicar como
cámara en directo una grabación terminada, un vídeo ajeno o un identificador reutilizado.
"""
from __future__ import annotations

import json
from contextlib import closing
from pathlib import Path

import build_catalog as base

ROOT = Path(__file__).resolve().parents[2]
ALLOWLIST_PATH = ROOT / "data" / "verified_youtube.json"


def read_allowlist() -> tuple[set[str], set[str]]:
    if not ALLOWLIST_PATH.exists():
        return set(), set()
    try:
        payload = json.loads(ALLOWLIST_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return set(), set()
    videos = {str(value).strip() for value in payload.get("verifiedVideoIds", []) if str(value).strip()}
    external = {str(value).strip() for value in payload.get("verifiedExternalIds", []) if str(value).strip()}
    return videos, external


def apply_youtube_quality(connection) -> dict[str, object]:
    row = connection.execute("SELECT id FROM providers WHERE code='LEGACY_YOUTUBE'").fetchone()
    if not row:
        return {"provider": "LEGACY_YOUTUBE", "status": "ok", "count": 0, "message": "provider absent"}

    provider_id = int(row["id"])
    videos, external_ids = read_allowlist()

    connection.execute(
        "UPDATE cameras SET active=0,is_live=0,status='unknown',priority=-50,"
        "status_reason='Archivado: pendiente de verificar que siga siendo una cámara pública en directo',"
        "updated_at=? WHERE provider_id=?",
        (base.NOW(), provider_id),
    )

    reactivated = 0
    for external_id in external_ids:
        cursor = connection.execute(
            "UPDATE cameras SET active=1,is_live=1,status='online',priority=10,"
            "status_reason='Directo incluido en la lista manual de verificación',updated_at=? "
            "WHERE provider_id=? AND external_id=?",
            (base.NOW(), provider_id, external_id),
        )
        reactivated += cursor.rowcount

    for video_id in videos:
        cursor = connection.execute(
            "UPDATE cameras SET active=1,is_live=1,status='online',priority=10,"
            "status_reason='Directo incluido en la lista manual de verificación',updated_at=? "
            "WHERE provider_id=? AND source_page_url LIKE ?",
            (base.NOW(), provider_id, f"%{video_id}%"),
        )
        reactivated += cursor.rowcount

    archived = connection.execute(
        "SELECT COUNT(*) FROM cameras WHERE provider_id=? AND active=0", (provider_id,)
    ).fetchone()[0]
    connection.commit()
    return {
        "provider": "LEGACY_YOUTUBE",
        "status": "ok",
        "count": reactivated,
        "archived": archived,
        "message": "solo se publican identificadores incluidos en data/verified_youtube.json",
    }


def main() -> int:
    with closing(base.ensure_database()) as connection:
        report = apply_youtube_quality(connection)
        base.export_catalog(connection, [report])
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
