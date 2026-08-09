#!/usr/bin/env python3
"""Sonda de fuentes autonomicas espanolas de camaras.

Espana sale desproporcionadamente sesgada hacia trafico: 2.582 camaras de carretera
frente a 1.010 de todo lo demas. No es un fallo del pipeline sino una asimetria de
los datos: Windy publica 1.070 camaras activas en Espana frente a 2.875 en Italia o
2.750 en Austria. La via para equilibrarlo es incorporar fuentes autonomicas.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

UA = "CamsCatalogBot/4.3 (+https://github.com/AlejandroPico/Cams)"

CANDIDATOS = [
    # Euskadi: en la pasada anterior dio timeout. Se prueban las dos rutas conocidas.
    ("Euskadi camaras trafico", "https://api.euskadi.eus/traffic/v1.0/cameras?_page=1"),
    ("Euskadi camaras (opendata)", "https://opendata.euskadi.eus/contenidos/ds_recursos_tecnicos/camaras_trafico/opendata/cameras.json"),
    ("Euskalmet estaciones", "https://api.euskadi.eus/euskalmet/stations/"),

    # Navarra: el catalogo CKAN respondio; ahora se buscan los recursos concretos.
    ("Navarra CKAN camaras", "https://datosabiertos.navarra.es/api/3/action/package_search?q=c%C3%A1maras&rows=20"),
    ("Navarra CKAN webcam", "https://datosabiertos.navarra.es/api/3/action/package_search?q=webcam&rows=20"),

    # Aragon: la vista que probe antes devolvia datos electorales. Se busca la buena.
    ("Aragon catalogo (busqueda)", "https://opendata.aragon.es/GA_OD_Core/api/dataset_list?formato=json&titulo=camara"),

    # Baleares y Canarias, sobre Socrata y CKAN respectivamente.
    ("Illes Balears busqueda", "https://catalegdades.caib.cat/api/catalog/v1?q=cameres&limit=20"),
    ("Canarias CKAN camaras", "https://datos.canarias.es/catalogos/general/api/3/action/package_search?q=camaras&rows=20"),

    # Puertos y meteorologia: candidatos a camaras panoramicas no viales.
    ("Puertos del Estado", "https://portus.puertos.es/portussvr/api/stations"),
    ("AEMET catalogo abierto", "https://opendata.aemet.es/centrodedescargas/productosAEMET"),

    # datos.gob.es sirve de buscador general de todo el pais.
    ("datos.gob.es titulo camaras", "https://datos.gob.es/apidata/catalog/dataset/title/camaras.json?_pageSize=50&_page=0"),
    ("datos.gob.es titulo webcam", "https://datos.gob.es/apidata/catalog/dataset/title/webcam.json?_pageSize=50&_page=0"),
]


def probar(nombre: str, url: str) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            cuerpo = r.read()
            ctype = r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as exc:
        print(f"  [HTTP {exc.code}] {nombre}")
        return
    except Exception as exc:
        print(f"  [FALLO] {nombre}: {type(exc).__name__}: {str(exc)[:110]}")
        return

    print(f"  [OK] {nombre}")
    print(f"       {url[:115]}")
    print(f"       {ctype} | {len(cuerpo)} bytes")
    try:
        data = json.loads(cuerpo.decode("utf-8-sig"))
    except Exception:
        print(f"       (no es JSON) {cuerpo[:180]}")
        return

    # Los catalogos CKAN y datos.gob.es devuelven listas de datasets: interesa el
    # titulo y la URL de descarga de cada uno, no la estructura del sobre.
    if isinstance(data, dict):
        resultados = (data.get("result") or {})
        listado = resultados.get("results") if isinstance(resultados, dict) else None
        if isinstance(listado, list) and listado:
            print(f"       {len(listado)} datasets:")
            for ds in listado[:8]:
                titulo = ds.get("title") or ds.get("notes") or ds.get("name")
                if isinstance(titulo, dict):
                    titulo = titulo.get("es") or titulo.get("eu") or next(iter(titulo.values()), "")
                print(f"         - {str(titulo)[:80]}")
                for rec in (ds.get("resources") or [])[:3]:
                    print(f"             {rec.get('format','?'):6} {str(rec.get('url'))[:105]}")
            return
        items = resultados.get("items") if isinstance(resultados, dict) else None
        if isinstance(items, list) and items:
            print(f"       {len(items)} datasets:")
            for ds in items[:10]:
                t = ds.get("title")
                if isinstance(t, list): t = " / ".join(str(x.get("_value", x)) for x in t[:2])
                print(f"         - {str(t)[:90]}")
            return
        print(f"       claves: {list(data)[:12]}")
        for c in ("camaras", "cameras", "items", "result", "features", "results", "listaCamaras"):
            v = data.get(c)
            if isinstance(v, list) and v:
                print(f"       {c}: {len(v)} elementos")
                print(f"       ejemplo: {json.dumps(v[0], ensure_ascii=False)[:600]}")
                return
            if isinstance(v, dict):
                print(f"       {c}: dict con {list(v)[:8]}")
        print(f"       muestra: {json.dumps(data, ensure_ascii=False)[:500]}")
    elif isinstance(data, list) and data:
        print(f"       lista de {len(data)}")
        print(f"       ejemplo: {json.dumps(data[0], ensure_ascii=False)[:600]}")


def main() -> int:
    print("=" * 74)
    print("FUENTES AUTONOMICAS ESPANOLAS DE CAMARAS")
    print("=" * 74)
    for nombre, url in CANDIDATOS:
        probar(nombre, url)
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
