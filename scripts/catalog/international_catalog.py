#!/usr/bin/env python3
"""Amplía Cams con redes públicas internacionales sin coste ni credenciales.

Fuentes incluidas:
- Servei Català de Trànsit, descubierto mediante el WFS público de MCT/CIVICAT.
- Autobahn GmbH / Autobahn API de Alemania.
- 511 New York.
- Oregon TripCheck.
- DriveBC, catálogo abierto de Columbia Británica.
- Ontario 511.

Cada proveedor se ejecuta de forma independiente. Una fuente caída no elimina datos
anteriores ni impide publicar las demás.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
import math
import re
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import closing
from typing import Any, Iterable, Iterator

import build_catalog as base

USER_AGENT = "CamsCatalogBot/4.2 (+https://github.com/AlejandroPico/Cams)"

SCT_WFS_BASES = (
    "https://mct.gencat.cat/sct-gis/wfs",
    "http://mct.gencat.cat/sct-gis/wfs",
)
AUTOBAN_BASE = "https://verkehr.autobahn.de/o/autobahn"
NY511_URL = "https://511ny.org/api/getcameras?format=json"
OREGON_URL = "https://tripcheck.com/Scripts/map/data/cctvinventory.js"
OREGON_IMAGE_BASE = "https://tripcheck.com/RoadCams/cams/"
DRIVEBC_CSV = (
    "https://catalogue.data.gov.bc.ca/dataset/6b39a910-6c77-476f-ac96-7b4f18849b1c/"
    "resource/a9d52d85-8402-4ce7-b2ac-a2779837c48a/download/webcams.csv"
)
ONTARIO_URL = "https://511on.ca/api/v2/get/cameras?format=json"

PROVIDERS = [
    {
        "code": "SCT_CAT",
        "name": "Servei Català de Trànsit Cameras",
        "homepage_url": "https://mct.gencat.cat/",
        "api_url": SCT_WFS_BASES[0],
        "country_code": "ES",
        "attribution": "Servei Català de Trànsit / Generalitat de Catalunya",
        "license_name": "Generalitat public information terms",
        "refresh_seconds": 180,
        "notes": "Cámaras y ubicaciones descubiertas en el servicio WFS público de MCT/CIVICAT.",
    },
    {
        "code": "AUTOBAHN_DE",
        "name": "Autobahn GmbH Webcams",
        "homepage_url": "https://www.autobahn.de/",
        "api_url": AUTOBAN_BASE,
        "country_code": "DE",
        "attribution": "Die Autobahn GmbH des Bundes",
        "license_name": "Official public API terms",
        "refresh_seconds": 300,
        "notes": "Webcams publicadas por carretera en la Autobahn API.",
    },
    {
        "code": "NY511_US",
        "name": "511 New York Cameras",
        "homepage_url": "https://511ny.org/",
        "api_url": NY511_URL,
        "country_code": "US",
        "attribution": "New York State 511",
        "license_name": "Public traveller information terms",
        "refresh_seconds": 60,
        "notes": "Snapshots y, cuando se publican, streams de 511 New York.",
    },
    {
        "code": "OREGON_US",
        "name": "Oregon TripCheck Cameras",
        "homepage_url": "https://tripcheck.com/",
        "api_url": OREGON_URL,
        "country_code": "US",
        "attribution": "Oregon Department of Transportation",
        "license_name": "Public traveller information terms",
        "refresh_seconds": 300,
        "notes": "Inventario público de cámaras de Oregon TripCheck.",
    },
    {
        "code": "DRIVEBC_CA",
        "name": "DriveBC Highway Cameras",
        "homepage_url": "https://www.drivebc.ca/",
        "api_url": DRIVEBC_CSV,
        "country_code": "CA",
        "attribution": "Province of British Columbia / DriveBC",
        "license_name": "Open Government Licence - British Columbia",
        "refresh_seconds": 300,
        "notes": "Catálogo CSV abierto de cámaras de carretera de Columbia Británica.",
    },
    {
        "code": "ONTARIO511_CA",
        "name": "Ontario 511 Cameras",
        "homepage_url": "https://511on.ca/",
        "api_url": ONTARIO_URL,
        "country_code": "CA",
        "attribution": "Ontario 511 / Ministry of Transportation Ontario",
        "license_name": "Ontario public information terms",
        "refresh_seconds": 120,
        "notes": "Cámaras públicas de la red Ontario 511.",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=int, default=35)
    return parser.parse_args()


def request_bytes(url: str, timeout: int, headers: dict[str, str] | None = None) -> bytes:
    request_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json,application/geo+json,text/csv,application/xml,text/xml,text/plain,*/*",
        "Accept-Encoding": "gzip",
    }
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, headers=request_headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read()
        if (response.headers.get("Content-Encoding") or "").lower() == "gzip":
            payload = gzip.decompress(payload)
        return payload


def jsonish(raw: bytes) -> Any:
    text = raw.decode("utf-8-sig", errors="replace").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        first_object = min((index for index in (text.find("{"), text.find("[")) if index >= 0), default=-1)
        last_object = max(text.rfind("}"), text.rfind("]"))
        if first_object < 0 or last_object <= first_object:
            raise
        return json.loads(text[first_object:last_object + 1])


def request_json(url: str, timeout: int, headers: dict[str, str] | None = None) -> Any:
    return jsonish(request_bytes(url, timeout, headers))


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
    if isinstance(value, dict):
        for key in ("value", "Value", "lat", "long", "latitude", "longitude", "x", "y"):
            if key in value:
                return scalar(value[key])
        return None
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None


def text_value(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    if isinstance(value, dict):
        for key in ("value", "text", "description", "title", "name"):
            if key in value:
                candidate = text_value(value[key])
                if candidate:
                    return candidate
        return " ".join(filter(None, (text_value(item) for item in value.values()))) or fallback
    if isinstance(value, list):
        return " · ".join(filter(None, (text_value(item) for item in value))) or fallback
    return base.text(value, fallback)


def normalise_url(value: Any, base_url: str) -> str | None:
    candidate = text_value(value)
    if not candidate:
        return None
    candidate = candidate.replace("&amp;", "&").strip()
    if candidate.startswith("//"):
        candidate = "https:" + candidate
    return urllib.parse.urljoin(base_url, candidate)


def first_pair(value: Any) -> tuple[float, float] | None:
    if isinstance(value, (list, tuple)):
        if len(value) >= 2 and not isinstance(value[0], (list, tuple, dict)):
            x, y = scalar(value[0]), scalar(value[1])
            if x is not None and y is not None:
                return x, y
        for item in value:
            result = first_pair(item)
            if result:
                return result
    return None


def wgs84_pair(coordinates: Any) -> tuple[float, float] | None:
    pair = first_pair(coordinates)
    if not pair:
        return None
    longitude, latitude = pair
    if abs(longitude) <= 90 and abs(latitude) > 90 and abs(latitude) <= 180:
        longitude, latitude = latitude, longitude
    if abs(longitude) > 180 or abs(latitude) > 90:
        try:
            longitude = longitude * 180.0 / 20037508.34
            latitude = math.degrees(2 * math.atan(math.exp(latitude / 6378137.0)) - math.pi / 2)
        except (OverflowError, ValueError):
            return None
    if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
        return None
    return longitude, latitude


def flattened_strings(value: Any) -> Iterator[tuple[str, str]]:
    if isinstance(value, dict):
        for key, nested in value.items():
            if isinstance(nested, str):
                yield str(key), nested
            else:
                for nested_key, nested_value in flattened_strings(nested):
                    yield f"{key}.{nested_key}", nested_value
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            if isinstance(nested, str):
                yield str(index), nested
            else:
                yield from flattened_strings(nested)


def find_image_url(properties: dict[str, Any], base_url: str) -> str | None:
    preferred: list[str] = []
    fallback: list[str] = []
    for key, value in flattened_strings(properties):
        decoded = value.replace("&amp;", "&")
        urls = re.findall(r"(?:https?:)?//[^\s\"'<>]+|(?:\.\.?/)?[^\s\"'<>]+\.(?:jpe?g|png|webp)(?:\?[^\s\"'<>]*)?", decoded, re.I)
        for raw_url in urls:
            url = normalise_url(raw_url, base_url)
            if not url:
                continue
            lower_key = key.lower()
            lower_url = url.lower()
            if re.search(r"\.(?:jpe?g|png|webp)(?:$|\?)", lower_url):
                if any(token in lower_key for token in ("imatge", "image", "foto", "snapshot", "camera", "camara")):
                    preferred.append(url)
                else:
                    fallback.append(url)
    return (preferred or fallback or [None])[0]


def property_text(properties: dict[str, Any], names: tuple[str, ...], fallback: str = "") -> str:
    lowered = {str(key).lower(): value for key, value in properties.items()}
    for name in names:
        if name.lower() in lowered:
            value = text_value(lowered[name.lower()])
            if value:
                return value
    for key, value in lowered.items():
        if any(name.lower() in key for name in names):
            candidate = text_value(value)
            if candidate:
                return candidate
    return fallback


def get_sct_capabilities(timeout: int) -> tuple[str, list[str]]:
    errors: list[str] = []
    for base_url in SCT_WFS_BASES:
        query = urllib.parse.urlencode({"service": "WFS", "version": "1.0.0", "request": "GetCapabilities"})
        try:
            root = ET.fromstring(request_bytes(f"{base_url}?{query}", timeout))
            names: list[str] = []
            for feature_type in root.iter():
                if feature_type.tag.rsplit("}", 1)[-1].lower() != "featuretype":
                    continue
                for child in feature_type:
                    if child.tag.rsplit("}", 1)[-1].lower() == "name" and child.text:
                        names.append(child.text.strip())
                        break
            return base_url, names
        except Exception as error:  # el segundo endpoint puede seguir funcionando
            errors.append(f"{base_url}: {error}")
    raise RuntimeError("; ".join(errors) or "SCT WFS capabilities unavailable")


def get_sct_layer(base_url: str, layer: str, timeout: int) -> dict[str, Any] | None:
    for output_format in ("application/json", "json"):
        query = urllib.parse.urlencode({
            "service": "WFS",
            "version": "1.0.0",
            "request": "GetFeature",
            "maxFeatures": 6000,
            "outputFormat": output_format,
            "srsName": "EPSG:4326",
            "typeName": layer,
        })
        try:
            payload = request_json(f"{base_url}?{query}", timeout)
            if isinstance(payload, dict) and isinstance(payload.get("features"), list):
                return payload
        except Exception:
            continue
    return None


def sct_loader(timeout: int) -> Iterable[dict[str, Any]]:
    base_url, advertised = get_sct_capabilities(max(timeout, 45))
    explicit = [
        "cite:mct2_cameres",
        "cite:mct2_cameras",
        "cite:mct2_camera",
        "cite:mct2_cctv",
        "mct2_cameres",
    ]
    discovered = [
        name for name in advertised
        if any(token in name.lower() for token in ("camer", "camara", "cctv", "webcam"))
    ]
    layers = list(dict.fromkeys(discovered + explicit))
    seen: set[str] = set()
    snapshot_count = 0
    layer_counts: dict[str, int] = {}

    for layer in layers:
        payload = get_sct_layer(base_url, layer, max(timeout, 45))
        if not payload:
            continue
        accepted = 0
        for feature in payload.get("features", []):
            if not isinstance(feature, dict):
                continue
            geometry = feature.get("geometry") or {}
            pair = wgs84_pair(geometry.get("coordinates"))
            if not pair:
                continue
            longitude, latitude = pair
            properties = feature.get("properties") or {}
            if not isinstance(properties, dict):
                properties = {}
            external_id = text_value(feature.get("id")) or property_text(
                properties, ("id", "codi", "codigo", "camera_id", "id_camera", "id_camara")
            )
            if not external_id:
                external_id = f"{layer}:{latitude:.6f}:{longitude:.6f}"
            unique = f"{layer}|{external_id}"
            if unique in seen:
                continue
            seen.add(unique)

            road = property_text(properties, ("carretera", "road", "via", "codi_carretera"))
            pk = property_text(properties, ("pk", "punt_quilometric", "kilometre", "kilometro"))
            title = property_text(
                properties,
                ("nom", "name", "title", "denominacio", "descripcion", "descripcio"),
                f"SCT camera {external_id}",
            )
            locality = property_text(properties, ("municipi", "municipality", "localitat", "poblacio"))
            snapshot = find_image_url(properties, base_url)
            if snapshot:
                snapshot_count += 1
            accepted += 1
            yield {
                "external_id": unique,
                "title": f"SCT · {title}",
                "description": " · ".join(filter(None, (road, f"PK {pk}" if pk else ""))) or None,
                "country_code": "ES",
                "country_name": "España",
                "region": "Cataluña",
                "province": property_text(properties, ("provincia", "province")) or None,
                "city": locality or None,
                "locality": road or title,
                "latitude": latitude,
                "longitude": longitude,
                "timezone": "Europe/Madrid",
                "category": "traffic",
                "media_type": "snapshot" if snapshot else "link",
                "snapshot_url": snapshot,
                "source_page_url": "https://mct.gencat.cat/",
                "refresh_seconds": 180,
                "status": "online" if snapshot else "unknown",
                "status_reason": None if snapshot else "El WFS publica la ubicación, pero no una imagen insertable.",
                "is_embeddable": bool(snapshot),
                "attribution": "Servei Català de Trànsit / Generalitat de Catalunya",
                "license_name": "Generalitat public information terms",
                "privacy_level": "public-traffic",
                "source_payload": {"layer": layer, "feature": feature},
            }
        if accepted:
            layer_counts[layer] = accepted

    print(
        f"SCT WFS layers={layer_counts or 'none'} snapshots={snapshot_count} total={len(seen)}",
        file=sys.stderr,
    )


def autobahn_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload = request_json(f"{AUTOBAN_BASE}/", timeout)
    roads = payload.get("roads", []) if isinstance(payload, dict) else []
    roads = [text_value(road) for road in roads if text_value(road)]

    def fetch_road(road: str) -> tuple[str, list[dict[str, Any]], str | None]:
        url = f"{AUTOBAN_BASE}/{urllib.parse.quote(road, safe='')}/services/webcam"
        try:
            result = request_json(url, timeout)
            cameras = result.get("webcam", []) if isinstance(result, dict) else []
            return road, cameras if isinstance(cameras, list) else [], None
        except Exception as error:
            return road, [], str(error)

    with ThreadPoolExecutor(max_workers=12) as executor:
        futures = [executor.submit(fetch_road, road) for road in roads]
        for future in as_completed(futures):
            road, cameras, error = future.result()
            if error:
                print(f"Autobahn {road} skipped: {error}", file=sys.stderr)
                continue
            for camera in cameras:
                if not isinstance(camera, dict):
                    continue
                coordinate = camera.get("coordinate") or camera.get("point") or {}
                latitude = scalar(coordinate.get("lat") if isinstance(coordinate, dict) else None)
                longitude = scalar(coordinate.get("long") if isinstance(coordinate, dict) else None)
                if latitude is None or longitude is None:
                    continue
                identifier = text_value(camera.get("identifier")) or f"{road}:{latitude:.6f}:{longitude:.6f}"
                snapshot = normalise_url(camera.get("imageurl"), AUTOBAN_BASE)
                link = normalise_url(camera.get("linkurl"), AUTOBAN_BASE) or "https://www.autobahn.de/"
                title = text_value(camera.get("title"), f"Autobahn {road}")
                subtitle = text_value(camera.get("subtitle"))
                blocked = str(camera.get("isBlocked") or camera.get("is_blocked") or "").lower() in {"true", "1", "yes"}
                yield {
                    "external_id": identifier,
                    "title": f"{road} · {title}",
                    "description": subtitle or text_value(camera.get("description")) or None,
                    "country_code": "DE",
                    "country_name": "Alemania",
                    "region": road,
                    "latitude": latitude,
                    "longitude": longitude,
                    "timezone": "Europe/Berlin",
                    "category": "traffic",
                    "media_type": "snapshot" if snapshot else "link",
                    "snapshot_url": snapshot,
                    "source_page_url": link,
                    "refresh_seconds": 300,
                    "status": "blocked" if blocked else ("online" if snapshot else "unknown"),
                    "status_reason": "Marcada como bloqueada por el proveedor" if blocked else None,
                    "is_embeddable": bool(snapshot) and not blocked,
                    "attribution": "Die Autobahn GmbH des Bundes",
                    "license_name": "Official public API terms",
                    "privacy_level": "public-traffic",
                    "source_payload": camera,
                }


def ny511_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload = request_json(NY511_URL, timeout)
    for camera in payload if isinstance(payload, list) else []:
        if not isinstance(camera, dict) or camera.get("Disabled") or camera.get("Blocked"):
            continue
        latitude, longitude = scalar(camera.get("Latitude")), scalar(camera.get("Longitude"))
        if latitude is None or longitude is None:
            continue
        snapshot = normalise_url(camera.get("Url"), NY511_URL)
        video = normalise_url(camera.get("VideoUrl"), NY511_URL)
        media_type = "hls" if video and ".m3u8" in video.lower() else ("video" if video else "snapshot")
        yield {
            "external_id": text_value(camera.get("ID")) or f"{latitude}:{longitude}",
            "title": text_value(camera.get("Name"), "511NY camera"),
            "description": text_value(camera.get("DirectionOfTravel")) or None,
            "country_code": "US",
            "country_name": "Estados Unidos",
            "region": "New York",
            "locality": text_value(camera.get("RoadwayName")) or None,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "America/New_York",
            "category": "traffic",
            "media_type": media_type,
            "stream_url": video,
            "snapshot_url": snapshot,
            "source_page_url": "https://511ny.org/",
            "refresh_seconds": 60,
            "is_live": bool(video),
            "status": "online" if snapshot or video else "unknown",
            "attribution": "New York State 511",
            "license_name": "Public traveller information terms",
            "privacy_level": "public-traffic",
            "source_payload": camera,
        }


def oregon_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload = request_json(OREGON_URL, timeout)
    features = payload.get("features", []) if isinstance(payload, dict) else []
    for feature in features:
        attributes = feature.get("attributes") or {}
        latitude = scalar(attributes.get("latitude"))
        longitude = scalar(attributes.get("longitude"))
        if latitude is None or longitude is None:
            geometry = feature.get("geometry") or {}
            latitude, longitude = scalar(geometry.get("y")), scalar(geometry.get("x"))
        if latitude is None or longitude is None:
            continue
        filename = text_value(attributes.get("filename"))
        snapshot = urllib.parse.urljoin(OREGON_IMAGE_BASE, filename) if filename else None
        camera_id = text_value(attributes.get("cameraId")) or f"{latitude}:{longitude}"
        route = text_value(attributes.get("route"))
        yield {
            "external_id": camera_id,
            "title": text_value(attributes.get("title"), f"Oregon camera {camera_id}"),
            "description": route or None,
            "country_code": "US",
            "country_name": "Estados Unidos",
            "region": "Oregon",
            "locality": route or None,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "America/Los_Angeles",
            "category": "traffic",
            "media_type": "snapshot" if snapshot else "link",
            "snapshot_url": snapshot,
            "source_page_url": "https://tripcheck.com/",
            "refresh_seconds": 300,
            "status": "online" if snapshot else "unknown",
            "is_embeddable": bool(snapshot),
            "attribution": "Oregon Department of Transportation",
            "license_name": "Public traveller information terms",
            "privacy_level": "public-traffic",
            "source_payload": feature,
        }


def normalise_csv_record(record: dict[str, str]) -> dict[str, str]:
    return {
        re.sub(r"[^a-z0-9]+", "_", str(key).lower()).strip("_"): (value or "").strip()
        for key, value in record.items()
    }


def record_value(record: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = record.get(key)
        if value:
            return value
    return ""


def drivebc_image(record: dict[str, str]) -> str | None:
    candidates = [
        record_value(record, "links_imagedisplay", "links_image_display"),
        record_value(record, "links_imagethumbnail", "links_image_thumbnail"),
        record_value(record, "links_bchighwaycam", "pageurl", "url", "link"),
        record_value(record, "cameraid", "camera_id", "id"),
    ]
    for candidate in candidates:
        if not candidate:
            continue
        url_match = re.search(r"https?://[^\s\"']+", candidate)
        if url_match and re.search(r"/images/\d+\.jpg(?:$|\?)", url_match.group(0), re.I):
            return url_match.group(0).split("?", 1)[0]
        numeric = re.search(r"(?:^|\D)(\d{1,6})(?:\.jpg|\.html|\D|$)", candidate, re.I)
        if numeric:
            return f"https://www.drivebc.ca/images/{numeric.group(1)}.jpg"
    return None


def drivebc_loader(timeout: int) -> Iterable[dict[str, Any]]:
    text = request_bytes(DRIVEBC_CSV, max(timeout, 45)).decode("utf-8-sig", errors="replace")
    for index, raw_record in enumerate(csv.DictReader(io.StringIO(text)), start=1):
        record = normalise_csv_record(raw_record)
        latitude = scalar(record_value(record, "latitude", "lat"))
        longitude = scalar(record_value(record, "longitude", "lng", "lon"))
        if latitude is None or longitude is None:
            continue
        camera_id = record_value(record, "id", "cameraid", "camera_id") or str(index)
        title = record_value(record, "camname", "cam_name", "name", "description", "label") or f"DriveBC camera {camera_id}"
        page_url = normalise_url(record_value(record, "links_bchighwaycam", "pageurl", "url", "link"), DRIVEBC_CSV)
        snapshot = drivebc_image(record)
        road = record_value(record, "highway_number", "highway", "road_name")
        location = record_value(record, "highway_locationdescription", "location", "area", "region")
        direction = record_value(record, "orientation", "direction")
        yield {
            "external_id": camera_id,
            "title": title,
            "description": " · ".join(filter(None, (road, location, direction))) or None,
            "country_code": "CA",
            "country_name": "Canadá",
            "region": "British Columbia",
            "city": location or None,
            "locality": road or None,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "America/Vancouver",
            "category": "weather-road",
            "media_type": "snapshot" if snapshot else "link",
            "snapshot_url": snapshot,
            "source_page_url": page_url or "https://www.drivebc.ca/",
            "refresh_seconds": int(scalar(record_value(record, "updateseconds", "update_frequency_seconds")) or 300),
            "status": "online" if snapshot else "unknown",
            "is_embeddable": bool(snapshot),
            "view_direction": direction or None,
            "attribution": record_value(record, "credit") or "Province of British Columbia / DriveBC",
            "license_name": "Open Government Licence - British Columbia",
            "privacy_level": "public-traffic",
            "source_payload": record,
        }


def ontario_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload = request_json(ONTARIO_URL, timeout)
    for camera in payload if isinstance(payload, list) else []:
        if not isinstance(camera, dict):
            continue
        latitude, longitude = scalar(camera.get("Latitude")), scalar(camera.get("Longitude"))
        if latitude is None or longitude is None:
            continue
        views = camera.get("Views") or []
        active = next((view for view in views if str(view.get("Status", "")).lower() == "enabled"), None)
        if active is None and views:
            active = views[0]
        snapshot = normalise_url((active or {}).get("Url"), ONTARIO_URL)
        camera_id = text_value(camera.get("Id")) or f"{latitude}:{longitude}"
        road = text_value(camera.get("Roadway"))
        location = text_value(camera.get("Location"))
        direction = text_value(camera.get("Direction"))
        yield {
            "external_id": camera_id,
            "title": text_value(camera.get("Name"), location or f"Ontario camera {camera_id}"),
            "description": " · ".join(filter(None, (road, location, direction))) or None,
            "country_code": "CA",
            "country_name": "Canadá",
            "region": "Ontario",
            "city": location or None,
            "locality": road or None,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "America/Toronto",
            "category": "traffic",
            "media_type": "snapshot" if snapshot else "link",
            "snapshot_url": snapshot,
            "source_page_url": snapshot or "https://511on.ca/",
            "refresh_seconds": 120,
            "status": "online" if snapshot else "unknown",
            "is_embeddable": bool(snapshot),
            "view_direction": direction or None,
            "attribution": "Ontario 511 / Ministry of Transportation Ontario",
            "license_name": "Ontario public information terms",
            "privacy_level": "public-traffic",
            "source_payload": camera,
        }


def main() -> int:
    args = parse_args()
    with closing(base.ensure_database()) as connection:
        register_providers(connection)
        reports = [
            base.run_provider(connection, "SCT_CAT", lambda: sct_loader(args.timeout)),
            base.run_provider(connection, "AUTOBAHN_DE", lambda: autobahn_loader(args.timeout)),
            base.run_provider(connection, "NY511_US", lambda: ny511_loader(args.timeout)),
            base.run_provider(connection, "OREGON_US", lambda: oregon_loader(args.timeout)),
            base.run_provider(connection, "DRIVEBC_CA", lambda: drivebc_loader(args.timeout)),
            base.run_provider(connection, "ONTARIO511_CA", lambda: ontario_loader(args.timeout)),
        ]
        base.export_catalog(connection, reports)
        count = connection.execute(
            "SELECT COUNT(*) FROM cameras WHERE active=1 AND is_public=1"
        ).fetchone()[0]
    print(f"International Cams catalog ready: {count} public records")
    for report in reports:
        print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"International catalog stage failed: {error}", file=sys.stderr)
        raise
