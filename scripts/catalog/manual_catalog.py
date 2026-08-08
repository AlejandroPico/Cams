#!/usr/bin/env python3
"""Importa las camaras anadidas a mano en data/manual/cameras.csv.

El fichero existia con sus cabeceras pero ningun script lo leia, asi que era un
placeholder muerto. Sirve para incorporar camaras que ningun agregador publica: una
webcam municipal, la de un puerto, la de una estacion de esqui, la panoramica de un
ayuntamiento. Basta con anadir una fila y hacer commit.

Columnas minimas: title, lat, lon y una fuente de imagen (snapshotUrl, embedUrl,
url o videoId). El resto son opcionales.
"""
from __future__ import annotations

import csv
import json
import sys
from contextlib import closing
from pathlib import Path
from typing import Any, Iterable

import build_catalog as base

CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "manual" / "cameras.csv"

TIPOS_VALIDOS = {"snapshot", "image", "mjpeg", "hls", "video", "youtube", "iframe", "link"}


def limpio(fila: dict[str, str], clave: str) -> str:
    return (fila.get(clave) or "").strip()


def deducir_tipo(fila: dict[str, str]) -> str:
    declarado = limpio(fila, "type").lower()
    if declarado in TIPOS_VALIDOS:
        return declarado
    if limpio(fila, "videoId"):
        return "youtube"
    if limpio(fila, "snapshotUrl"):
        return "snapshot"
    if limpio(fila, "embedUrl"):
        return "iframe"
    if limpio(fila, "url"):
        return "hls" if limpio(fila, "url").endswith(".m3u8") else "video"
    return "link"


def manual_loader() -> Iterable[dict[str, Any]]:
    if not CSV_PATH.is_file():
        print(f"Manual: no existe {CSV_PATH}", file=sys.stderr)
        return

    leidas = descartadas = 0
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as fichero:
        for numero, fila in enumerate(csv.DictReader(fichero), start=2):
            if not any((v or "").strip() for v in fila.values()):
                continue
            leidas += 1

            titulo = limpio(fila, "title")
            try:
                lat = float(limpio(fila, "lat"))
                lon = float(limpio(fila, "lon"))
            except ValueError:
                print(f"Manual: linea {numero} sin coordenadas validas", file=sys.stderr)
                descartadas += 1
                continue
            if not titulo or not (-90 <= lat <= 90 and -180 <= lon <= 180):
                print(f"Manual: linea {numero} sin titulo o fuera de rango", file=sys.stderr)
                descartadas += 1
                continue

            video = limpio(fila, "videoId")
            if not any([limpio(fila, "snapshotUrl"), limpio(fila, "embedUrl"), limpio(fila, "url"), video]):
                print(f"Manual: linea {numero} ({titulo}) sin ninguna fuente de imagen", file=sys.stderr)
                descartadas += 1
                continue

            identificador = limpio(fila, "id") or f"{titulo}|{lat:.5f}|{lon:.5f}"

            yield {
                "external_id": identificador,
                "title": titulo,
                "country_name": limpio(fila, "country") or None,
                "city": limpio(fila, "city") or None,
                "latitude": lat,
                "longitude": lon,
                "timezone": limpio(fila, "timezone") or None,
                "category": limpio(fila, "category") or "other",
                "media_type": deducir_tipo(fila),
                "snapshot_url": limpio(fila, "snapshotUrl") or None,
                "embed_url": (limpio(fila, "embedUrl")
                              or (f"https://www.youtube-nocookie.com/embed/{video}?autoplay=1&mute=1&playsinline=1" if video else None)),
                "stream_url": limpio(fila, "url") or None,
                "source_page_url": (limpio(fila, "sourceUrl")
                                    or (f"https://www.youtube.com/watch?v={video}" if video else None)),
                "refresh_seconds": int(limpio(fila, "refreshSeconds") or 300),
                "status": limpio(fila, "status") or "unknown",
                "attribution": limpio(fila, "attribution") or limpio(fila, "provider") or None,
                "license_name": limpio(fila, "license") or None,
                "is_live": deducir_tipo(fila) in {"youtube", "hls", "video"},
                "priority": 10,  # por delante de los agregadores: es una eleccion deliberada
            }

    print(f"Manual: {leidas} filas leidas, {descartadas} descartadas", file=sys.stderr)


def main() -> int:
    provider = {
        "code": "MANUAL",
        "name": "Contribuciones manuales",
        "homepage_url": "https://github.com/AlejandroPico/Cams",
        "api_url": "data/manual/cameras.csv",
        "country_code": None,
        "attribution": "Cams",
        "license_name": "Segun cada fuente",
        "refresh_seconds": 300,
        "enabled": 1,
        "notes": "Camaras anadidas a mano en data/manual/cameras.csv, para fuentes que ningun agregador publica.",
    }

    with closing(base.ensure_database()) as connection:
        columnas = list(provider)
        updates = ",".join(f"{c}=excluded.{c}" for c in columnas if c != "code")
        connection.execute(
            f"INSERT INTO providers ({','.join(columnas)}) VALUES ({','.join(f':{c}' for c in columnas)}) "
            f"ON CONFLICT(code) DO UPDATE SET {updates}", provider,
        )
        connection.commit()
        report = base.run_provider(connection, "MANUAL", manual_loader)
        base.export_catalog(connection, [report])

    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
