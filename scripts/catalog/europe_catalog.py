#!/usr/bin/env python3
"""Importa redes europeas públicas que no requieren credenciales.

Fuentes:
- Transport Infrastructure Ireland (TII), API GraphQL del mapa de tráfico.
- Vegagerðin / umferdin.is, catálogo SSR de cámaras de Islandia.
- Rijkswaterstaat Verkeersinformatie, API pública de Países Bajos.

Solo se incorporan cámaras con coordenadas reales y una imagen publicada por la fuente.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sqlite3
import urllib.request
from contextlib import closing
from typing import Any, Iterable

import build_catalog as base

USER_AGENT = "CamsCatalogBot/4.3 (+https://github.com/AlejandroPico/Cams)"
TII_ENDPOINT = "https://traffic.tii.ie/api/graphql"
ICELAND_PAGE = "https://umferdin.is/en/cameras"
RWS_ENDPOINT = "https://api.rwsverkeersinfo.nl/api/cameras/"

PROVIDERS = [
    {
        "code": "TII_IE",
        "name": "Transport Infrastructure Ireland Cameras",
        "homepage_url": "https://traffic.tii.ie/",
        "api_url": TII_ENDPOINT,
        "country_code": "IE",
        "attribution": "Transport Infrastructure Ireland",
        "license_name": "Creative Commons Attribution 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "refresh_seconds": 300,
        "notes": "Cámaras de carreteras nacionales obtenidas del mapa público TII.",
    },
    {
        "code": "VEGAGERDIN_IS",
        "name": "Vegagerðin Iceland Road Cameras",
        "homepage_url": ICELAND_PAGE,
        "api_url": ICELAND_PAGE,
        "country_code": "IS",
        "attribution": "Icelandic Road and Coastal Administration / Vegagerðin",
        "license_name": "Official public traffic information terms",
        "refresh_seconds": 300,
        "notes": "Cámaras de carretera publicadas en umferdin.is.",
    },
    {
        "code": "RWS_NL",
        "name": "Rijkswaterstaat Traffic Cameras",
        "homepage_url": "https://rwsverkeersinfo.nl/",
        "api_url": RWS_ENDPOINT,
        "country_code": "NL",
        "attribution": "Rijkswaterstaat Verkeersinformatie",
        "license_name": "Official public traffic information terms",
        "refresh_seconds": 300,
        "notes": "Snapshots de autopistas neerlandesas publicados por la API RWS.",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=int, default=35)
    return parser.parse_args()


def request_bytes(
    url: str,
    timeout: int,
    *,
    method: str = "GET",
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
) -> bytes:
    request_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json,text/html,*/*",
    }
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, data=body, method=method, headers=request_headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def request_json(
    url: str,
    timeout: int,
    *,
    method: str = "GET",
    payload: Any | None = None,
    headers: dict[str, str] | None = None,
) -> Any:
    body = None
    request_headers = dict(headers or {})
    if payload is not None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    raw = request_bytes(url, timeout, method=method, body=body, headers=request_headers)
    return json.loads(raw.decode("utf-8-sig"))


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


def tii_loader(timeout: int) -> Iterable[dict[str, Any]]:
    query = {
        "query": (
            "query MapFeatures($input: MapFeaturesArgs!) { "
            "mapFeaturesQuery(input: $input) { mapFeatures { uri title __typename "
            "features { geometry } ... on Camera { active views(limit: 5) { "
            "category ... on CameraView { url } } } } } }"
        ),
        "variables": {
            "input": {
                "north": 55.5,
                "south": 51.3,
                "east": -5.9,
                "west": -10.7,
                "zoom": 18,
                "layerSlugs": ["normalCameras"],
            }
        },
    }
    payload = request_json(TII_ENDPOINT, timeout, method="POST", payload=query)
    features = (
        payload.get("data", {})
        .get("mapFeaturesQuery", {})
        .get("mapFeatures", [])
    )
    seen: set[str] = set()
    for feature in features if isinstance(features, list) else []:
        if not isinstance(feature, dict) or feature.get("__typename") != "Camera":
            continue
        if feature.get("active") is False:
            continue
        geometry_items = feature.get("features") or []
        geometry = geometry_items[0].get("geometry") if geometry_items and isinstance(geometry_items[0], dict) else None
        coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            continue
        longitude, latitude = scalar(coordinates[0]), scalar(coordinates[1])
        if longitude is None or latitude is None:
            continue
        views = feature.get("views") or []
        image = next(
            (str(view.get("url")) for view in views if isinstance(view, dict) and view.get("category") == "IMAGE" and view.get("url")),
            "",
        )
        if not image:
            continue
        identifier = base.text(feature.get("uri"), f"{latitude:.6f}:{longitude:.6f}")
        if identifier in seen:
            continue
        seen.add(identifier)
        yield {
            "external_id": identifier,
            "title": base.text(feature.get("title"), "TII road camera"),
            "country_code": "IE",
            "country_name": "Irlanda",
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "Europe/Dublin",
            "category": "traffic",
            "media_type": "snapshot",
            "snapshot_url": image,
            "source_page_url": "https://traffic.tii.ie/",
            "refresh_seconds": 300,
            "status": "online",
            "attribution": "Transport Infrastructure Ireland",
            "license_name": "Creative Commons Attribution 4.0",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "privacy_level": "public-traffic",
            "source_payload": feature,
        }


def find_camera_lists(value: Any, path: str = "root") -> list[tuple[str, list[dict[str, Any]]]]:
    matches: list[tuple[str, list[dict[str, Any]]]] = []
    if isinstance(value, dict):
        for key, nested in value.items():
            nested_path = f"{path}.{key}"
            if isinstance(nested, list) and nested and all(isinstance(item, dict) for item in nested):
                sample = nested[:20]
                if any(
                    isinstance(item.get("coordinates"), dict)
                    and (item.get("images") or item.get("image"))
                    for item in sample
                ):
                    matches.append((nested_path, nested))
            matches.extend(find_camera_lists(nested, nested_path))
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            matches.extend(find_camera_lists(nested, f"{path}[{index}]"))
    return matches


def iceland_loader(timeout: int) -> Iterable[dict[str, Any]]:
    page = request_bytes(
        ICELAND_PAGE,
        timeout,
        headers={"Accept": "text/html", "User-Agent": "Mozilla/5.0 CamsCatalogBot/4.3"},
    ).decode("utf-8", errors="replace")

    script_match = re.search(
        r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
        page,
        re.S | re.I,
    )
    if not script_match:
        raise RuntimeError("umferdin.is no publicó __NEXT_DATA__")
    payload = json.loads(html.unescape(script_match.group(1)))
    candidates = find_camera_lists(payload)
    if not candidates:
        raise RuntimeError("No se encontró la lista de cámaras en __NEXT_DATA__")

    cameras = max((items for _path, items in candidates), key=len)
    seen: set[str] = set()
    for camera in cameras:
        coordinates = camera.get("coordinates") or {}
        latitude = scalar(coordinates.get("lat") if isinstance(coordinates, dict) else None)
        longitude = scalar(coordinates.get("lon") if isinstance(coordinates, dict) else None)
        if longitude is None and isinstance(coordinates, dict):
            longitude = scalar(coordinates.get("lng"))
        images = camera.get("images") or []
        image = ""
        if isinstance(images, list) and images:
            first = images[0]
            image = base.text(first.get("url")) if isinstance(first, dict) else base.text(first)
        elif camera.get("image"):
            image_value = camera.get("image")
            image = base.text(image_value.get("url")) if isinstance(image_value, dict) else base.text(image_value)
        identifier = base.text(camera.get("id"))
        if latitude is None or longitude is None or not image or not identifier or identifier in seen:
            continue
        seen.add(identifier)
        road = base.text(camera.get("roadName") or camera.get("road"))
        yield {
            "external_id": identifier,
            "title": base.text(camera.get("name"), f"Vegagerðin camera {identifier}"),
            "description": road or None,
            "country_code": "IS",
            "country_name": "Islandia",
            "region": base.text(camera.get("region")) or None,
            "city": road or None,
            "locality": road or None,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "Atlantic/Reykjavik",
            "category": "weather-road",
            "media_type": "snapshot",
            "snapshot_url": image,
            "source_page_url": ICELAND_PAGE,
            "refresh_seconds": 300,
            "status": "online",
            "attribution": "Icelandic Road and Coastal Administration / Vegagerðin",
            "license_name": "Official public traffic information terms",
            "privacy_level": "public-traffic",
            "source_payload": camera,
        }


def rws_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload = request_json(
        RWS_ENDPOINT,
        timeout,
        headers={"Referer": "https://rwsverkeersinfo.nl/"},
    )
    for camera in payload if isinstance(payload, list) else []:
        if not isinstance(camera, dict):
            continue
        latitude = scalar(camera.get("latitude"))
        longitude = scalar(camera.get("longitude"))
        snapshot = base.text(camera.get("static_url"))
        identifier = base.text(camera.get("id"))
        if latitude is None or longitude is None or not snapshot or not identifier:
            continue
        road = base.text(camera.get("road"))
        nearby = base.text(camera.get("near"))
        description = base.text(camera.get("location_description") or camera.get("description"))
        yield {
            "external_id": identifier,
            "title": " · ".join(filter(None, (road, nearby))) or f"RWS camera {identifier}",
            "description": description or None,
            "country_code": "NL",
            "country_name": "Países Bajos",
            "city": nearby or None,
            "locality": road or None,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "Europe/Amsterdam",
            "category": "traffic",
            "media_type": "snapshot",
            "snapshot_url": snapshot,
            "embed_url": base.text(camera.get("stream_url")) or None,
            "source_page_url": "https://rwsverkeersinfo.nl/",
            "refresh_seconds": 300,
            "status": "online",
            "attribution": base.text(camera.get("attribution"), "Rijkswaterstaat Verkeersinformatie"),
            "license_name": "Official public traffic information terms",
            "privacy_level": "public-traffic",
            "source_payload": camera,
        }


def main() -> int:
    args = parse_args()
    with closing(base.ensure_database()) as connection:
        register_providers(connection)
        reports = [
            base.run_provider(connection, "TII_IE", lambda: tii_loader(args.timeout)),
            base.run_provider(connection, "VEGAGERDIN_IS", lambda: iceland_loader(max(args.timeout, 45))),
            base.run_provider(connection, "RWS_NL", lambda: rws_loader(args.timeout)),
        ]
        base.export_catalog(connection, reports)
        count = connection.execute(
            "SELECT COUNT(*) FROM cameras WHERE active=1 AND is_public=1"
        ).fetchone()[0]
    print(f"European Cams catalog ready: {count} public records")
    for report in reports:
        print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
