#!/usr/bin/env python3
"""Amplía Norteamérica con redes públicas sin credenciales.

- Washington State Department of Transportation.
- Alberta 511.
- City of Toronto Open Data traffic cameras.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import urllib.request
from contextlib import closing
from typing import Any, Iterable

import build_catalog as base

USER_AGENT = "CamsCatalogBot/4.3 (+https://github.com/AlejandroPico/Cams)"
WSDOT_URL = "https://data.wsdot.wa.gov/log/public/cameras.json"
ALBERTA_URL = "https://511.alberta.ca/api/v2/get/cameras?format=json"
TORONTO_URL = (
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/"
    "a3309088-5fd4-4d34-8297-77c8301840ac/resource/"
    "4a568300-c7f8-496d-b150-dff6f5dc6d4f/download/traffic-camera-list-4326.geojson"
)

PROVIDERS = [
    {
        "code": "WSDOT_US",
        "name": "Washington State DOT Cameras",
        "homepage_url": "https://wsdot.com/Travel/Real-time/Map/",
        "api_url": WSDOT_URL,
        "country_code": "US",
        "attribution": "Washington State Department of Transportation",
        "license_name": "Washington State public data terms",
        "refresh_seconds": 300,
        "notes": "Cámaras públicas de carreteras del estado de Washington.",
    },
    {
        "code": "ALBERTA511_CA",
        "name": "Alberta 511 Cameras",
        "homepage_url": "https://511.alberta.ca/",
        "api_url": ALBERTA_URL,
        "country_code": "CA",
        "attribution": "Alberta 511 / Government of Alberta",
        "license_name": "Alberta public traveller information terms",
        "refresh_seconds": 300,
        "notes": "Snapshots públicos de carreteras de Alberta.",
    },
    {
        "code": "TORONTO_CA",
        "name": "City of Toronto Traffic Cameras",
        "homepage_url": "https://open.toronto.ca/",
        "api_url": TORONTO_URL,
        "country_code": "CA",
        "attribution": "City of Toronto Open Data",
        "license_name": "Open Government Licence - Toronto",
        "refresh_seconds": 120,
        "notes": "Cámaras municipales de tráfico con coordenadas GeoJSON.",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=int, default=35)
    return parser.parse_args()


def request_json(url: str, timeout: int) -> Any:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json,application/geo+json,*/*"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8-sig"))


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


def scalar(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def nested(value: Any, *keys: str) -> Any:
    current = value
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def wsdot_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload = request_json(WSDOT_URL, timeout)
    if isinstance(payload, list):
        cameras = payload
    elif isinstance(payload, dict):
        cameras = payload.get("Cameras") or payload.get("cameras") or payload.get("data") or []
    else:
        cameras = []

    for camera in cameras if isinstance(cameras, list) else []:
        if not isinstance(camera, dict):
            continue
        location = camera.get("CameraLocation") or camera.get("cameraLocation") or {}
        latitude = scalar(location.get("Latitude") if isinstance(location, dict) else None)
        longitude = scalar(location.get("Longitude") if isinstance(location, dict) else None)
        if latitude is None:
            latitude = scalar(camera.get("Latitude") or camera.get("latitude"))
        if longitude is None:
            longitude = scalar(camera.get("Longitude") or camera.get("longitude"))
        snapshot = base.text(camera.get("ImageURL") or camera.get("ImageUrl") or camera.get("imageUrl"))
        identifier = base.text(camera.get("CameraID") or camera.get("CameraId") or camera.get("id"))
        if latitude is None or longitude is None or not snapshot or not identifier:
            continue
        route = base.text(camera.get("RoadName") or camera.get("Route") or camera.get("roadName"))
        title = base.text(camera.get("Title") or camera.get("Description"), f"WSDOT camera {identifier}")
        yield {
            "external_id": identifier,
            "title": title,
            "description": route or None,
            "country_code": "US",
            "country_name": "Estados Unidos",
            "region": "Washington",
            "locality": route or None,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "America/Los_Angeles",
            "category": "traffic",
            "media_type": "snapshot",
            "snapshot_url": snapshot,
            "source_page_url": "https://wsdot.com/Travel/Real-time/Map/",
            "refresh_seconds": 300,
            "status": "online",
            "attribution": "Washington State Department of Transportation",
            "license_name": "Washington State public data terms",
            "privacy_level": "public-traffic",
            "source_payload": camera,
        }


def first_enabled_view(camera: dict[str, Any]) -> dict[str, Any] | None:
    views = camera.get("Views") or camera.get("views") or []
    if not isinstance(views, list):
        return None
    enabled = next(
        (
            view for view in views
            if isinstance(view, dict) and str(view.get("Status") or view.get("status") or "").lower() == "enabled"
        ),
        None,
    )
    return enabled or next((view for view in views if isinstance(view, dict)), None)


def alberta_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload = request_json(ALBERTA_URL, timeout)
    for camera in payload if isinstance(payload, list) else []:
        if not isinstance(camera, dict):
            continue
        latitude = scalar(camera.get("Latitude") or camera.get("latitude"))
        longitude = scalar(camera.get("Longitude") or camera.get("longitude"))
        view = first_enabled_view(camera)
        snapshot = base.text((view or {}).get("Url") or (view or {}).get("url"))
        identifier = base.text(camera.get("Id") or camera.get("ID") or camera.get("id"))
        if latitude is None or longitude is None or not snapshot or not identifier:
            continue
        roadway = base.text(camera.get("Roadway") or camera.get("roadway"))
        location = base.text(camera.get("Location") or camera.get("location"))
        direction = base.text(camera.get("Direction") or camera.get("direction"))
        yield {
            "external_id": identifier,
            "title": base.text(camera.get("Name") or camera.get("name"), location or f"Alberta camera {identifier}"),
            "description": " · ".join(filter(None, (roadway, location, direction))) or None,
            "country_code": "CA",
            "country_name": "Canadá",
            "region": "Alberta",
            "city": location or None,
            "locality": roadway or None,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "America/Edmonton",
            "category": "weather-road",
            "media_type": "snapshot",
            "snapshot_url": snapshot,
            "source_page_url": "https://511.alberta.ca/",
            "refresh_seconds": 300,
            "status": "online",
            "view_direction": direction or None,
            "attribution": "Alberta 511 / Government of Alberta",
            "license_name": "Alberta public traveller information terms",
            "privacy_level": "public-traffic",
            "source_payload": camera,
        }


def toronto_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload = request_json(TORONTO_URL, timeout)
    features = payload.get("features", []) if isinstance(payload, dict) else []
    for feature in features if isinstance(features, list) else []:
        if not isinstance(feature, dict):
            continue
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
        while isinstance(coordinates, list) and coordinates and isinstance(coordinates[0], list):
            coordinates = coordinates[0]
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            continue
        longitude, latitude = scalar(coordinates[0]), scalar(coordinates[1])
        properties = feature.get("properties") or {}
        if longitude is None or latitude is None or not isinstance(properties, dict):
            continue
        snapshot = base.text(
            properties.get("IMAGEURL") or properties.get("ImageUrl") or properties.get("imageUrl")
        )
        identifier = base.text(
            properties.get("REC_ID") or properties.get("ID") or properties.get("CAMERA_ID")
        )
        if not snapshot or not identifier:
            continue
        main_road = base.text(properties.get("MAINROAD") or properties.get("MAIN_ROAD"))
        cross_road = base.text(properties.get("CROSSROAD") or properties.get("CROSS_ROAD"))
        title = " / ".join(filter(None, (main_road, cross_road))) or f"Toronto camera {identifier}"
        yield {
            "external_id": identifier,
            "title": title,
            "country_code": "CA",
            "country_name": "Canadá",
            "region": "Ontario",
            "city": "Toronto",
            "locality": main_road or None,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "America/Toronto",
            "category": "traffic",
            "media_type": "snapshot",
            "snapshot_url": snapshot,
            "source_page_url": "https://open.toronto.ca/",
            "refresh_seconds": 120,
            "status": "online",
            "attribution": "City of Toronto Open Data",
            "license_name": "Open Government Licence - Toronto",
            "privacy_level": "public-traffic",
            "source_payload": feature,
        }


def main() -> int:
    args = parse_args()
    with closing(base.ensure_database()) as connection:
        register_providers(connection)
        reports = [
            base.run_provider(connection, "WSDOT_US", lambda: wsdot_loader(args.timeout)),
            base.run_provider(connection, "ALBERTA511_CA", lambda: alberta_loader(args.timeout)),
            base.run_provider(connection, "TORONTO_CA", lambda: toronto_loader(args.timeout)),
        ]
        base.export_catalog(connection, reports)
        count = connection.execute(
            "SELECT COUNT(*) FROM cameras WHERE active=1 AND is_public=1"
        ).fetchone()[0]
    print(f"North America Cams catalog ready: {count} public records")
    for report in reports:
        print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
