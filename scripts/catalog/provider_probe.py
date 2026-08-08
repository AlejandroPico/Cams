#!/usr/bin/env python3
"""Sonda de los proveedores caidos: prueba endpoints candidatos y muestra su forma.

No escribe en SQLite ni en el catalogo. Sirve para elegir el endpoint correcto de
cada proveedor roto antes de escribir su adaptador, en lugar de desplegar a ciegas.
"""
from __future__ import annotations

import json
import ssl
import sys
import urllib.error
import urllib.request

UA = "CamsCatalogBot/4.3 (+https://github.com/AlejandroPico/Cams)"


def fetch(url: str, timeout: int = 40, insecure: bool = False, headers: dict | None = None) -> tuple[int, bytes, str]:
    h = {"User-Agent": UA, "Accept": "application/json,application/xml,text/xml,*/*"}
    if headers:
        h.update(headers)
    ctx = ssl._create_unverified_context() if insecure else None
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        return r.status, r.read(), r.headers.get("Content-Type", "")


def try_endpoint(label: str, url: str, **kw) -> bytes | None:
    try:
        status, body, ctype = fetch(url, **kw)
        print(f"  [OK {status}] {label}")
        print(f"      {url[:120]}")
        print(f"      Content-Type: {ctype} | {len(body)} bytes")
        return body
    except urllib.error.HTTPError as exc:
        print(f"  [HTTP {exc.code}] {label} -> {url[:110]}")
    except Exception as exc:
        print(f"  [FALLO] {label}: {type(exc).__name__}: {str(exc)[:130]}")
        print(f"      {url[:120]}")
    return None


def show_json(body: bytes, keys: int = 2) -> None:
    try:
        data = json.loads(body.decode("utf-8-sig"))
    except Exception as exc:
        print(f"      (no es JSON valido: {exc})")
        return
    if isinstance(data, dict):
        print(f"      claves: {list(data)[:12]}")
        for candidate in ("features", "cameras", "Cameras", "results", "items"):
            if isinstance(data.get(candidate), list) and data[candidate]:
                print(f"      {candidate}: {len(data[candidate])} elementos")
                print("      ejemplo:", json.dumps(data[candidate][0], ensure_ascii=False)[:900])
                return
        print("      ejemplo:", json.dumps(data, ensure_ascii=False)[:700])
    elif isinstance(data, list) and data:
        print(f"      lista de {len(data)} elementos")
        print("      ejemplo:", json.dumps(data[0], ensure_ascii=False)[:900])


def show_xml(body: bytes) -> None:
    import xml.etree.ElementTree as ET
    try:
        root = ET.fromstring(body)
    except Exception as exc:
        print(f"      (XML no parseable: {exc})")
        print("      crudo:", body[:400])
        return
    print(f"      raiz: <{root.tag}> con {len(root)} hijos")
    if len(root):
        first = root[0]
        print(f"      primer hijo: <{first.tag}> con {len(first)} campos")
        for child in list(first)[:20]:
            texto = (child.text or "").strip()[:70]
            print(f"        {child.tag}: {texto!r} {child.attrib if child.attrib else ''}")


def main() -> int:
    print("=" * 74)
    print("SCT / Transit Catalunya  (ahora da 403 en el WFS de mct.gencat.cat)")
    print("=" * 74)
    body = try_endpoint("XML oficial de dades obertes", "http://www.gencat.cat/transit/opendata/cameres.xml")
    if body:
        show_xml(body)
    body = try_endpoint("XML por HTTPS", "https://www.gencat.cat/transit/opendata/cameres.xml")
    if body:
        show_xml(body)
    try_endpoint("KML oficial", "http://www.gencat.cat/transit/opendata/cameres.kml")

    print()
    print("=" * 74)
    print("WSDOT Washington  (ahora da 404)")
    print("=" * 74)
    body = try_endpoint(
        "ArcGIS publico sin clave",
        "https://www.wsdot.wa.gov/arcgis/rest/services/Production/WSDOTTrafficCameras/MapServer/0/"
        "query?where=1%3D1&outFields=*&outSR=4326&returnGeometry=true&f=json&resultRecordCount=3",
    )
    if body:
        show_json(body)
    try_endpoint("Endpoint antiguo del adaptador", "https://data.wsdot.wa.gov/log/public/cameras.json")

    print()
    print("=" * 74)
    print("Bruxelles Mobilite  (certificado que no coincide con el dominio)")
    print("=" * 74)
    for label, url in [
        ("dominio actual, HTTPS estricto", "https://www.bruxellesmobilite.irisnet.be/cameras/json/fr/"),
        ("dominio nuevo mobilite.brussels", "https://mobilite-mobiliteit.brussels/cameras/json/fr/"),
        ("portal open data de Bruselas", "https://data.mobility.brussels/traffic/api/camera/?request=list"),
    ]:
        b = try_endpoint(label, url)
        if b:
            show_json(b)
    b = try_endpoint("dominio actual, sin verificar certificado", "https://www.bruxellesmobilite.irisnet.be/cameras/json/fr/", insecure=True)
    if b:
        show_json(b)

    print()
    print("=" * 74)
    print("Autobahn Alemania  (responde 200 pero con cero webcams)")
    print("=" * 74)
    b = try_endpoint("lista de autopistas", "https://verkehr.autobahn.de/o/autobahn/")
    roads = []
    if b:
        try:
            roads = json.loads(b)["roads"][:4]
            print(f"      autopistas: {len(json.loads(b)['roads'])}, muestra {roads}")
        except Exception as exc:
            print(f"      no se pudo leer la lista: {exc}")
    for road in roads:
        b = try_endpoint(f"webcams de {road}", f"https://verkehr.autobahn.de/o/autobahn/{road}/services/webcam")
        if b:
            show_json(b)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
