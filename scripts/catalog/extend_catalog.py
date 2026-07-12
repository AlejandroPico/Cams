#!/usr/bin/env python3
"""Amplía Cams con proveedores públicos europeos y españoles.

Este módulo se ejecuta después del importador base. Cada red se registra y procesa de
forma independiente para que una fuente temporalmente caída no bloquee el catálogo.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from typing import Any, Iterable

import build_catalog as base

ROOT = Path(__file__).resolve().parents[2]
USER_AGENT = "CamsCatalogBot/4.1 (+https://github.com/AlejandroPico/Cams)"

DGT_URL = "https://nap.dgt.es/datex2/v3/dgt/DevicePublication/camaras_datex2_v37.xml"
DGT_IMAGE = "https://infocar.dgt.es/etraffic/data/camaras/{camera_id}.jpg"
DIGITRAFFIC_URL = "https://tie.digitraffic.fi/api/weathercam/v1/stations"
DIGITRAFFIC_IMAGE = "https://weathercam.digitraffic.fi/{preset_id}.jpg"
MADRID_KML_URL = "https://datos.madrid.es/egob/catalogo/202088-0-trafico-camaras.kml"
MADRID_M30_URL = "https://datos.madrid.es/egob/catalogo/212166-7899870-trafico-calle30-camaras.xml"

EXTRA_PROVIDERS = [
    {
        "code": "DGT_ES",
        "name": "DGT National Traffic Cameras",
        "homepage_url": "https://nap.dgt.es/",
        "api_url": DGT_URL,
        "country_code": "ES",
        "attribution": "Dirección General de Tráfico",
        "license_name": "Creative Commons Attribution",
        "refresh_seconds": 180,
        "notes": "Cámaras DATEX II de la red estatal española fuera de Cataluña y País Vasco."
    },
    {
        "code": "MADRID_CITY",
        "name": "Ayuntamiento de Madrid Traffic Cameras",
        "homepage_url": "https://datos.madrid.es/",
        "api_url": MADRID_KML_URL,
        "country_code": "ES",
        "attribution": "Ayuntamiento de Madrid",
        "license_name": "Creative Commons Attribution",
        "refresh_seconds": 600,
        "notes": "Cámaras urbanas de tráfico publicadas en KML."
    },
    {
        "code": "MADRID_M30",
        "name": "Madrid Calle 30 Cameras",
        "homepage_url": "https://datos.madrid.es/",
        "api_url": MADRID_M30_URL,
        "country_code": "ES",
        "attribution": "Ayuntamiento de Madrid",
        "license_name": "Creative Commons Attribution",
        "refresh_seconds": 300,
        "notes": "Cámaras públicas de la M-30."
    },
    {
        "code": "BARCELONA_CITY",
        "name": "Barcelona Municipal Traffic Cameras",
        "homepage_url": "https://www.barcelona.cat/mobilitat/",
        "api_url": "https://www.bcn.cat/transit/ca/cameres_pagina_1.html",
        "country_code": "ES",
        "attribution": "Ajuntament de Barcelona",
        "license_name": "Public municipal display",
        "refresh_seconds": 300,
        "notes": "Veintisiete ubicaciones históricas de la red municipal de tráfico."
    },
    {
        "code": "FINTRAFFIC_FI",
        "name": "Fintraffic Digitraffic Weather Cameras",
        "homepage_url": "https://www.digitraffic.fi/",
        "api_url": DIGITRAFFIC_URL,
        "country_code": "FI",
        "attribution": "Fintraffic / Digitraffic",
        "license_name": "Digitraffic open data terms",
        "refresh_seconds": 600,
        "notes": "Cámaras meteorológicas públicas de la red viaria finlandesa."
    }
]

BARCELONA_CAMERAS = [
    (1, "Plaça Catalunya", 41.38702, 2.17005, "Pça. Catalunya - Pelai"),
    (2, "Plaça Urquinaona", 41.38948, 2.17426, "Via Laietana, sentit mar"),
    (3, "Aragó - Passeig de Gràcia", 41.39305, 2.16504, "Aragó, sentit Llobregat"),
    (4, "Diagonal - Maria Cristina", 41.38817, 2.12665, "Diagonal, sentit Llobregat"),
    (5, "Balmes - Mitre", 41.40522, 2.13959, "Mitre, sentit Besòs"),
    (6, "Meridiana - Rio de Janeiro", 41.43804, 2.18042, "Meridiana, sentit Glòries"),
    (7, "Plaça Molina", 41.40112, 2.14744, "Balmes, sentit mar"),
    (8, "Balmes - Gran Via", 41.38953, 2.16410, "Balmes, sentit muntanya"),
    (9, "Gran Via - Marina", 41.40015, 2.18139, "Gran Via, sentit Besòs"),
    (10, "Gran Via - Bac de Roda", 41.41310, 2.19866, "Gran Via, sentit Glòries"),
    (11, "Marina - Pujades", 41.39507, 2.18839, "Marina, sentit mar"),
    (12, "Diagonal - Ciutat de Granada", 41.40274, 2.19307, "Diagonal, sentit Besòs"),
    (13, "Túnel de la Rovira", 41.42269, 2.15766, "Boca nord"),
    (14, "Plaça dels Països Catalans", 41.37916, 2.14046, "Tarragona, sentit mar"),
    (15, "Plaça Espanya", 41.37516, 2.14992, "Paral·lel"),
    (16, "Plaça Cerdà", 41.36510, 2.13589, "Sentit Plaça Espanya"),
    (17, "Meridiana - Felip II", 41.42246, 2.18604, "Meridiana, sentit Besòs"),
    (18, "Plaça Antonio López", 41.38183, 2.18149, "Portal de la Pau"),
    (19, "Plaça Pau Vila", 41.38122, 2.18702, "Ronda Litoral, sentit Besòs"),
    (20, "Ronda de Dalt - Ctra. d'Esplugues", 41.38808, 2.10447, "Ronda de Dalt"),
    (21, "Ronda de Dalt - Meridiana", 41.44923, 2.18507, "Ronda de Dalt"),
    (22, "Ronda de Dalt - Sant Gervasi", 41.41562, 2.13266, "Ronda de Dalt"),
    (23, "Ronda de Dalt - Velòdrom", 41.43841, 2.14717, "Ronda de Dalt"),
    (24, "Ronda Litoral - Badajoz", 41.38903, 2.19989, "Ronda Litoral"),
    (25, "Ronda Litoral - Bon Pastor", 41.44131, 2.20114, "Ronda Litoral"),
    (26, "Ronda Litoral - Moll de la Fusta", 41.37965, 2.18506, "Ronda Litoral"),
    (27, "Ronda Litoral - Zona Franca", 41.35018, 2.14326, "Ronda Litoral")
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=int, default=35)
    return parser.parse_args()


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def fetch_bytes(url: str, timeout: int, headers: dict[str, str] | None = None) -> bytes:
    request_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json,application/xml,text/xml,text/html,*/*"
    }
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, headers=request_headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def fetch_json(url: str, timeout: int, headers: dict[str, str] | None = None) -> Any:
    return json.loads(fetch_bytes(url, timeout, headers).decode("utf-8-sig"))


def find_text(element: ET.Element, names: set[str]) -> str | None:
    for child in element.iter():
        if local_name(child.tag) in names and child.text and child.text.strip():
            return child.text.strip()
    return None


def find_float(element: ET.Element, names: set[str]) -> float | None:
    value = find_text(element, names)
    if value is None:
        return None
    try:
        return float(value.replace(",", "."))
    except ValueError:
        return None


def register_providers(connection: sqlite3.Connection) -> None:
    for provider in EXTRA_PROVIDERS:
        columns = list(provider)
        placeholders = ",".join(f":{column}" for column in columns)
        updates = ",".join(f"{column}=excluded.{column}" for column in columns if column != "code")
        connection.execute(
            f"INSERT INTO providers ({','.join(columns)}) VALUES ({placeholders}) "
            f"ON CONFLICT(code) DO UPDATE SET {updates}", provider
        )
    connection.commit()


def dgt_loader(timeout: int) -> Iterable[dict[str, Any]]:
    root = ET.fromstring(fetch_bytes(DGT_URL, max(timeout, 60)))
    for device in root.iter():
        if local_name(device.tag) != "device":
            continue
        device_type = (find_text(device, {"typeofdevice", "devicetype"}) or "camera").lower()
        if "camera" not in device_type and "cámara" not in device_type:
            continue
        latitude = find_float(device, {"latitude"})
        longitude = find_float(device, {"longitude"})
        if latitude is None or longitude is None:
            continue
        device_url = find_text(device, {"deviceurl", "imageurl", "urllinkaddress"})
        external_id = (
            device.attrib.get("id")
            or device.attrib.get("identifier")
            or (Path(urllib.parse.urlparse(device_url or "").path).stem if device_url else "")
        )
        if not external_id:
            continue
        snapshot = device_url if device_url and device_url.lower().endswith((".jpg", ".jpeg", ".png")) else DGT_IMAGE.format(camera_id=external_id)
        road = find_text(device, {"roadname", "roadnumber", "roadidentifier"}) or "Red estatal"
        locality = find_text(device, {"locality", "municipality", "town"})
        yield {
            "external_id": external_id,
            "title": f"DGT · {road} · {external_id}",
            "description": "Cámara pública de información viaria de la DGT.",
            "country_code": "ES",
            "country_name": "España",
            "region": "Red estatal",
            "city": locality,
            "locality": road,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "Europe/Madrid",
            "category": "traffic",
            "media_type": "snapshot",
            "snapshot_url": snapshot,
            "source_page_url": "https://nap.dgt.es/",
            "refresh_seconds": 180,
            "status": "online",
            "attribution": "Dirección General de Tráfico",
            "license_name": "Creative Commons Attribution",
            "privacy_level": "public-traffic"
        }


def digitraffic_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload = fetch_json(
        DIGITRAFFIC_URL,
        timeout,
        {"Accept": "application/geo+json,application/json", "Digitraffic-User": "Cams/4.1"}
    )
    for feature in payload.get("features", []) if isinstance(payload, dict) else []:
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        properties = feature.get("properties") or {}
        if len(coordinates) < 2:
            continue
        longitude, latitude = float(coordinates[0]), float(coordinates[1])
        station_id = str(feature.get("id") or properties.get("id") or "")
        station_name = base.text(properties.get("name"), station_id or "Fintraffic camera")
        presets = properties.get("presets") or []
        for preset in presets:
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
                "snapshot_url": DIGITRAFFIC_IMAGE.format(preset_id=preset_id),
                "source_page_url": "https://www.digitraffic.fi/tieliikenne/",
                "refresh_seconds": 600,
                "status": "online",
                "attribution": "Fintraffic / Digitraffic",
                "license_name": "Digitraffic open data terms",
                "privacy_level": "public-traffic",
                "source_payload": preset
            }


def extract_image_url(text_value: str, base_url: str) -> str | None:
    decoded = html.unescape(text_value or "")
    patterns = [
        r"<img[^>]+src=[\"']([^\"']+)[\"']",
        r"https?://[^\s\"'<>]+\.(?:jpe?g|png|webp)(?:\?[^\s\"'<>]*)?"
    ]
    for pattern in patterns:
        match = re.search(pattern, decoded, re.IGNORECASE)
        if match:
            candidate = match.group(1) if match.lastindex else match.group(0)
            return urllib.parse.urljoin(base_url, candidate)
    return None


def madrid_kml_loader(timeout: int) -> Iterable[dict[str, Any]]:
    root = ET.fromstring(fetch_bytes(MADRID_KML_URL, timeout))
    for index, placemark in enumerate((item for item in root.iter() if local_name(item.tag) == "placemark"), start=1):
        coordinate_text = find_text(placemark, {"coordinates"})
        if not coordinate_text:
            continue
        first_coordinate = coordinate_text.strip().split()[0].split(",")
        if len(first_coordinate) < 2:
            continue
        try:
            longitude, latitude = float(first_coordinate[0]), float(first_coordinate[1])
        except ValueError:
            continue
        name = find_text(placemark, {"name", "nombre", "title"}) or f"Madrid camera {index}"
        description = find_text(placemark, {"description", "descripcion"}) or ""
        snapshot = extract_image_url(description, MADRID_KML_URL)
        yield {
            "external_id": str(index),
            "title": f"Madrid · {html.unescape(name)}",
            "description": html.unescape(re.sub(r"<[^>]+>", " ", description)).strip() or None,
            "country_code": "ES",
            "country_name": "España",
            "region": "Comunidad de Madrid",
            "city": "Madrid",
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "Europe/Madrid",
            "category": "traffic",
            "media_type": "snapshot" if snapshot else "link",
            "snapshot_url": snapshot,
            "source_page_url": "https://datos.madrid.es/",
            "refresh_seconds": 600,
            "status": "online" if snapshot else "unknown",
            "is_embeddable": bool(snapshot),
            "attribution": "Ayuntamiento de Madrid",
            "license_name": "Creative Commons Attribution",
            "privacy_level": "public-traffic"
        }


def madrid_m30_loader(timeout: int) -> Iterable[dict[str, Any]]:
    root = ET.fromstring(fetch_bytes(MADRID_M30_URL, timeout))
    candidates = [element for element in root.iter() if local_name(element.tag) in {"camara", "camera", "item", "elemento"}]
    for index, element in enumerate(candidates, start=1):
        latitude = find_float(element, {"latitud", "latitude", "lat"})
        longitude = find_float(element, {"longitud", "longitude", "lon", "lng"})
        if latitude is None or longitude is None:
            continue
        name = find_text(element, {"nombre", "name", "denominacion", "descripcion"}) or f"M-30 camera {index}"
        possible_url = find_text(element, {"url", "imagen", "image", "urlimagen"}) or ""
        snapshot = extract_image_url(possible_url, MADRID_M30_URL)
        external_id = find_text(element, {"id", "codigo", "identifier"}) or str(index)
        yield {
            "external_id": external_id,
            "title": f"Madrid Calle 30 · {html.unescape(name)}",
            "country_code": "ES",
            "country_name": "España",
            "region": "Comunidad de Madrid",
            "city": "Madrid",
            "locality": "M-30",
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "Europe/Madrid",
            "category": "traffic",
            "media_type": "snapshot" if snapshot else "link",
            "snapshot_url": snapshot,
            "source_page_url": "https://datos.madrid.es/",
            "refresh_seconds": 300,
            "status": "online" if snapshot else "unknown",
            "is_embeddable": bool(snapshot),
            "attribution": "Ayuntamiento de Madrid",
            "license_name": "Creative Commons Attribution",
            "privacy_level": "public-traffic"
        }


def barcelona_page(page: int, timeout: int) -> tuple[str | None, str]:
    candidates = [
        f"https://www.bcn.cat/transit/ca/cameres_pagina_{page}.html",
        f"http://www.bcn.cat/transit/ca/cameres_pagina_{page}.html",
        f"http://www.transit.bcn.es/transit/ca/cameres_pagina_{page}.html"
    ]
    for url in candidates:
        try:
            page_html = fetch_bytes(url, min(timeout, 10)).decode("utf-8", errors="replace")
            scoped = re.search(r"id=[\"']fotografia_camera[\"'][^>]*>(.*?)</", page_html, re.IGNORECASE | re.DOTALL)
            snapshot = extract_image_url(scoped.group(1) if scoped else page_html, url)
            if snapshot:
                return snapshot, url
        except (OSError, urllib.error.URLError, ValueError):
            continue
    return None, candidates[0]


def barcelona_loader(timeout: int) -> Iterable[dict[str, Any]]:
    with ThreadPoolExecutor(max_workers=6) as executor:
        resolved = list(executor.map(lambda camera: barcelona_page(camera[0], timeout), BARCELONA_CAMERAS))
    for camera, result in zip(BARCELONA_CAMERAS, resolved):
        page, title, latitude, longitude, direction = camera
        snapshot, source_page = result
        yield {
            "external_id": str(page),
            "title": f"Barcelona · {title}",
            "description": direction,
            "country_code": "ES",
            "country_name": "España",
            "region": "Cataluña",
            "province": "Barcelona",
            "city": "Barcelona",
            "locality": title,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "Europe/Madrid",
            "category": "traffic",
            "media_type": "snapshot" if snapshot else "link",
            "snapshot_url": snapshot,
            "source_page_url": source_page,
            "refresh_seconds": 300,
            "status": "online" if snapshot else "unknown",
            "status_reason": None if snapshot else "La página municipal no devolvió una imagen utilizable.",
            "is_embeddable": bool(snapshot),
            "attribution": "Ajuntament de Barcelona",
            "license_name": "Public municipal display",
            "privacy_level": "public-traffic"
        }


def main() -> int:
    args = parse_args()
    with closing(base.ensure_database()) as connection:
        register_providers(connection)
        reports = [
            base.run_provider(connection, "DGT_ES", lambda: dgt_loader(args.timeout)),
            base.run_provider(connection, "MADRID_CITY", lambda: madrid_kml_loader(args.timeout)),
            base.run_provider(connection, "MADRID_M30", lambda: madrid_m30_loader(args.timeout)),
            base.run_provider(connection, "BARCELONA_CITY", lambda: barcelona_loader(args.timeout)),
            base.run_provider(connection, "FINTRAFFIC_FI", lambda: digitraffic_loader(args.timeout))
        ]
        base.export_catalog(connection, reports)
        count = connection.execute("SELECT COUNT(*) FROM cameras WHERE active=1 AND is_public=1").fetchone()[0]
    print(f"Extended Cams catalog ready: {count} public records")
    for report in reports:
        print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Extra catalog stage failed: {error}", file=sys.stderr)
        raise
