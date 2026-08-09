#!/usr/bin/env python3
"""Comprueba que las imagenes de las camaras cargan de verdad.

Hasta ahora el estado 'online' solo significaba que el proveedor listaba la camara,
no que su imagen existiera. Este comprobador la descarga y distingue tres cosas que
antes se confundian:

  - la imagen carga;
  - la fuente responde pero no sirve la imagen (retirada, error, pagina de aviso);
  - la fuente bloquea el enlace desde terceros, es decir exige su propio Referer.

Ese ultimo caso importa porque son camaras que funcionan perfectamente en la web del
organismo y solo fallan al mostrarlas desde GitHub Pages. Marcarlas como caidas seria
culpar al proveedor equivocado, y ademas son recuperables: basta con enlazar a su
pagina en lugar de intentar incrustar la imagen.

Trabaja por muestreo y prioriza lo mas util: primero lo que nunca se ha comprobado y
despues lo mas antiguo, de modo que varias pasadas cubren el catalogo entre todas.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import sqlite3
import ssl
import sys
import time
import urllib.error
import urllib.request
from contextlib import closing
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "catalog"))
import build_catalog as base  # noqa: E402

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 CamsCatalogBot/4.3"
TIMEOUT = 20

# Firmas de los formatos de imagen mas habituales. Comprobar la cabecera evita dar
# por buena una pagina de error que se sirve con Content-Type de imagen.
FIRMAS = (b"\xff\xd8\xff", b"\x89PNG\r\n", b"GIF87a", b"GIF89a", b"RIFF", b"BM")

MINIMO_BYTES = 1024


def descargar(url: str, referer: str | None = None) -> tuple[int, bytes, str]:
    cabeceras = {"User-Agent": UA, "Accept": "image/*,*/*"}
    if referer:
        cabeceras["Referer"] = referer
    peticion = urllib.request.Request(url, headers=cabeceras)
    contexto = ssl.create_default_context()
    contexto.check_hostname = False
    contexto.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(peticion, timeout=TIMEOUT, context=contexto) as respuesta:
        return respuesta.status, respuesta.read(MINIMO_BYTES * 40), respuesta.headers.get("Content-Type", "")


def es_imagen(cuerpo: bytes, content_type: str) -> bool:
    if len(cuerpo) < MINIMO_BYTES:
        return False
    if cuerpo.startswith(FIRMAS):
        return True
    # Algunos servidores anteponen espacios o BOM antes del JPEG.
    recorte = cuerpo.lstrip()[:16]
    if recorte.startswith(FIRMAS):
        return True
    return content_type.lower().startswith("image/") and b"<html" not in cuerpo[:400].lower()


def comprobar(camara: dict) -> dict:
    url = camara["snapshot_url"]
    origen = camara.get("source_page_url") or ""

    try:
        estado, cuerpo, tipo = descargar(url)
    except urllib.error.HTTPError as exc:
        # Un 403 puede ser bloqueo de enlace: se reintenta con el Referer del origen.
        if exc.code in (401, 403) and origen:
            try:
                estado, cuerpo, tipo = descargar(url, referer=origen)
                if es_imagen(cuerpo, tipo):
                    return {"id": camara["id"], "estado": "blocked",
                            "motivo": "La fuente exige su propio Referer; no se puede incrustar"}
            except Exception:
                pass
        return {"id": camara["id"], "estado": "offline", "motivo": f"HTTP {exc.code}"}
    except Exception as exc:  # noqa: BLE001
        return {"id": camara["id"], "estado": "offline", "motivo": f"{type(exc).__name__}"}

    if estado != 200:
        return {"id": camara["id"], "estado": "offline", "motivo": f"HTTP {estado}"}
    if es_imagen(cuerpo, tipo):
        return {"id": camara["id"], "estado": "online", "motivo": None}
    return {"id": camara["id"], "estado": "offline",
            "motivo": f"La respuesta no es una imagen ({tipo or 'sin tipo'})"}


def seleccionar(connection: sqlite3.Connection, limite: int) -> list[dict]:
    filas = connection.execute(
        "SELECT id, snapshot_url, source_page_url FROM cameras "
        "WHERE active=1 AND is_public=1 AND media_type IN ('snapshot','image') "
        "AND snapshot_url IS NOT NULL AND TRIM(snapshot_url)<>'' "
        # Primero lo nunca comprobado y despues lo mas antiguo, para que varias
        # pasadas cubran el catalogo entre todas.
        "ORDER BY image_checked_at IS NOT NULL, image_checked_at ASC LIMIT ?",
        (limite,),
    ).fetchall()
    return [dict(fila) for fila in filas]


def preparar_columnas(connection: sqlite3.Connection) -> None:
    existentes = {fila[1] for fila in connection.execute("PRAGMA table_info(cameras)")}
    for columna, tipo in (("image_checked_at", "TEXT"), ("image_status", "TEXT"), ("image_reason", "TEXT")):
        if columna not in existentes:
            connection.execute(f"ALTER TABLE cameras ADD COLUMN {columna} {tipo}")
    connection.commit()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=int(os.getenv("VERIFY_LIMIT", "1500")))
    parser.add_argument("--workers", type=int, default=12)
    argumentos = parser.parse_args()

    with closing(base.ensure_database()) as connection:
        connection.row_factory = sqlite3.Row
        preparar_columnas(connection)
        muestra = seleccionar(connection, argumentos.limit)
        if not muestra:
            print("No hay snapshots que comprobar")
            return 0

        print(f"Comprobando {len(muestra)} snapshots con {argumentos.workers} hilos")
        inicio = time.monotonic()
        resultados = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=argumentos.workers) as pool:
            for resultado in pool.map(comprobar, muestra):
                resultados.append(resultado)

        ahora = base.NOW()
        recuento = {"online": 0, "offline": 0, "blocked": 0}
        for resultado in resultados:
            recuento[resultado["estado"]] += 1
            connection.execute(
                "UPDATE cameras SET image_status=?, image_reason=?, image_checked_at=? WHERE id=?",
                (resultado["estado"], resultado["motivo"], ahora, resultado["id"]),
            )
            # El estado publicado solo se degrada cuando la comprobacion es
            # concluyente. Una caida puntual no debe esconder una camara buena, asi
            # que se exige que ya viniese marcada como no disponible o que el fallo
            # sea de bloqueo, que es estable.
            if resultado["estado"] == "blocked":
                connection.execute(
                    "UPDATE cameras SET status='blocked', status_reason=? WHERE id=?",
                    (resultado["motivo"], resultado["id"]),
                )
        connection.commit()

        segundos = time.monotonic() - inicio
        total_comprobadas = connection.execute(
            "SELECT COUNT(*) FROM cameras WHERE image_checked_at IS NOT NULL"
        ).fetchone()[0]
        pendientes = connection.execute(
            "SELECT COUNT(*) FROM cameras WHERE active=1 AND media_type IN ('snapshot','image') "
            "AND image_checked_at IS NULL"
        ).fetchone()[0]

    print(json.dumps({
        "comprobadas": len(resultados), **recuento,
        "segundos": round(segundos, 1),
        "acumuladas": total_comprobadas, "pendientes": pendientes,
    }, ensure_ascii=False))
    porcentaje = 100 * recuento["online"] / max(len(resultados), 1)
    print(f"Imagenes que cargan: {porcentaje:.1f}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
