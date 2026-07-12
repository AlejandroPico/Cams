#!/usr/bin/env python3
"""Construye la base SQLite y los archivos estáticos consumidos por Cams.

Fuentes de coste cero:
- Caltrans CWWP2, doce distritos.
- Transport for London JamCams.
- Singapore LTA Traffic Images.
- GeoNet New Zealand Volcano Cameras.
- Semilla histórica de Cams, conservada como candidatos no verificados.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "cams.sqlite3"
SCHEMA_PATH = ROOT / "data" / "schema.sql"
LEGACY_PATH = ROOT / "assets" / "js" / "data" / "cameras.js"
PUBLIC_DIR = ROOT / "public" / "data"
PUBLIC_JSON = PUBLIC_DIR / "cameras.json"
PUBLIC_META = PUBLIC_DIR / "catalog-meta.json"
PUBLIC_DB = PUBLIC_DIR / "cams.sqlite3"
BUNDLED_FALLBACK = ROOT / "src" / "data" / "catalog.seed.json"
USER_AGENT = "CamsCatalogBot/4.0 (+https://github.com/AlejandroPico/Cams)"
NOW = lambda: datetime.now(timezone.utc).isoformat()

CALTRANS_URLS = [
    f"https://cwwp2.dot.ca.gov/data/d{district:02d}/cctv/cctvStatusD{district:02d}.json"
    for district in range(1, 13)
]
TFL_URL = "https://api.tfl.gov.uk/Place/Type/JamCam"
SINGAPORE_URL = "https://api.data.gov.sg/v1/transport/traffic-images"
GEONET_URL = "https://images.geonet.org.nz/volcano/cameras/all.json"
GEONET_IMAGE_BASE = "https://images.geonet.org.nz/volcano/cameras/"

PROVIDERS = [
    {
        "code": "LEGACY_YOUTUBE", "name": "Cams legacy YouTube candidates",
        "homepage_url": "https://www.youtube.com/", "attribution": "YouTube / original channel",
        "license_name": "Owner terms", "refresh_seconds": 300,
        "notes": "Candidatos históricos sin garantía de emisión actual."
    },
    {
        "code": "CALTRANS", "name": "Caltrans CWWP2",
        "homepage_url": "https://quickmap.dot.ca.gov/", "api_url": "https://cwwp2.dot.ca.gov/",
        "country_code": "US", "attribution": "California Department of Transportation",
        "license_name": "Public government data", "refresh_seconds": 60,
        "notes": "Snapshots y streams de los doce distritos de California."
    },
    {
        "code": "TFL", "name": "Transport for London JamCams",
        "homepage_url": "https://tfl.gov.uk/traffic/status/", "api_url": TFL_URL,
        "country_code": "GB", "attribution": "Transport for London",
        "license_name": "Open Government Licence v3.0",
        "license_url": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
        "refresh_seconds": 60, "notes": "Snapshots de tráfico de Londres."
    },
    {
        "code": "SG_LTA", "name": "Singapore LTA traffic images",
        "homepage_url": "https://data.gov.sg/", "api_url": SINGAPORE_URL,
        "country_code": "SG", "attribution": "Singapore Land Transport Authority / data.gov.sg",
        "license_name": "Singapore Open Data Licence",
        "terms_url": "https://data.gov.sg/open-data-licence", "refresh_seconds": 60,
        "notes": "Snapshots actuales de tráfico de Singapur."
    },
    {
        "code": "GEONET", "name": "GeoNet New Zealand volcano cameras",
        "homepage_url": "https://www.geonet.org.nz/volcano", "api_url": GEONET_URL,
        "country_code": "NZ", "attribution": "GeoNet New Zealand",
        "license_name": "CC BY 3.0 NZ",
        "license_url": "https://creativecommons.org/licenses/by/3.0/nz/",
        "refresh_seconds": 300, "notes": "Cámaras públicas de volcanes."
    }
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="No consultar proveedores remotos.")
    parser.add_argument("--timeout", type=int, default=25)
    return parser.parse_args()


def text(value: Any, fallback: str = "") -> str:
    return re.sub(r"\s+", " ", str(value or fallback)).strip()


def fetch_json(url: str, timeout: int) -> Any:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json,text/plain,*/*"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def ensure_database() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    for provider in PROVIDERS:
        columns = list(provider)
        placeholders = ",".join(f":{column}" for column in columns)
        updates = ",".join(f"{column}=excluded.{column}" for column in columns if column != "code")
        connection.execute(
            f"INSERT INTO providers ({','.join(columns)}) VALUES ({placeholders}) "
            f"ON CONFLICT(code) DO UPDATE SET {updates}", provider,
        )
    connection.commit()
    return connection


def provider_id(connection: sqlite3.Connection, code: str) -> int:
    row = connection.execute("SELECT id FROM providers WHERE code=?", (code,)).fetchone()
    if not row:
        raise RuntimeError(f"Proveedor ausente en SQLite: {code}")
    return int(row["id"])


def upsert_camera(connection: sqlite3.Connection, provider_code: str, camera: dict[str, Any]) -> None:
    latitude = float(camera["latitude"])
    longitude = float(camera["longitude"])
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return
    external_id = text(camera.get("external_id"))
    camera_id = text(camera.get("id"))
    if not camera_id:
        raw = f"{provider_code}|{external_id}|{camera.get('title')}|{latitude:.6f}|{longitude:.6f}"
        camera_id = f"cam:{hashlib.sha1(raw.encode()).hexdigest()[:20]}"
    now = NOW()
    checksum_source = "|".join(text(camera.get(key)) for key in (
        "title", "snapshot_url", "stream_url", "embed_url", "source_page_url"
    ))
    values = {
        "id": camera_id,
        "provider_id": provider_id(connection, provider_code),
        "external_id": external_id or None,
        "title": text(camera.get("title"), "Public camera"),
        "description": text(camera.get("description")) or None,
        "country_code": text(camera.get("country_code")) or None,
        "country_name": text(camera.get("country_name")) or None,
        "region": text(camera.get("region")) or None,
        "province": text(camera.get("province")) or None,
        "city": text(camera.get("city")) or None,
        "locality": text(camera.get("locality")) or None,
        "latitude": latitude,
        "longitude": longitude,
        "altitude_m": camera.get("altitude_m"),
        "timezone": text(camera.get("timezone")) or None,
        "category": text(camera.get("category"), "other"),
        "media_type": text(camera.get("media_type"), "snapshot"),
        "stream_url": text(camera.get("stream_url")) or None,
        "embed_url": text(camera.get("embed_url")) or None,
        "snapshot_url": text(camera.get("snapshot_url")) or None,
        "source_page_url": text(camera.get("source_page_url")) or None,
        "thumbnail_url": text(camera.get("thumbnail_url")) or None,
        "refresh_seconds": int(camera.get("refresh_seconds") or 0) or None,
        "is_live": 1 if camera.get("is_live") else 0,
        "is_public": 1 if camera.get("is_public", True) else 0,
        "is_embeddable": 1 if camera.get("is_embeddable", True) else 0,
        "status": text(camera.get("status"), "unknown"),
        "status_reason": text(camera.get("status_reason")) or None,
        "width_px": camera.get("width_px"),
        "height_px": camera.get("height_px"),
        "fps": camera.get("fps"),
        "orientation_degrees": camera.get("orientation_degrees"),
        "view_direction": text(camera.get("view_direction")) or None,
        "language": text(camera.get("language")) or None,
        "attribution": text(camera.get("attribution")) or None,
        "license_name": text(camera.get("license_name")) or None,
        "license_url": text(camera.get("license_url")) or None,
        "terms_url": text(camera.get("terms_url")) or None,
        "privacy_level": text(camera.get("privacy_level"), "public-landscape"),
        "active": 1 if camera.get("active", True) else 0,
        "priority": int(camera.get("priority") or 0),
        "first_seen_at": text(camera.get("first_seen_at")) or now,
        "last_seen_at": text(camera.get("last_seen_at")) or now,
        "last_checked_at": text(camera.get("last_checked_at")) or now,
        "updated_at": now,
        "source_payload_json": json.dumps(camera.get("source_payload"), ensure_ascii=False, separators=(",", ":")) if camera.get("source_payload") is not None else None,
        "checksum": hashlib.sha256(checksum_source.encode()).hexdigest(),
    }
    columns = list(values)
    updates = ",".join(
        f"{column}=excluded.{column}" for column in columns
        if column not in {"id", "provider_id", "first_seen_at"}
    )
    connection.execute(
        f"INSERT INTO cameras ({','.join(columns)}) VALUES ({','.join(f':{column}' for column in columns)}) "
        f"ON CONFLICT(id) DO UPDATE SET {updates}", values,
    )


def run_provider(connection: sqlite3.Connection, code: str, loader) -> dict[str, Any]:
    pid = provider_id(connection, code)
    run_id = connection.execute(
        "INSERT INTO ingestion_runs(provider_id,started_at,status) VALUES(?,?,'running')",
        (pid, NOW()),
    ).lastrowid
    connection.commit()
    started = time.monotonic()
    try:
        cameras = list(loader())
        for camera in cameras:
            upsert_camera(connection, code, camera)
        connection.execute(
            "UPDATE ingestion_runs SET finished_at=?,status='ok',fetched_count=?,inserted_count=?,message=? WHERE id=?",
            (NOW(), len(cameras), len(cameras), f"{time.monotonic()-started:.2f}s", run_id),
        )
        connection.commit()
        return {"provider": code, "status": "ok", "count": len(cameras)}
    except Exception as exc:  # cada proveedor falla de forma independiente
        connection.rollback()
        connection.execute(
            "UPDATE ingestion_runs SET finished_at=?,status='error',error_count=1,message=? WHERE id=?",
            (NOW(), str(exc), run_id),
        )
        connection.commit()
        return {"provider": code, "status": "error", "count": 0, "error": str(exc)}


def legacy_loader() -> Iterable[dict[str, Any]]:
    if not LEGACY_PATH.exists():
        return []
    match = re.search(r"const SEED = `(?P<seed>.*?)`;", LEGACY_PATH.read_text(encoding="utf-8"), re.S)
    if not match:
        return []
    output = []
    for line in match.group("seed").strip().splitlines():
        parts = line.split("|")
        if len(parts) != 8:
            continue
        title, country, city, lat, lon, category, video_id, external_id = parts
        output.append({
            "id": f"legacy:{external_id}", "external_id": external_id,
            "title": title.replace("¦", "|"), "country_name": country.replace("¦", "|"),
            "city": city.replace("¦", "|"), "latitude": float(lat), "longitude": float(lon),
            "category": category, "media_type": "youtube",
            "embed_url": f"https://www.youtube-nocookie.com/embed/{video_id}?autoplay=1&mute=1&playsinline=1",
            "source_page_url": f"https://www.youtube.com/watch?v={video_id}",
            "is_live": True, "status": "unknown",
            "status_reason": "Historic candidate; live status not guaranteed",
            "refresh_seconds": 300, "attribution": "YouTube / original channel",
            "license_name": "Owner terms", "priority": -10,
        })
    return output


def caltrans_loader(timeout: int) -> Iterable[dict[str, Any]]:
    for url in CALTRANS_URLS:
        try:
            payload = fetch_json(url, timeout)
        except (OSError, ValueError, urllib.error.URLError) as exc:
            print(f"Caltrans source skipped: {url}: {exc}", file=sys.stderr)
            continue
        for row in payload.get("data", []):
            cctv = row.get("cctv") or {}
            location = cctv.get("location") or {}
            image_data = cctv.get("imageData") or {}
            snapshot = (image_data.get("static") or {}).get("currentImageURL")
            stream = image_data.get("streamingVideoURL")
            if not snapshot and not stream:
                continue
            if location.get("latitude") in (None, "") or location.get("longitude") in (None, ""):
                continue
            district, index = text(location.get("district")), text(cctv.get("index"))
            yield {
                "external_id": f"d{district}:{index}",
                "title": text(location.get("locationName"), f"Caltrans camera {index}"),
                "country_code": "US", "country_name": "United States",
                "region": "California", "province": f"Caltrans District {district}",
                "latitude": float(location["latitude"]), "longitude": float(location["longitude"]),
                "category": "traffic", "media_type": "snapshot" if snapshot else "hls",
                "snapshot_url": snapshot, "stream_url": stream,
                "source_page_url": "https://quickmap.dot.ca.gov/", "refresh_seconds": 60,
                "is_live": bool(stream), "status": "online",
                "attribution": "California Department of Transportation",
                "license_name": "Public government data", "privacy_level": "public-traffic",
                "source_payload": row,
            }


def tfl_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload = fetch_json(TFL_URL, timeout)
    for row in payload if isinstance(payload, list) else []:
        props = {item.get("key"): item.get("value") for item in row.get("additionalProperties", []) if isinstance(item, dict)}
        snapshot = props.get("imageUrl")
        if not snapshot or row.get("lat") is None or row.get("lon") is None:
            continue
        yield {
            "external_id": text(row.get("id")), "title": text(row.get("commonName"), "TfL JamCam"),
            "country_code": "GB", "country_name": "United Kingdom", "region": "Greater London",
            "city": "London", "latitude": float(row["lat"]), "longitude": float(row["lon"]),
            "timezone": "Europe/London", "category": "traffic", "media_type": "snapshot",
            "snapshot_url": snapshot, "source_page_url": "https://tfl.gov.uk/traffic/status/",
            "refresh_seconds": 60, "status": "online", "attribution": "Transport for London",
            "license_name": "Open Government Licence v3.0",
            "license_url": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
            "privacy_level": "public-traffic", "source_payload": row,
        }


def singapore_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload = fetch_json(SINGAPORE_URL, timeout)
    items = payload.get("items") or []
    for row in (items[0].get("cameras") or []) if items else []:
        location, metadata = row.get("location") or {}, row.get("image_metadata") or {}
        if not row.get("image") or location.get("latitude") is None or location.get("longitude") is None:
            continue
        external_id = text(row.get("camera_id"))
        yield {
            "external_id": external_id, "title": f"Singapore traffic camera {external_id}",
            "country_code": "SG", "country_name": "Singapore", "city": "Singapore",
            "latitude": float(location["latitude"]), "longitude": float(location["longitude"]),
            "timezone": "Asia/Singapore", "category": "traffic", "media_type": "snapshot",
            "snapshot_url": row["image"], "source_page_url": "https://data.gov.sg/",
            "refresh_seconds": 60, "status": "online", "width_px": metadata.get("width"),
            "height_px": metadata.get("height"),
            "attribution": "Singapore Land Transport Authority / data.gov.sg",
            "license_name": "Singapore Open Data Licence",
            "terms_url": "https://data.gov.sg/open-data-licence",
            "privacy_level": "public-traffic", "last_seen_at": row.get("timestamp"),
            "source_payload": row,
        }


def geonet_loader(timeout: int) -> Iterable[dict[str, Any]]:
    payload = fetch_json(GEONET_URL, timeout)
    collections = payload if isinstance(payload, list) else [payload]
    for collection in collections:
        for feature in collection.get("features", []) if isinstance(collection, dict) else []:
            geometry, properties = feature.get("geometry") or {}, feature.get("properties") or {}
            coordinates = geometry.get("coordinates") or []
            latest = text(properties.get("latest-image-large"))
            if len(coordinates) < 2 or not latest:
                continue
            latitude, longitude = float(coordinates[0]), float(coordinates[1])
            snapshot = latest if latest.startswith("http") else f"{GEONET_IMAGE_BASE}{latest}"
            external_id = latest.replace("latest/", "").replace(".jpg", "")
            yield {
                "external_id": external_id,
                "title": text(properties.get("title"), f"GeoNet camera {external_id}"),
                "country_code": "NZ", "country_name": "New Zealand",
                "latitude": latitude, "longitude": longitude, "timezone": "Pacific/Auckland",
                "category": "volcano", "media_type": "snapshot", "snapshot_url": snapshot,
                "source_page_url": "https://www.geonet.org.nz/volcano", "refresh_seconds": 300,
                "status": "online", "attribution": "GeoNet New Zealand",
                "license_name": "CC BY 3.0 NZ",
                "license_url": "https://creativecommons.org/licenses/by/3.0/nz/",
                "source_payload": feature,
            }


def export_catalog(connection: sqlite3.Connection, reports: list[dict[str, Any]]) -> None:
    rows = connection.execute(
        "SELECT * FROM camera_catalog WHERE active=1 AND is_public=1 "
        "ORDER BY CASE status WHEN 'online' THEN 0 WHEN 'unknown' THEN 1 ELSE 2 END, priority DESC, provider_name, title"
    ).fetchall()
    cameras = []
    for row in rows:
        cameras.append({
            "id": row["id"], "title": row["title"], "description": row["description"],
            "country": row["country_name"] or row["country_code"] or "Unknown",
            "countryCode": row["country_code"], "region": row["region"], "province": row["province"],
            "city": row["city"] or row["locality"] or "", "locality": row["locality"],
            "lat": row["latitude"], "lon": row["longitude"], "altitudeM": row["altitude_m"],
            "timezone": row["timezone"], "category": row["category"], "type": row["media_type"],
            "provider": row["provider_name"], "providerCode": row["provider_code"],
            "active": bool(row["active"]), "status": row["status"], "statusReason": row["status_reason"],
            "url": row["stream_url"], "embedUrl": row["embed_url"],
            "snapshotUrl": row["snapshot_url"], "sourceUrl": row["source_page_url"],
            "thumbnailUrl": row["thumbnail_url"], "refreshSeconds": row["refresh_seconds"],
            "isLive": bool(row["is_live"]), "isEmbeddable": bool(row["is_embeddable"]),
            "width": row["width_px"], "height": row["height_px"], "fps": row["fps"],
            "viewDirection": row["view_direction"], "attribution": row["attribution"],
            "license": row["license_name"], "licenseUrl": row["license_url"],
            "termsUrl": row["terms_url"], "lastCheckedAt": row["last_checked_at"],
        })
    serialized = json.dumps({"cameras": cameras}, ensure_ascii=False, indent=2) + "\n"
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_JSON.write_text(serialized, encoding="utf-8")
    BUNDLED_FALLBACK.parent.mkdir(parents=True, exist_ok=True)
    BUNDLED_FALLBACK.write_text(serialized, encoding="utf-8")
    connection.commit()
    shutil.copy2(DB_PATH, PUBLIC_DB)
    provider_counts = connection.execute(
        "SELECT provider_code,COUNT(*) AS count FROM camera_catalog WHERE active=1 GROUP BY provider_code"
    ).fetchall()
    statuses = connection.execute(
        "SELECT status,COUNT(*) AS count FROM cameras WHERE active=1 GROUP BY status"
    ).fetchall()
    PUBLIC_META.write_text(json.dumps({
        "generatedAt": NOW(), "count": len(cameras),
        "providers": {row["provider_code"]: row["count"] for row in provider_counts},
        "statuses": {row["status"]: row["count"] for row in statuses},
        "reports": reports, "database": "data/cams.sqlite3"
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    with closing(ensure_database()) as connection:
        reports = [run_provider(connection, "LEGACY_YOUTUBE", legacy_loader)]
        if not args.offline:
            reports.extend([
                run_provider(connection, "CALTRANS", lambda: caltrans_loader(args.timeout)),
                run_provider(connection, "TFL", lambda: tfl_loader(args.timeout)),
                run_provider(connection, "SG_LTA", lambda: singapore_loader(args.timeout)),
                run_provider(connection, "GEONET", lambda: geonet_loader(args.timeout)),
            ])
        export_catalog(connection, reports)
        count = connection.execute("SELECT COUNT(*) FROM cameras WHERE active=1").fetchone()[0]
    print(f"Cams catalog ready: {count} active records")
    for report in reports:
        print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
