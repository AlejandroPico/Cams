#!/usr/bin/env python3
"""Oculta las camaras de agregador que repiten una camara de un organismo oficial.

Windy tambien lista camaras publicas de trafico que el catalogo ya importa de su
fuente original, asi que el mismo punto aparecia dos veces con la misma imagen. Se
conserva siempre la version oficial: da imagen directa en lugar de un iframe, trae
mejores metadatos y no depende de un tercero.

No borra nada. Marca la copia como inactiva con un motivo propio, de modo que si el
organismo oficial deja de publicar esa camara la copia puede recuperarse.
"""
from __future__ import annotations

import sqlite3
import sys
from contextlib import closing

import build_catalog as base

# Proveedores considerados agregadores: sus registros ceden ante la fuente original.
AGGREGATORS = ("WINDY_WEBCAMS",)

# Precision de la rejilla de comparacion. Cuatro decimales son unos 11 metros en el
# ecuador: suficiente para detectar la misma camara y lo bastante estricto para no
# fusionar dos camaras distintas que esten proximas.
GRID = 4

REASON = "Duplicada de una camara oficial ya presente en el catalogo"


def dedupe(connection: sqlite3.Connection) -> dict[str, int]:
    placeholders = ",".join("?" for _ in AGGREGATORS)

    # Rejilla ocupada por proveedores oficiales.
    official: set[tuple[float, float]] = set()
    for row in connection.execute(
        f"SELECT c.latitude, c.longitude FROM cameras c JOIN providers p ON p.id=c.provider_id "
        f"WHERE c.active=1 AND p.code NOT IN ({placeholders})", AGGREGATORS
    ):
        official.add((round(row[0], GRID), round(row[1], GRID)))

    hidden = 0
    for row in connection.execute(
        f"SELECT c.id, c.latitude, c.longitude FROM cameras c JOIN providers p ON p.id=c.provider_id "
        f"WHERE c.active=1 AND p.code IN ({placeholders})", AGGREGATORS
    ).fetchall():
        if (round(row[1], GRID), round(row[2], GRID)) in official:
            connection.execute(
                "UPDATE cameras SET active=0,status='offline',status_reason=?,updated_at=? WHERE id=?",
                (REASON, base.NOW(), row[0]),
            )
            hidden += 1

    # Recuperacion: si la camara oficial ya no esta, la copia vuelve a publicarse.
    restored = 0
    for row in connection.execute(
        "SELECT id, latitude, longitude FROM cameras WHERE active=0 AND status_reason=?", (REASON,)
    ).fetchall():
        if (round(row[1], GRID), round(row[2], GRID)) not in official:
            connection.execute(
                "UPDATE cameras SET active=1,status='online',status_reason=NULL,updated_at=? WHERE id=?",
                (base.NOW(), row[0]),
            )
            restored += 1

    connection.commit()
    return {"hidden": hidden, "restored": restored}


def main() -> int:
    with closing(base.ensure_database()) as connection:
        result = dedupe(connection)
        base.export_catalog(connection, [{"provider": "DEDUPE", "status": "ok", **result}])
        total = connection.execute(
            "SELECT COUNT(*) FROM cameras WHERE active=1 AND is_public=1"
        ).fetchone()[0]
    print(
        f"Deduplicacion: {result['hidden']} copias ocultadas, "
        f"{result['restored']} recuperadas; {total} camaras publicas"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
