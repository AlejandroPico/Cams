#!/usr/bin/env python3
"""Importador del Servei Català de Trànsit.

El WFS de mct.gencat.cat que se usaba antes lleva tiempo devolviendo 403 a las
peticiones automatizadas. La Generalitat publica el mismo inventario como fichero
abierto en gencat.cat, que responde con normalidad y no exige artificios de TLS:

    http://www.gencat.cat/transit/opendata/cameres.xml

Es un FeatureCollection de WFS con un elemento por camara y estos campos:
geom (gml:Point), carretera, municipi, pk, link y font.
"""
from __future__ import annotations

import json
import math
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from contextlib import closing
from typing import Any, Iterable

import build_catalog as base

FEED_URLS = (
    "https://www.gencat.cat/transit/opendata/cameres.xml",
    "http://www.gencat.cat/transit/opendata/cameres.xml",
)
HEADERS = {
    "User-Agent": "CamsCatalogBot/4.3 (+https://github.com/AlejandroPico/Cams)",
    "Accept": "application/xml,text/xml,*/*",
}
NS_GML = "{http://www.opengis.net/gml}"


def local(tag: str) -> str:
    return tag.split("}")[-1]


def fetch() -> bytes:
    ultimo: Exception | None = None
    for url in FEED_URLS:
        try:
            request = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read()
        except Exception as exc:  # noqa: BLE001
            ultimo = exc
            print(f"SCT: {url} fallo ({type(exc).__name__}: {exc})", file=sys.stderr)
    raise RuntimeError(f"Ningun endpoint del SCT respondio: {ultimo}")


def utm31n_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """Convierte UTM huso 31N (ETRS89) a latitud y longitud.

    Catalunya se publica habitualmente en este huso. Se implementa aqui para no
    anadir una dependencia externa al pipeline.
    """
    a, f = 6378137.0, 1 / 298.257222101
    e2 = f * (2 - f)
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    k0, x, y = 0.9996, easting - 500000.0, northing
    m = y / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
            + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
            + (151 * e1**3 / 96) * math.sin(6 * mu))
    ep2 = e2 / (1 - e2)
    c1 = ep2 * math.cos(phi1) ** 2
    t1 = math.tan(phi1) ** 2
    n1 = a / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    r1 = a * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    d = x / (n1 * k0)
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d**2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * ep2) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * ep2 - 3 * c1**2) * d**6 / 720)
    lon = (d - (1 + 2 * t1 + c1) * d**3 / 6
           + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * ep2 + 24 * t1**2) * d**5 / 120) / math.cos(phi1)
    return math.degrees(lat), math.degrees(lon) + 3.0  # meridiano central del huso 31


def coordinates(punto: ET.Element) -> tuple[float, float] | None:
    """Extrae latitud y longitud de un gml:Point, sea cual sea su proyeccion."""
    texto = ""
    for etiqueta in ("coordinates", "pos"):
        nodo = punto.find(f"{NS_GML}{etiqueta}")
        if nodo is not None and (nodo.text or "").strip():
            texto = nodo.text.strip()
            break
    if not texto:
        return None

    numeros = [float(v) for v in re.split(r"[,\s]+", texto) if v]
    if len(numeros) < 2:
        return None
    primero, segundo = numeros[0], numeros[1]

    # Proyectado en metros: se convierte desde UTM 31N.
    if abs(primero) > 180 or abs(segundo) > 180:
        easting, northing = (primero, segundo) if primero < segundo else (segundo, primero)
        lat, lon = utm31n_to_wgs84(easting, northing)
    else:
        # Grados. gml:coordinates suele venir como lon,lat y gml:pos como lat,lon.
        lon, lat = (primero, segundo) if abs(primero) <= 90 and abs(segundo) <= 90 and abs(primero) < abs(segundo) else (primero, segundo)
        if not (-90 <= lat <= 90):
            lat, lon = lon, lat

    # Catalunya cabe holgadamente en este rectangulo. Sirve de comprobacion de que
    # la proyeccion se ha interpretado bien, en lugar de publicar puntos absurdos.
    if not (40.0 <= lat <= 43.5 and 0.0 <= lon <= 3.5):
        return None
    return lat, lon


def sct_loader() -> Iterable[dict[str, Any]]:
    raiz = ET.fromstring(fetch())
    total = descartadas = 0

    for miembro in raiz:
        if local(miembro.tag) == "boundedBy":
            continue
        for camara in ([miembro] if local(miembro.tag) == "cameres" else list(miembro)):
            if local(camara.tag) != "cameres":
                continue
            total += 1
            campos = {local(c.tag): c for c in camara}

            punto = campos.get("geom")
            punto = punto.find(f"{NS_GML}Point") if punto is not None else None
            par = coordinates(punto) if punto is not None else None
            if not par:
                descartadas += 1
                continue
            lat, lon = par

            enlace = (campos["link"].text or "").strip() if "link" in campos else ""
            if not enlace:
                descartadas += 1
                continue

            carretera = (campos["carretera"].text or "").strip() if "carretera" in campos else ""
            municipi = (campos["municipi"].text or "").strip() if "municipi" in campos else ""
            pk = (campos["pk"].text or "").strip() if "pk" in campos else ""

            # El identificador estable va dentro del enlace: sctidcam=nc87.gif
            marca = re.search(r"sctidcam=([^&\s]+)", enlace)
            identificador = marca.group(1).replace(".gif", "") if marca else f"{carretera}:{pk}"

            titulo = " ".join(x for x in (carretera, municipi) if x) or f"Camera SCT {identificador}"
            if pk:
                titulo = f"{titulo} (PK {pk})"

            yield {
                "external_id": identificador,
                "title": titulo,
                "description": f"{carretera} PK {pk}" if carretera and pk else None,
                "country_code": "ES",
                "country_name": "España",
                "region": "Cataluña",
                "city": municipi.title() or None,
                "latitude": lat,
                "longitude": lon,
                "timezone": "Europe/Madrid",
                "category": "traffic",
                "media_type": "snapshot",
                "snapshot_url": enlace,
                "source_page_url": "https://www.gencat.cat/transit/",
                "refresh_seconds": 300,
                "status": "online",
                "attribution": "Servei Català de Trànsit",
                "license_name": "Dades obertes de la Generalitat de Catalunya",
                "license_url": "https://administraciodigital.gencat.cat/ca/dades/dades-obertes/informacio-practica/llicencies/",
                "privacy_level": "public-traffic",
            }

    print(f"SCT: {total} elementos leidos, {descartadas} descartados", file=sys.stderr)


def main() -> int:
    provider = {
        "code": "SCT_CAT",
        "name": "Servei Català de Trànsit",
        "homepage_url": "https://www.gencat.cat/transit/",
        "api_url": FEED_URLS[0],
        "country_code": "ES",
        "attribution": "Servei Català de Trànsit",
        "license_name": "Dades obertes de la Generalitat de Catalunya",
        "license_url": "https://administraciodigital.gencat.cat/ca/dades/dades-obertes/informacio-practica/llicencies/",
        "refresh_seconds": 300,
        "enabled": 1,
        "notes": "Fichero abierto de gencat.cat. Sustituye al WFS de mct.gencat.cat, que devuelve 403 a peticiones automatizadas.",
    }

    with closing(base.ensure_database()) as connection:
        columnas = list(provider)
        updates = ",".join(f"{c}=excluded.{c}" for c in columnas if c != "code")
        connection.execute(
            f"INSERT INTO providers ({','.join(columnas)}) VALUES ({','.join(f':{c}' for c in columnas)}) "
            f"ON CONFLICT(code) DO UPDATE SET {updates}", provider,
        )
        connection.commit()
        report = base.run_provider(connection, "SCT_CAT", sct_loader)
        base.export_catalog(connection, [report])

    print(json.dumps(report, ensure_ascii=False))
    return 0 if report.get("status") == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
