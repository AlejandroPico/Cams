#!/usr/bin/env python3
"""Sonda de diagnostico de la Webcams API de Windy.

No escribe en SQLite ni en el catalogo. Solo pide unas pocas camaras y muestra la
forma real de la respuesta para poder construir el adaptador sobre datos observados
en lugar de sobre suposiciones. La clave se lee del entorno y nunca se imprime.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ENDPOINT = "https://api.windy.com/webcams/api/v3/webcams"
INCLUDE = "categories,images,location,player,urls"


def request(key: str, params: dict[str, str]) -> dict:
    url = f"{ENDPOINT}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={
        "x-windy-api-key": key,
        "Accept": "application/json",
        "User-Agent": "CamsCatalogBot/4.3 (+https://github.com/AlejandroPico/Cams)",
    })
    with urllib.request.urlopen(req, timeout=40) as response:
        return json.loads(response.read().decode("utf-8"))


def shape(value, depth: int = 0):
    """Describe la estructura sin volcar el contenido completo."""
    pad = "  " * depth
    if isinstance(value, dict):
        return "{\n" + "".join(
            f"{pad}  {k}: {shape(v, depth + 1)}\n" for k, v in value.items()
        ) + pad + "}"
    if isinstance(value, list):
        if not value:
            return "[] (vacio)"
        return f"[{len(value)} elementos] primero -> {shape(value[0], depth)}"
    if isinstance(value, str):
        return f"str = {value[:110]!r}"
    return f"{type(value).__name__} = {value!r}"


def main() -> int:
    key = os.getenv("WINDY_WEBCAMS_KEY", "").strip()
    if not key:
        print("ERROR: falta el secreto WINDY_WEBCAMS_KEY", file=sys.stderr)
        return 1

    print("=" * 70)
    print("1) Consulta general: 2 camaras, sin filtro")
    print("=" * 70)
    try:
        payload = request(key, {"include": INCLUDE, "lang": "en", "limit": "2"})
    except urllib.error.HTTPError as exc:
        print(f"HTTP {exc.code}: {exc.read()[:400].decode('utf-8', 'replace')}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Fallo: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    print("Claves de primer nivel:", list(payload))
    print("Total declarado:", payload.get("total"))
    webcams = payload.get("webcams") or []
    if webcams:
        print("\nESTRUCTURA DE UNA CAMARA:")
        print(shape(webcams[0]))
        print("\nEJEMPLO COMPLETO (json):")
        print(json.dumps(webcams[0], ensure_ascii=False, indent=2)[:2500])

    print()
    print("=" * 70)
    print("2) Filtro por pais y limite maximo por pagina")
    print("=" * 70)
    for limit in ("50", "100"):
        try:
            es = request(key, {"include": "location", "lang": "en", "limit": limit, "countries": "ES"})
            print(f"limit={limit} -> devueltas {len(es.get('webcams') or [])}, total ES={es.get('total')}")
        except urllib.error.HTTPError as exc:
            print(f"limit={limit} -> HTTP {exc.code}")

    print()
    print("=" * 70)
    print("3) Tope real de offset en plan gratuito")
    print("=" * 70)
    for offset in ("0", "990", "1000", "1050"):
        try:
            r = request(key, {"include": "location", "lang": "en", "limit": "10", "offset": offset, "countries": "ES"})
            print(f"offset={offset} -> OK, {len(r.get('webcams') or [])} camaras")
        except urllib.error.HTTPError as exc:
            print(f"offset={offset} -> HTTP {exc.code} (tope alcanzado)")

    print()
    print("=" * 70)
    print("4) Catalogo de categorias disponibles")
    print("=" * 70)
    try:
        cats = request(key, {})
    except Exception:
        cats = None
    try:
        url = "https://api.windy.com/webcams/api/v3/categories"
        req = urllib.request.Request(url, headers={"x-windy-api-key": key, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(json.dumps(json.loads(resp.read().decode("utf-8")), ensure_ascii=False)[:1200])
    except Exception as exc:
        print(f"No disponible: {type(exc).__name__}: {exc}")

    probe_partitioning(key)
    return 0


def probe_partitioning(key: str) -> None:
    """Busca una forma de subdividir por zona los paises que no caben por categoria."""
    print()
    print("=" * 70)
    print("5) Cuanto se pierde con el troceado actual")
    print("=" * 70)
    for country in ("US", "IT", "AT", "DE", "FR", "GB", "ES"):
        try:
            total = request(key, {"limit": "1", "countries": country})["total"]
        except Exception as exc:
            print(f"{country}: fallo {exc}")
            continue
        suma = 0
        topes = []
        for cat in ["airport","beach","building","city","coast","forest","indoor","lake",
                    "landscape","meteo","mountain","observatory","port","river","sportArea",
                    "square","traffic","village"]:
            try:
                n = request(key, {"limit": "1", "countries": country, "categories": cat})["total"]
            except Exception:
                continue
            suma += n
            if n > 1050:
                topes.append(f"{cat}={n}")
        print(f"{country}: total={total}  suma por categoria={suma}  categorias que revientan el tope: {topes or 'ninguna'}")

    print()
    print("=" * 70)
    print("6) Parametros de area admitidos")
    print("=" * 70)
    candidatos = [
        ("nearby", "41.39,2.16,50"),
        ("bbox", "40.0,1.0,42.0,3.0"),
        ("northEast,southWest", None),
        ("region", "ES.56"),
        ("regions", "ES.56"),
        ("continents", "EU"),
    ]
    for nombre, valor in candidatos:
        if nombre == "northEast,southWest":
            params = {"limit": "1", "northEast": "42.0,3.0", "southWest": "40.0,1.0"}
        else:
            params = {"limit": "1", nombre: valor}
        try:
            r = request(key, params)
            print(f"  {nombre:22} ACEPTADO  total={r.get('total')}")
        except urllib.error.HTTPError as exc:
            print(f"  {nombre:22} HTTP {exc.code}")
        except Exception as exc:
            print(f"  {nombre:22} {type(exc).__name__}")


if __name__ == "__main__":
    raise SystemExit(main())
