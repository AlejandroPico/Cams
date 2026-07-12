#!/usr/bin/env python3
"""Build the public Cams catalog using only zero-cost, explicitly configured sources.

The script deliberately does not scrape commercial camera directories. Every provider must
be listed in data/sources.json with attribution and licence metadata.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public" / "data" / "cameras.json"
META_OUTPUT = ROOT / "public" / "data" / "catalog-meta.json"
LEGACY = ROOT / "assets" / "js" / "data" / "cameras.js"
MANUAL_CSV = ROOT / "data" / "manual" / "cameras.csv"
SOURCES_FILE = ROOT / "data" / "sources.json"
USER_AGENT = "CamsCatalogBot/3.0 (+https://github.com/AlejandroPico/Cams)"


@dataclass
class Camera:
    id: str
    title: str
    country: str
    city: str
    lat: float
    lon: float
    category: str
    type: str
    provider: str
    active: bool = True
    status: str = "unknown"
    timezone: str | None = None
    videoId: str | None = None
    url: str | None = None
    embedUrl: str | None = None
    snapshotUrl: str | None = None
    sourceUrl: str | None = None
    refreshSeconds: int | None = None
    attribution: str | None = None
    license: str | None = None
    lastCheckedAt: str | None = None


def clean_text(value: Any, fallback: str = "") -> str:
    text = str(value or fallback).strip()
    return re.sub(r"\s+", " ", text)


def stable_id(provider: str, title: str, lat: float, lon: float, media: str) -> str:
    raw = f"{provider}|{title}|{lat:.6f}|{lon:.6f}|{media}".encode("utf-8")
    return f"cam-{hashlib.sha1(raw).hexdigest()[:16]}"


def normalise(raw: dict[str, Any], provider: str, defaults: dict[str, Any] | None = None) -> Camera | None:
    defaults = defaults or {}
    try:
        lat = float(raw.get("lat", raw.get("latitude")))
        lon = float(raw.get("lon", raw.get("lng", raw.get("longitude"))))
    except (TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None

    title = clean_text(raw.get("title", raw.get("name")), "Cámara pública")
    country = clean_text(raw.get("country"), defaults.get("country", "Sin país"))
    city = clean_text(raw.get("city", raw.get("locality")), defaults.get("city", "Sin localidad"))
    category = clean_text(raw.get("category"), defaults.get("category", "paisaje"))
    media_type = clean_text(raw.get("type"), defaults.get("type", "snapshot"))
    video_id = raw.get("videoId", raw.get("video_id"))
    snapshot = raw.get("snapshotUrl", raw.get("snapshot_url", raw.get("image")))
    url = raw.get("url", raw.get("stream_url"))
    embed = raw.get("embedUrl", raw.get("embed_url"))
    source = raw.get("sourceUrl", raw.get("source_url", raw.get("link")))
    media_key = clean_text(video_id or snapshot or url or embed or source)
    camera_id = clean_text(raw.get("id")) or stable_id(provider, title, lat, lon, media_key)

    return Camera(
        id=camera_id,
        title=title,
        country=country,
        city=city,
        lat=lat,
        lon=lon,
        category=category,
        type=media_type,
        provider=provider,
        active=raw.get("active", True) is not False,
        status=clean_text(raw.get("status"), "unknown"),
        timezone=clean_text(raw.get("timezone")) or None,
        videoId=clean_text(video_id) or None,
        url=clean_text(url) or None,
        embedUrl=clean_text(embed) or None,
        snapshotUrl=clean_text(snapshot) or None,
        sourceUrl=clean_text(source) or None,
        refreshSeconds=int(raw.get("refreshSeconds", raw.get("refresh_seconds", 0)) or 0) or None,
        attribution=clean_text(raw.get("attribution"), defaults.get("attribution", provider)) or None,
        license=clean_text(raw.get("license"), defaults.get("license", "source terms")) or None,
        lastCheckedAt=clean_text(raw.get("lastCheckedAt")) or None,
    )


def load_legacy() -> list[Camera]:
    if not LEGACY.exists():
        return []
    text = LEGACY.read_text(encoding="utf-8")
    match = re.search(r"const SEED = `(?P<seed>.*?)`;", text, re.S)
    if not match:
        return []
    cameras: list[Camera] = []
    for line in match.group("seed").strip().splitlines():
        parts = line.split("|")
        if len(parts) != 8:
            continue
        title, country, city, lat, lon, category, video_id, camera_id = parts
        camera = normalise({
            "id": camera_id,
            "title": title.replace("¦", "|"),
            "country": country.replace("¦", "|"),
            "city": city.replace("¦", "|"),
            "lat": lat,
            "lon": lon,
            "category": category,
            "type": "youtube",
            "videoId": video_id,
            "sourceUrl": f"https://www.youtube.com/watch?v={video_id}",
            "status": "unknown",
            "attribution": "YouTube / canal de origen",
            "license": "embed sujeto a condiciones del propietario"
        }, "Catálogo heredado")
        if camera:
            cameras.append(camera)
    return cameras


def load_manual_csv() -> list[Camera]:
    if not MANUAL_CSV.exists():
        return []
    cameras: list[Camera] = []
    with MANUAL_CSV.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            camera = normalise(row, clean_text(row.get("provider"), "Catálogo manual"))
            if camera:
                cameras.append(camera)
    return cameras


def fetch_json(url: str) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.load(response)


def extract_items(payload: Any, item_path: str | None) -> list[Any]:
    if item_path:
        current = payload
        for segment in item_path.split("."):
            if isinstance(current, dict):
                current = current.get(segment)
            else:
                current = None
                break
        payload = current
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and payload.get("type") == "FeatureCollection":
        items = []
        for feature in payload.get("features", []):
            geometry = feature.get("geometry") or {}
            coordinates = geometry.get("coordinates") or []
            properties = dict(feature.get("properties") or {})
            if geometry.get("type") == "Point" and len(coordinates) >= 2:
                properties["lon"], properties["lat"] = coordinates[:2]
            items.append(properties)
        return items
    return []


def load_remote_sources() -> tuple[list[Camera], list[dict[str, Any]]]:
    if not SOURCES_FILE.exists():
        return [], []
    config = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    cameras: list[Camera] = []
    reports: list[dict[str, Any]] = []

    for source in config.get("sources", []):
        if not source.get("enabled"):
            continue
        name = clean_text(source.get("name"), "Fuente externa")
        started = time.monotonic()
        try:
            payload = fetch_json(source["url"])
            items = extract_items(payload, source.get("itemPath"))
            count = 0
            mapping = source.get("mapping", {})
            for item in items:
                if not isinstance(item, dict):
                    continue
                mapped = {target: item.get(origin) for target, origin in mapping.items()} if mapping else item
                camera = normalise(mapped, name, source)
                if camera:
                    cameras.append(camera)
                    count += 1
            reports.append({"name": name, "status": "ok", "count": count, "seconds": round(time.monotonic() - started, 2)})
        except (OSError, ValueError, KeyError, urllib.error.URLError) as exc:
            reports.append({"name": name, "status": "error", "error": str(exc), "count": 0})
    return cameras, reports


def deduplicate(cameras: Iterable[Camera]) -> list[Camera]:
    by_id: dict[str, Camera] = {}
    by_media: dict[str, str] = {}
    for camera in cameras:
        if not camera.active:
            continue
        media = camera.videoId or camera.snapshotUrl or camera.url or camera.embedUrl or camera.sourceUrl or ""
        media_key = media.strip().lower()
        if media_key and media_key in by_media:
            existing = by_id[by_media[media_key]]
            if existing.status != "online" and camera.status == "online":
                by_id[existing.id] = camera
            continue
        by_id[camera.id] = camera
        if media_key:
            by_media[media_key] = camera.id
    return sorted(by_id.values(), key=lambda camera: (camera.country.casefold(), camera.city.casefold(), camera.title.casefold()))


def serialise(camera: Camera) -> dict[str, Any]:
    return {key: value for key, value in asdict(camera).items() if value is not None}


def main() -> None:
    legacy = load_legacy()
    manual = load_manual_csv()
    remote, reports = load_remote_sources()
    cameras = deduplicate([*legacy, *manual, *remote])

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"cameras": [serialise(camera) for camera in cameras]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    META_OUTPUT.write_text(json.dumps({
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(cameras),
        "sources": {"legacy": len(legacy), "manual": len(manual), "remote": len(remote)},
        "reports": reports,
        "policy": "Only zero-cost sources explicitly configured with attribution and licence metadata are ingested."
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(cameras)} cameras at {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
