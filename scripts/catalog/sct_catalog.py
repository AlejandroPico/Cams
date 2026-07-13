#!/usr/bin/env python3
"""Importador aislado del Servei Català de Trànsit.

El WFS público de MCT/CIVICAT utiliza parámetros y firmas que OpenSSL 3 rechaza con
su nivel normal. La compatibilidad SECLEVEL=0 se aplica únicamente a este host y solo
para descargar información pública. La validación del certificado y del nombre del
host permanece activada; el resto de Cams conserva la configuración TLS predeterminada.
"""
from __future__ import annotations

import gzip
import json
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from contextlib import closing
from typing import Any

import build_catalog as base
import international_catalog as international

HOST = "mct.gencat.cat"
WFS_URL = f"https://{HOST}/sct-gis/wfs"
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 CamsCatalogBot/4.2",
    "Accept": "application/json,application/geo+json,application/xml,text/xml,*/*",
    "Accept-Encoding": "gzip",
    "Referer": f"https://{HOST}/",
}


def legacy_context() -> ssl.SSLContext:
    context = ssl.create_default_context()
    context.set_ciphers("DEFAULT:@SECLEVEL=0")
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED
    return context


def fetch_with_urllib(url: str, timeout: int) -> bytes:
    request = urllib.request.Request(url, headers=BROWSER_HEADERS)
    with urllib.request.urlopen(request, timeout=timeout, context=legacy_context()) as response:
        payload = response.read()
        if (response.headers.get("Content-Encoding") or "").lower() == "gzip":
            payload = gzip.decompress(payload)
        return payload


def fetch_with_curl(url: str, timeout: int) -> bytes:
    command = [
        "curl", "--fail", "--silent", "--show-error", "--location",
        "--max-time", str(timeout),
        "--ciphers", "DEFAULT:@SECLEVEL=0",
        "--header", f"User-Agent: {BROWSER_HEADERS['User-Agent']}",
        "--header", f"Accept: {BROWSER_HEADERS['Accept']}",
        "--header", f"Referer: {BROWSER_HEADERS['Referer']}",
        url,
    ]
    result = subprocess.run(command, check=True, capture_output=True)
    return result.stdout


def fetch_bytes(url: str, timeout: int) -> bytes:
    errors: list[str] = []
    for loader in (fetch_with_urllib, fetch_with_curl):
        try:
            return loader(url, timeout)
        except Exception as error:
            errors.append(f"{loader.__name__}: {error}")
    raise RuntimeError("; ".join(errors))


def request_url(parameters: dict[str, Any]) -> str:
    return f"{WFS_URL}?{urllib.parse.urlencode(parameters)}"


def capabilities(timeout: int) -> list[str]:
    raw = fetch_bytes(request_url({
        "service": "WFS",
        "version": "1.0.0",
        "request": "GetCapabilities",
    }), timeout)
    root = ET.fromstring(raw)
    layers: list[str] = []
    for feature_type in root.iter():
        if feature_type.tag.rsplit("}", 1)[-1].lower() != "featuretype":
            continue
        for child in feature_type:
            if child.tag.rsplit("}", 1)[-1].lower() == "name" and child.text:
                layers.append(child.text.strip())
                break
    return layers


def layer_payload(layer: str, timeout: int) -> dict[str, Any] | None:
    formats = ("application/json", "json")
    for output_format in formats:
        url = request_url({
            "service": "WFS",
            "version": "1.0.0",
            "request": "GetFeature",
            "typeName": layer,
            "maxFeatures": 10000,
            "outputFormat": output_format,
            "srsName": "EPSG:4326",
        })
        try:
            raw = fetch_bytes(url, timeout)
            payload = international.jsonish(raw)
            if isinstance(payload, dict) and isinstance(payload.get("features"), list):
                return payload
        except Exception as error:
            print(f"SCT layer {layer} ({output_format}) skipped: {error}", file=sys.stderr)
    return None


def loader(timeout: int = 60):
    advertised = capabilities(timeout)
    discovered = [
        name for name in advertised
        if any(token in name.lower() for token in ("camer", "camara", "cctv", "webcam"))
    ]
    explicit = [
        "cite:mct2_cameres", "cite:mct2_cameras", "cite:mct2_camera",
        "cite:mct2_cctv", "mct2_cameres",
    ]
    layers = list(dict.fromkeys(discovered + explicit))
    print(f"SCT advertised layers: {len(advertised)}; camera candidates: {layers}", file=sys.stderr)

    seen: set[str] = set()
    for layer in layers:
        payload = layer_payload(layer, timeout)
        if not payload:
            continue
        for feature in payload.get("features", []):
            if not isinstance(feature, dict):
                continue
            geometry = feature.get("geometry") or {}
            pair = international.wgs84_pair(geometry.get("coordinates"))
            if not pair:
                continue
            longitude, latitude = pair
            properties = feature.get("properties") or {}
            if not isinstance(properties, dict):
                properties = {}
            external_id = international.text_value(feature.get("id")) or international.property_text(
                properties, ("id", "codi", "codigo", "camera_id", "id_camera", "id_camara")
            )
            if not external_id:
                external_id = f"{latitude:.6f}:{longitude:.6f}"
            unique_id = f"{layer}|{external_id}"
            if unique_id in seen:
                continue
            seen.add(unique_id)

            road = international.property_text(properties, ("carretera", "road", "via", "codi_carretera"))
            pk = international.property_text(properties, ("pk", "punt_quilometric", "kilometre", "kilometro"))
            title = international.property_text(
                properties,
                ("nom", "name", "title", "denominacio", "descripcion", "descripcio"),
                f"SCT camera {external_id}",
            )
            locality = international.property_text(
                properties, ("municipi", "municipality", "localitat", "poblacio")
            )
            snapshot = international.find_image_url(properties, WFS_URL)
            yield {
                "external_id": unique_id,
                "title": f"SCT · {title}",
                "description": " · ".join(filter(None, (road, f"PK {pk}" if pk else ""))) or None,
                "country_code": "ES",
                "country_name": "España",
                "region": "Cataluña",
                "province": international.property_text(properties, ("provincia", "province")) or None,
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


def main() -> int:
    with closing(base.ensure_database()) as connection:
        international.register_providers(connection)
        report = base.run_provider(connection, "SCT_CAT", loader)
        base.export_catalog(connection, [report])
        count = connection.execute(
            "SELECT COUNT(*) FROM camera_catalog WHERE active=1 AND provider_code='SCT_CAT'"
        ).fetchone()[0]
    print(f"SCT cameras stored: {count}")
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report.get("status") == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
