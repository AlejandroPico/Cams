#!/usr/bin/env python3
"""Importador aislado de cámaras meteorológicas de Fintraffic.

Digitraffic valida estrictamente las cabeceras de cliente. Este adaptador usa un Accept
simple y la cabecera Digitraffic-User con aplicación, versión y contacto.
"""
from __future__ import annotations

import json
import sys
import urllib.request
from contextlib import closing
from typing import Any, Iterable

import build_catalog as base
import extend_catalog as extra

STATIONS_URL = "https://tie.digitraffic.fi/api/weathercam/v1/stations"
IMAGE_URL = "https://weathercam.digitraffic.fi/{preset_id}.jpg"
CLIENT_ID = "Cams/4.1 alejandro.picoperez@gmail.com"


def fetch_stations(timeout: int = 35) -> dict[str, Any]:
    request = urllib.request.Request(
        STATIONS_URL,
        headers={
            "User-Agent": CLIENT_ID,
            "Digitraffic-User": CLIENT_ID,
            "Accept": "application/json"
        }
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8-sig"))


def loader(timeout: int = 35) -> Iterable[dict[str, Any]]:
    payload = fetch_stations(timeout)
    for feature in payload.get("features", []):
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        properties = feature.get("properties") or {}
        if len(coordinates) < 2:
            continue
        longitude, latitude = float(coordinates[0]), float(coordinates[1])
        station_id = str(feature.get("id") or properties.get("id") or "")
        station_name = base.text(properties.get("name"), station_id or "Fintraffic camera")
        for preset in properties.get("presets") or []:
            preset_id = str(preset.get("id") or "")
            if not preset_id:
                continue
            presentation = base.text(preset.get("presentationName"), preset_id)
            yield {
                "external_id": preset_id,
                "title": f"{station_name} · {presentation}",
                "description": "Cámara meteorológica de carretera de Fintraffic.",
                "country_code": "FI",
                "country_name": "Finlandia",
                "region": base.text(properties.get("province")) or None,
                "city": station_name,
                "latitude": latitude,
                "longitude": longitude,
                "timezone": "Europe/Helsinki",
                "category": "weather-road",
                "media_type": "snapshot",
                "snapshot_url": IMAGE_URL.format(preset_id=preset_id),
                "source_page_url": "https://www.digitraffic.fi/tieliikenne/",
                "refresh_seconds": 600,
                "status": "online",
                "attribution": "Fintraffic / Digitraffic",
                "license_name": "Digitraffic open data terms",
                "privacy_level": "public-traffic",
                "source_payload": preset
            }


def main() -> int:
    with closing(base.ensure_database()) as connection:
        extra.register_providers(connection)
        report = base.run_provider(connection, "FINTRAFFIC_FI", loader)
        base.export_catalog(connection, [report])
        count = connection.execute(
            "SELECT COUNT(*) FROM camera_catalog WHERE active=1 AND provider_code='FINTRAFFIC_FI'"
        ).fetchone()[0]
    print(f"Fintraffic cameras stored: {count}")
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report.get("status") == "ok" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Fintraffic stage failed: {error}", file=sys.stderr)
        raise
