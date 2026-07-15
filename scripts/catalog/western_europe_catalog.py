#!/usr/bin/env python3
"""Importa fuentes públicas verificables de Europa occidental.

Fuentes actuales:
- National Highways / Traffic England: inventario geolocalizado de Inglaterra.
- All the Places: respaldo CC0 del inventario Traffic England, manteniendo las
  imágenes y páginas oficiales de National Highways.
- Bruxelles Mobilité: inventario regional de cámaras, con compatibilidad para el
  endpoint histórico mientras siga publicando GeoJSON utilizable.

Cada proveedor se ejecuta de forma independiente. No se publican puntos sin
coordenadas reales ni se copian catálogos comerciales.
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import urllib.parse
import urllib.request
from contextlib import closing
from typing import Any, Iterable

import build_catalog as base

USER_AGENT = "CamsCatalogBot/4.5 (+https://github.com/AlejandroPico/Cams)"
ENGLAND_ENDPOINT = "https://www.trafficengland.com/api/cctv/getToBounds?bbox=-7.0,49.0,5.0,56.0"
ENGLAND_ATP_ENDPOINT = "https://data.alltheplaces.xyz/runs/latest/output/traffic_england_gb.geojson"
ENGLAND_IMAGE_BASE = "https://public.highwaystrafficcameras.co.uk/cctvpublicaccess/images/"
BRUSSELS_ENDPOINTS = (
    "https://www.bruxellesmobilite.irisnet.be/cameras/json/fr/",
    "http://www.bruxellesmobilite.irisnet.be/cameras/json/fr/",
)

PROVIDERS = [
    {
        "code": "NATIONAL_HIGHWAYS_GB",
        "name": "National Highways Traffic England",
        "homepage_url": "https://www.trafficengland.com/",
        "api_url": ENGLAND_ENDPOINT,
        "country_code": "GB",
        "attribution": "National Highways; location metadata via All the Places when required",
        "license_name": "CC0 metadata / official image terms",
        "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
        "refresh_seconds": 60,
        "notes": "Cámaras de autopistas y carreteras principales de Inglaterra.",
    },
    {
        "code": "BRUSSELS_MOBILITY_BE",
        "name": "Bruxelles Mobilité traffic cameras",
        "homepage_url": "https://mobilite-mobiliteit.brussels/",
        "api_url": BRUSSELS_ENDPOINTS[0],
        "country_code": "BE",
        "attribution": "Bruxelles Mobilité / Brussel Mobiliteit",
        "license_name": "Official public traffic information terms",
        "refresh_seconds": 60,
        "notes": "Inventario regional de cámaras de tráfico de Bruselas.",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=int, default=40)
    return parser.parse_args()


def request_bytes(url: str, timeout: int, referer: str | None = None) -> bytes:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json,application/geo+json,text/plain,*/*",
    }
    if referer:
        headers["Referer"] = referer
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def decode_geojson(raw: bytes) -> Any:
    text = raw.decode("utf-8-sig", errors="replace").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        features: list[dict[str, Any]] = []
        for line in text.splitlines():
            line = line.strip().rstrip(",")
            if not line:
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(item, dict):
                features.append(item)
        if features:
            return {"type": "FeatureCollection", "features": features}
        raise


def request_json(url: str, timeout: int, referer: str | None = None) -> Any:
    return decode_geojson(request_bytes(url, timeout, referer))


def register_providers(connection: sqlite3.Connection) -> None:
    for provider in PROVIDERS:
        columns = list(provider)
        placeholders = ",".join(f":{column}" for column in columns)
        updates = ",".join(f"{column}=excluded.{column}" for column in columns if column != "code")
        connection.execute(
            f"INSERT INTO providers ({','.join(columns)}) VALUES ({placeholders}) "
            f"ON CONFLICT(code) DO UPDATE SET {updates}",
            provider,
        )
    connection.commit()


def number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def features_from(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        for key in ("features", "data", "cameras", "results", "items"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        if any(key in payload for key in ("geometry", "latitude", "lat")):
            return [payload]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def coordinates(feature: dict[str, Any], properties: dict[str, Any]) -> tuple[float, float] | None:
    geometry = feature.get("geometry")
    if isinstance(geometry, dict):
        values = geometry.get("coordinates")
        if isinstance(values, (list, tuple)) and len(values) >= 2:
            longitude, latitude = number(values[0]), number(values[1])
            if longitude is not None and latitude is not None:
                return longitude, latitude
    latitude = number(
        properties.get("latitude")
        or properties.get("lat")
        or feature.get("latitude")
        or feature.get("lat")
    )
    longitude = number(
        properties.get("longitude")
        or properties.get("lon")
        or properties.get("lng")
        or feature.get("longitude")
        or feature.get("lon")
        or feature.get("lng")
    )
    if latitude is None or longitude is None:
        return None
    return longitude, latitude


def england_payload(timeout: int) -> tuple[Any, str]:
    errors: list[str] = []
    for endpoint, referer in (
        (ENGLAND_ENDPOINT, "https://www.trafficengland.com/"),
        (ENGLAND_ATP_ENDPOINT, "https://www.alltheplaces.xyz/"),
    ):
        try:
            payload = request_json(endpoint, timeout, referer)
            if features_from(payload):
                return payload, endpoint
            errors.append(f"{endpoint}: colección vacía")
        except Exception as error:
            errors.append(f"{endpoint}: {error}")
    raise RuntimeError("; ".join(errors))


def national_highways_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload, inventory_endpoint = england_payload(timeout)
    seen: set[str] = set()
    for feature in features_from(payload):
        properties = feature.get("properties") if isinstance(feature.get("properties"), dict) else feature
        pair = coordinates(feature, properties)
        if not pair:
            continue
        longitude, latitude = pair
        if not (49 <= latitude <= 56.5 and -7.5 <= longitude <= 3.0):
            continue
        website = base.text(
            properties.get("website")
            or properties.get("url")
            or properties.get("link")
            or feature.get("website")
            or feature.get("url")
        )
        page_match = re.search(r"/(\d+)\.html(?:[?#].*)?$", website)
        page_id = page_match.group(1) if page_match else base.text(
            properties.get("id") or properties.get("cameraId") or feature.get("id")
        )
        snapshot = base.text(
            properties.get("image")
            or properties.get("image_url")
            or properties.get("snapshot")
        )
        if not page_id and snapshot:
            image_match = re.search(r"/([^/]+)\.jpg(?:[?#].*)?$", snapshot, re.I)
            page_id = image_match.group(1) if image_match else ""
        if not page_id or page_id in seen:
            continue
        if not snapshot and re.fullmatch(r"\d+", page_id):
            snapshot = f"{ENGLAND_IMAGE_BASE}{page_id}.jpg"
        if not snapshot:
            continue
        seen.add(page_id)
        title = base.text(
            properties.get("description")
            or properties.get("name")
            or properties.get("title"),
            f"National Highways camera {page_id}",
        )
        road = base.text(properties.get("road") or properties.get("route"))
        yield {
            "external_id": page_id,
            "title": title,
            "description": road or None,
            "country_code": "GB",
            "country_name": "Reino Unido",
            "region": "Inglaterra",
            "city": base.text(properties.get("town") or properties.get("city")) or None,
            "locality": road or title,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "Europe/London",
            "category": "traffic",
            "media_type": "snapshot",
            "snapshot_url": snapshot,
            "source_page_url": website or "https://www.trafficengland.com/",
            "refresh_seconds": 60,
            "status": "online",
            "attribution": "National Highways",
            "license_name": (
                "CC0 location metadata / official National Highways image terms"
                if inventory_endpoint == ENGLAND_ATP_ENDPOINT
                else "Official public traffic information terms"
            ),
            "license_url": (
                "https://creativecommons.org/publicdomain/zero/1.0/"
                if inventory_endpoint == ENGLAND_ATP_ENDPOINT
                else None
            ),
            "privacy_level": "public-traffic",
            "source_payload": feature,
        }


def brussels_payload(timeout: int) -> tuple[Any, str]:
    errors: list[str] = []
    for endpoint in BRUSSELS_ENDPOINTS:
        try:
            return request_json(endpoint, timeout, "https://mobilite-mobiliteit.brussels/"), endpoint
        except Exception as error:
            errors.append(f"{endpoint}: {error}")
    raise RuntimeError("; ".join(errors))


def brussels_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload, endpoint = brussels_payload(timeout)
    seen: set[str] = set()
    for index, feature in enumerate(features_from(payload)):
        properties = feature.get("properties") if isinstance(feature.get("properties"), dict) else feature
        pair = coordinates(feature, properties)
        if not pair:
            continue
        longitude, latitude = pair
        if not (50.75 <= latitude <= 50.95 and 4.20 <= longitude <= 4.55):
            continue
        source_path = base.text(
            properties.get("src")
            or properties.get("image")
            or properties.get("imageUrl")
            or properties.get("url")
        )
        if not source_path:
            continue
        snapshot = urllib.parse.urljoin(endpoint, source_path)
        if snapshot.startswith("http://"):
            snapshot = "https://" + snapshot[len("http://"):]
        identifier = base.text(
            feature.get("id") or properties.get("id") or properties.get("camera_id"),
            f"{latitude:.6f}:{longitude:.6f}:{index}",
        )
        if identifier in seen:
            continue
        seen.add(identifier)
        title = base.text(
            properties.get("name")
            or properties.get("title")
            or properties.get("description")
            or properties.get("nom"),
            f"Brussels traffic camera {identifier}",
        )
        yield {
            "external_id": identifier,
            "title": title,
            "country_code": "BE",
            "country_name": "Bélgica",
            "region": "Bruselas-Capital",
            "city": "Bruselas",
            "locality": title,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "Europe/Brussels",
            "category": "traffic",
            "media_type": "snapshot",
            "snapshot_url": snapshot,
            "source_page_url": "https://mobilite-mobiliteit.brussels/",
            "refresh_seconds": 60,
            "status": "online",
            "attribution": "Bruxelles Mobilité / Brussel Mobiliteit",
            "license_name": "Official public traffic information terms",
            "privacy_level": "public-traffic",
            "source_payload": feature,
        }


def main() -> int:
    args = parse_args()
    with closing(base.ensure_database()) as connection:
        register_providers(connection)
        reports = [
            base.run_provider(
                connection,
                "NATIONAL_HIGHWAYS_GB",
                lambda: national_highways_loader(args.timeout),
            ),
            base.run_provider(
                connection,
                "BRUSSELS_MOBILITY_BE",
                lambda: brussels_loader(args.timeout),
            ),
        ]
        base.export_catalog(connection, reports)
        count = connection.execute(
            "SELECT COUNT(*) FROM cameras WHERE active=1 AND is_public=1"
        ).fetchone()[0]
    print(f"Western Europe Cams catalog ready: {count} public records")
    for report in reports:
        print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
