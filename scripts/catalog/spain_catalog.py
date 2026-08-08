#!/usr/bin/env python3
"""Fuentes autonomicas espanolas de camaras no relacionadas con el trafico.

Espana salia desproporcionadamente sesgada hacia carretera: 2.582 camaras de
trafico frente a 1.010 de todo lo demas. No es un fallo del pipeline sino una
asimetria de los datos, porque Windy publica bastantes menos camaras en Espana
(1.070 activas) que en Italia (2.875) o Austria (2.750). La via para equilibrarlo es
incorporar fuentes autonomicas propias.

MeteoGalicia publica un JSON documentado con sus camaras panoramicas:
https://www.meteogalicia.gal/datosred/infoweb/meteo/docs/rss/JSON_camaras_es.pdf
"""
from __future__ import annotations

import json
import sys
import urllib.request
from contextlib import closing
from typing import Any, Iterable

import build_catalog as base

METEOGALICIA_URL = "https://servizos.meteogalicia.gal/mgrss/observacion/jsonCamaras.action"
HEADERS = {
    "User-Agent": "CamsCatalogBot/4.3 (+https://github.com/AlejandroPico/Cams)",
    "Accept": "application/json,*/*",
}


def pedir(url: str, timeout: int = 45) -> Any:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8-sig"))


def meteogalicia_loader() -> Iterable[dict[str, Any]]:
    payload = pedir(METEOGALICIA_URL)
    camaras = payload.get("listaCamaras") if isinstance(payload, dict) else None
    if not isinstance(camaras, list):
        raise RuntimeError(f"MeteoGalicia no devolvio listaCamaras: {str(payload)[:200]}")

    descartadas = 0
    for camara in camaras:
        if not isinstance(camara, dict):
            continue
        try:
            lat = float(camara["lat"])
            lon = float(camara["lon"])
        except (KeyError, TypeError, ValueError):
            descartadas += 1
            continue

        imagen = base.text(camara.get("imaxeCamara"))
        identificador = base.text(camara.get("identificador"))
        if not imagen or not identificador:
            descartadas += 1
            continue

        # Galicia cabe holgadamente aqui. Sirve de comprobacion frente a coordenadas
        # corruptas, en lugar de publicar puntos absurdos.
        if not (41.5 <= lat <= 44.0 and -9.5 <= lon <= -6.5):
            descartadas += 1
            continue

        concello = base.text(camara.get("concello"))
        provincia = base.text(camara.get("provincia"))

        yield {
            "external_id": identificador,
            "title": base.text(camara.get("nomeCamara"), f"Camara MeteoGalicia {identificador}"),
            "country_code": "ES",
            "country_name": "España",
            "region": "Galicia",
            "province": provincia or None,
            "city": concello or None,
            "latitude": lat,
            "longitude": lon,
            "timezone": "Europe/Madrid",
            "category": "landscape",
            "media_type": "snapshot",
            "snapshot_url": imagen,
            "thumbnail_url": base.text(camara.get("imaxeCamaraMini")) or None,
            "source_page_url": "https://www.meteogalicia.gal/web/observacion/camaras",
            "refresh_seconds": 600,
            "status": "online",
            "last_seen_at": base.text(camara.get("dataUltimaAct")) or None,
            "attribution": "MeteoGalicia, Xunta de Galicia",
            "license_name": "Datos abertos da Xunta de Galicia",
            "license_url": "https://abertos.xunta.gal/aviso-legal",
            "privacy_level": "public-landscape",
            "priority": 5,
            "source_payload": camara,
        }

    print(f"MeteoGalicia: {len(camaras)} leidas, {descartadas} descartadas", file=sys.stderr)


PROVEEDORES = [
    (
        {
            "code": "METEOGALICIA_ES",
            "name": "MeteoGalicia",
            "homepage_url": "https://www.meteogalicia.gal/web/observacion/camaras",
            "api_url": METEOGALICIA_URL,
            "country_code": "ES",
            "attribution": "MeteoGalicia, Xunta de Galicia",
            "license_name": "Datos abertos da Xunta de Galicia",
            "refresh_seconds": 600,
            "enabled": 1,
            "notes": "Camaras panoramicas de Galicia. JSON documentado y abierto, sin clave.",
        },
        meteogalicia_loader,
    ),
]


def main() -> int:
    reports = []
    with closing(base.ensure_database()) as connection:
        for provider, loader in PROVEEDORES:
            columnas = list(provider)
            updates = ",".join(f"{c}=excluded.{c}" for c in columnas if c != "code")
            connection.execute(
                f"INSERT INTO providers ({','.join(columnas)}) VALUES ({','.join(f':{c}' for c in columnas)}) "
                f"ON CONFLICT(code) DO UPDATE SET {updates}", provider,
            )
            connection.commit()
            reports.append(base.run_provider(connection, provider["code"], loader))
        base.export_catalog(connection, reports)

    for report in reports:
        print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
