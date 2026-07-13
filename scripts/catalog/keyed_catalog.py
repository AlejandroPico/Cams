#!/usr/bin/env python3
"""Importa fuentes gratuitas que requieren una clave registrada por el usuario.

No contiene credenciales. Lee secretos de entorno y omite silenciosamente las fuentes
sin configurar. Las claves nunca se exportan a SQLite, JSON ni al frontend.
"""
from __future__ import annotations

import html
import json
import os
import re
import urllib.parse
import urllib.request
from contextlib import closing
from typing import Any, Iterable

import build_catalog as base

TRAFIKVERKET_ENDPOINT = "https://api.trafikinfo.trafikverket.se/v2/data.json"
KOREA_ITS_ENDPOINT = "https://openapi.its.go.kr/api/NCCTVInfo"

IBI_SOURCES = [
    ("US_GA511", "Georgia 511", "Georgia", "https://511ga.org", "DOT_GA_API_KEY", "America/New_York"),
    ("US_FL511", "Florida 511", "Florida", "https://fl511.com", "DOT_FL_API_KEY", "America/New_York"),
    ("US_AZ511", "Arizona 511", "Arizona", "https://az511.com", "DOT_AZ_API_KEY", "America/Phoenix"),
    ("US_ID511", "Idaho 511", "Idaho", "https://511.idaho.gov", "DOT_ID_API_KEY", "America/Boise"),
    ("US_UT511", "Utah 511", "Utah", "https://prod-ut.ibi511.com", "DOT_UT_API_KEY", "America/Denver"),
    ("US_LA511", "Louisiana 511", "Louisiana", "https://511la.org", "DOT_LA_API_KEY", "America/Chicago"),
    ("US_PA511", "Pennsylvania 511", "Pennsylvania", "https://www.511pa.com", "DOT_PA_API_KEY", "America/New_York"),
    ("US_SC511", "South Carolina 511", "South Carolina", "https://511sc.org", "DOT_SC_API_KEY", "America/New_York"),
    ("US_MA511", "Massachusetts 511", "Massachusetts", "https://www.mass511.com", "DOT_MA_API_KEY", "America/New_York"),
]


def request_json(url: str, timeout: int = 35, method: str = "GET", body: bytes | None = None, headers: dict[str, str] | None = None) -> Any:
    request_headers = {
        "User-Agent": "CamsCatalogBot/4.3 (+https://github.com/AlejandroPico/Cams)",
        "Accept": "application/json,*/*",
    }
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, data=body, method=method, headers=request_headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8-sig"))


def provider_payload(code: str, name: str, homepage: str, country_code: str, notes: str) -> dict[str, Any]:
    return {
        "code": code,
        "name": name,
        "homepage_url": homepage,
        "api_url": homepage,
        "country_code": country_code,
        "attribution": name,
        "license_name": "Registered free API terms",
        "refresh_seconds": 300,
        "enabled": 1,
        "notes": notes,
    }


def register_provider(connection, provider: dict[str, Any]) -> None:
    columns = list(provider)
    placeholders = ",".join(f":{column}" for column in columns)
    updates = ",".join(f"{column}=excluded.{column}" for column in columns if column != "code")
    connection.execute(
        f"INSERT INTO providers ({','.join(columns)}) VALUES ({placeholders}) "
        f"ON CONFLICT(code) DO UPDATE SET {updates}",
        provider,
    )
    connection.commit()


def point_coordinates(value: str) -> tuple[float, float] | None:
    match = re.search(r"POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)", value or "", re.I)
    if not match:
        return None
    longitude, latitude = float(match.group(1)), float(match.group(2))
    if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
        return None
    return longitude, latitude


def trafikverket_loader(key: str) -> Iterable[dict[str, Any]]:
    escaped = html.escape(key, quote=True)
    xml = (
        "<REQUEST>"
        f"<LOGIN authenticationkey=\"{escaped}\"/>"
        "<QUERY objecttype=\"Camera\" schemaversion=\"1\">"
        "<FILTER><EQ name=\"Active\" value=\"true\"/></FILTER>"
        "<INCLUDE>Id</INCLUDE><INCLUDE>Name</INCLUDE>"
        "<INCLUDE>Geometry.WGS84</INCLUDE><INCLUDE>PhotoUrl</INCLUDE>"
        "</QUERY></REQUEST>"
    ).encode("utf-8")
    payload = request_json(
        TRAFIKVERKET_ENDPOINT,
        method="POST",
        body=xml,
        headers={"Content-Type": "text/xml"},
    )
    results = payload.get("RESPONSE", {}).get("RESULT", [])
    cameras = results[0].get("Camera", []) if results else []
    for camera in cameras:
        camera_id = base.text(camera.get("Id"))
        photo = base.text(camera.get("PhotoUrl"))
        geometry = (camera.get("Geometry") or {}).get("WGS84")
        coordinates = point_coordinates(base.text(geometry))
        if not camera_id or not photo or not coordinates:
            continue
        longitude, latitude = coordinates
        image_url = photo if photo.endswith("/image") else f"{photo}/image"
        yield {
            "external_id": camera_id,
            "title": base.text(camera.get("Name"), "Trafikverket camera"),
            "country_code": "SE",
            "country_name": "Suecia",
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "Europe/Stockholm",
            "category": "weather-road",
            "media_type": "snapshot",
            "snapshot_url": image_url,
            "source_page_url": "https://www.trafikverket.se/trafikinformation/vag/",
            "refresh_seconds": 300,
            "status": "online",
            "attribution": "Trafikverket",
            "license_name": "Trafikverket open API terms",
            "privacy_level": "public-traffic",
            "source_payload": camera,
        }


def korea_loader(key: str) -> Iterable[dict[str, Any]]:
    seen: set[str] = set()
    for road_type, label in (("ex", "Expressway"), ("its", "National highway")):
        query = urllib.parse.urlencode({
            "apiKey": key,
            "type": road_type,
            "cctvType": 1,
            "getType": "json",
            "minX": 124,
            "maxX": 132,
            "minY": 33,
            "maxY": 43,
        })
        payload = request_json(f"{KOREA_ITS_ENDPOINT}?{query}")
        cameras = payload.get("response", {}).get("data", []) if isinstance(payload, dict) else []
        for camera in cameras if isinstance(cameras, list) else []:
            try:
                latitude = float(camera.get("coordy"))
                longitude = float(camera.get("coordx"))
            except (TypeError, ValueError):
                continue
            stream = base.text(camera.get("cctvurl"))
            if not stream:
                continue
            identifier = f"{road_type}:{latitude:.5f}:{longitude:.5f}"
            if identifier in seen:
                continue
            seen.add(identifier)
            yield {
                "external_id": identifier,
                "title": base.text(camera.get("cctvname"), f"Korea {label} camera"),
                "description": label,
                "country_code": "KR",
                "country_name": "Corea del Sur",
                "latitude": latitude,
                "longitude": longitude,
                "timezone": "Asia/Seoul",
                "category": "traffic",
                "media_type": "hls" if ".m3u8" in stream.lower() else "video",
                "stream_url": stream,
                "source_page_url": "https://www.its.go.kr/opendata/",
                "refresh_seconds": 60,
                "is_live": True,
                "status": "online",
                "attribution": "ITS National Transport Information Center Korea",
                "license_name": "ITS Korea open API terms",
                "privacy_level": "public-traffic",
                "source_payload": camera,
            }


def ibi_loader(base_url: str, key: str, state: str, timezone_name: str) -> Iterable[dict[str, Any]]:
    url = f"{base_url}/api/v2/get/cameras?{urllib.parse.urlencode({'key': key, 'format': 'json'})}"
    payload = request_json(url)
    for camera in payload if isinstance(payload, list) else []:
        latitude = camera.get("Latitude")
        longitude = camera.get("Longitude")
        try:
            latitude, longitude = float(latitude), float(longitude)
        except (TypeError, ValueError):
            continue
        views = camera.get("Views") or []
        view = next((item for item in views if str(item.get("Status", "")).lower() == "enabled"), None)
        if not view:
            continue
        image_url = base.text(view.get("Url"))
        if not image_url:
            continue
        camera_id = base.text(camera.get("Id"), f"{latitude}:{longitude}")
        roadway = base.text(camera.get("Roadway"))
        direction = base.text(camera.get("Direction"))
        location = base.text(camera.get("Location"))
        yield {
            "external_id": camera_id,
            "title": base.text(camera.get("Name"), location or f"{state} camera {camera_id}"),
            "description": " · ".join(filter(None, (roadway, location, direction))) or None,
            "country_code": "US",
            "country_name": "Estados Unidos",
            "region": state,
            "city": location or None,
            "locality": roadway or None,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": timezone_name,
            "category": "traffic",
            "media_type": "snapshot",
            "snapshot_url": image_url,
            "source_page_url": base_url,
            "refresh_seconds": 120,
            "status": "online",
            "view_direction": direction or None,
            "attribution": f"{state} 511",
            "license_name": "Registered free API terms",
            "privacy_level": "public-traffic",
            "source_payload": camera,
        }


def main() -> int:
    configured: list[tuple[dict[str, Any], Any]] = []

    trafikverket_key = os.getenv("TRAFIKVERKET_KEY", "").strip()
    if trafikverket_key:
        provider = provider_payload(
            "TRAFIKVERKET_SE", "Trafikverket Cameras", "https://api.trafikinfo.trafikverket.se/", "SE",
            "API nacional sueca; requiere una clave gratuita guardada como TRAFIKVERKET_KEY.",
        )
        configured.append((provider, lambda key=trafikverket_key: trafikverket_loader(key)))

    korea_key = os.getenv("ITS_KR_KEY", "").strip()
    if korea_key:
        provider = provider_payload(
            "ITS_KR", "ITS Korea CCTV", "https://www.its.go.kr/opendata/", "KR",
            "Autopistas y carreteras nacionales; clave gratuita guardada como ITS_KR_KEY.",
        )
        configured.append((provider, lambda key=korea_key: korea_loader(key)))

    for code, name, state, base_url, env_name, timezone_name in IBI_SOURCES:
        key = os.getenv(env_name, "").strip()
        if not key:
            continue
        provider = provider_payload(
            code, name, base_url, "US",
            f"Red 511 de {state}; clave gratuita guardada como {env_name}.",
        )
        configured.append((provider, lambda url=base_url, token=key, region=state, tz=timezone_name: ibi_loader(url, token, region, tz)))

    if not configured:
        print("Keyed catalog: no optional API secrets configured")
        return 0

    reports: list[dict[str, Any]] = []
    with closing(base.ensure_database()) as connection:
        for provider, loader in configured:
            register_provider(connection, provider)
            reports.append(base.run_provider(connection, provider["code"], loader))
        base.export_catalog(connection, reports)
        total = connection.execute("SELECT COUNT(*) FROM cameras WHERE active=1 AND is_public=1").fetchone()[0]
    print(f"Keyed Cams catalog ready: {total} public records")
    for report in reports:
        print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
