#!/usr/bin/env python3
"""Añade marcas temporales de captura solo cuando la fuente las publica explícitamente.

La mayoría de inventarios de tráfico no indican cuándo se tomó el fotograma. Para no
confundir la hora de ingesta con la hora de exposición, este paso utiliza una lista
conservadora de proveedores cuyos registros sí incluyen una marca temporal de imagen.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "cams.sqlite3"
EXPORTS = (
    ROOT / "public" / "data" / "cameras.json",
    ROOT / "src" / "data" / "catalog.seed.json",
)

# SG_LTA publica `timestamp` junto a cada imagen. Otros proveedores se añadirán
# únicamente después de verificar que el campo representa la captura y no la ingesta.
RELIABLE_CAPTURE_PROVIDERS = {"SG_LTA"}


def capture_times() -> dict[str, str]:
    placeholders = ",".join("?" for _ in RELIABLE_CAPTURE_PROVIDERS)
    query = (
        "SELECT c.id,c.last_seen_at FROM cameras c "
        "JOIN providers p ON p.id=c.provider_id "
        f"WHERE p.code IN ({placeholders}) AND c.active=1 "
        "AND c.last_seen_at IS NOT NULL AND TRIM(c.last_seen_at)<>''"
    )
    with sqlite3.connect(DB_PATH) as connection:
        return {
            str(camera_id): str(timestamp)
            for camera_id, timestamp in connection.execute(
                query, tuple(sorted(RELIABLE_CAPTURE_PROVIDERS))
            )
        }


def patch_export(path: Path, timestamps: dict[str, str]) -> int:
    if not path.is_file():
        raise FileNotFoundError(path)
    payload = json.loads(path.read_text(encoding="utf-8"))
    cameras = payload.get("cameras")
    if not isinstance(cameras, list):
        raise ValueError(f"Formato de catálogo no reconocido: {path}")

    changed = 0
    for camera in cameras:
        if not isinstance(camera, dict):
            continue
        captured_at = timestamps.get(str(camera.get("id", "")))
        if captured_at:
            if camera.get("capturedAt") != captured_at:
                camera["capturedAt"] = captured_at
                changed += 1
        else:
            # Elimina valores antiguos o inferidos de proveedores no verificados.
            camera.pop("capturedAt", None)

    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return changed


def main() -> int:
    timestamps = capture_times()
    total = sum(patch_export(path, timestamps) for path in EXPORTS)
    print(
        f"Capture metadata: {len(timestamps)} cámaras con hora publicada; "
        f"{total} registros actualizados"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
