#!/usr/bin/env python3
"""Importa la Webcams API de Windy: camaras de calle, paisaje y turismo mundiales.

Complementa las redes de trafico oficiales, que solo cubren carreteras. La clave se
lee del entorno (WINDY_WEBCAMS_KEY) y nunca se escribe en SQLite, JSON ni commits.

Restricciones reales del plan gratuito, medidas con scripts/catalog/windy_probe.py:

- limit maximo por pagina: 50 (100 devuelve HTTP 400);
- offset maximo: 1000 (1050 devuelve HTTP 400).

Es decir, ninguna consulta puede recorrer mas de 1050 registros. Como hay paises que
superan ese tope por si solos (Espana declara 1430), se trocea primero por pais y,
cuando el pais no cabe, por pais y categoria.

Las URLs de imagen que devuelve la API estan protegidas por tokens que caducan a los
10 minutos en el plan gratuito, asi que no se pueden guardar en un catalogo estatico
regenerado cada pocas horas: devolverian 401. Se guarda el reproductor embebido
(player.day), que es estable, y que ademas satisface la condicion de Windy de
enlazar cada imagen con su ficha o su reproductor.
"""
from __future__ import annotations

import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from contextlib import closing
from pathlib import Path
from typing import Any, Iterable

import build_catalog as base

ENDPOINT = "https://api.windy.com/webcams/api/v3/webcams"
INCLUDE = "categories,location,player,urls"
PAGE_LIMIT = 50
MAX_OFFSET = 1000
PAGE_PAUSE = float(os.getenv("WINDY_PAUSE", "0.10"))
MAX_REQUESTS = int(os.getenv("WINDY_MAX_REQUESTS", "20000"))

# Presupuesto de tiempo. El recorrido completo son del orden de 8.000 peticiones y
# puede pasar de la hora. Si el trabajo se queda sin tiempo y lo mata el runner, se
# pierde todo sin dejar rastro. Es preferible parar por las buenas, guardar lo
# recogido y continuar en la siguiente pasada por donde se quedo.
TIME_BUDGET_S = float(os.getenv("WINDY_TIME_BUDGET_MIN", "150")) * 60

# Fichero con el pais por el que continuar. Permite que varias pasadas completen el
# catalogo entre todas en lugar de reintentar siempre el mismo recorrido.
RESUME_PATH = Path(__file__).resolve().parents[2] / "data" / "windy-resume.txt"

# Categorias publicadas por la API. Se usan para subdividir los paises que no caben
# en una sola consulta.
WINDY_CATEGORIES = [
    "airport", "beach", "building", "city", "coast", "forest", "indoor", "lake",
    "landscape", "meteo", "mountain", "observatory", "port", "river", "sportArea",
    "square", "traffic", "village",
]

# Traduccion a la taxonomia del catalogo propio.
CATEGORY_MAP = {
    "traffic": "traffic",
    "meteo": "weather",
    "city": "city", "square": "city", "building": "city", "village": "city",
    "beach": "coast", "coast": "coast", "port": "port",
    "mountain": "mountain", "landscape": "landscape", "forest": "landscape",
    "lake": "water", "river": "water",
    "airport": "airport",
    "observatory": "observatory",
    "sportArea": "sports",
    "indoor": "indoor",
}

COUNTRIES = [
    "AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ",
    "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS",
    "BT","BV","BW","BY","BZ","CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN",
    "CO","CR","CU","CV","CW","CX","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE",
    "EG","EH","ER","ES","ET","FI","FJ","FK","FM","FO","FR","GA","GB","GD","GE","GF",
    "GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY","HK","HM",
    "HN","HR","HT","HU","ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT","JE","JM",
    "JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ","LA","LB","LC",
    "LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MF","MG","MH","MK",
    "ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ","NA",
    "NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ","OM","PA","PE","PF","PG",
    "PH","PK","PL","PM","PN","PR","PS","PT","PW","PY","QA","RE","RO","RS","RU","RW",
    "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS",
    "ST","SV","SX","SY","SZ","TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO",
    "TR","TT","TV","TW","TZ","UA","UG","UM","US","UY","UZ","VA","VC","VE","VG","VI",
    "VN","VU","WF","WS","YE","YT","ZA","ZM","ZW",
]


class Incompleta(Exception):
    """Se agoto el presupuesto de tiempo o de peticiones."""


class Budget:
    """Cuenta las peticiones para no cargar la API mas de lo razonable."""

    def __init__(self, maximum: int, deadline: float) -> None:  # noqa: F811
        self.maximum = maximum
        self.used = 0
        self.deadline = deadline

    def spend(self) -> None:
        self.used += 1
        if self.used > self.maximum:
            raise Incompleta(f"presupuesto de peticiones agotado ({self.maximum})")
        if time.monotonic() > self.deadline:
            raise Incompleta(f"presupuesto de tiempo agotado tras {self.used} peticiones")


def request(key: str, params: dict[str, str], budget: Budget, attempts: int = 3) -> dict[str, Any]:
    budget.spend()
    url = f"{ENDPOINT}?{urllib.parse.urlencode(params)}"
    headers = {
        "x-windy-api-key": key,
        "Accept": "application/json",
        "User-Agent": "CamsCatalogBot/4.3 (+https://github.com/AlejandroPico/Cams)",
    }
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code in (400, 401, 403):
                raise  # peticion mal formada o clave invalida: reintentar no arregla nada
            if exc.code == 429:
                # Limite de peticiones. Se respeta Retry-After si lo envian.
                espera = exc.headers.get("Retry-After") if exc.headers else None
                try:
                    pausa = float(espera) if espera else 5.0 * (attempt + 1)
                except ValueError:
                    pausa = 5.0 * (attempt + 1)
                print(f"Windy: limite de peticiones, esperando {pausa:.0f}s", file=sys.stderr)
                time.sleep(min(pausa, 60))
                last = exc
                continue
            last = exc
        except Exception as exc:  # noqa: BLE001 - red inestable
            last = exc
        time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Windy no respondio tras {attempts} intentos: {last}")


def count_for(key: str, params: dict[str, str], budget: Budget) -> int:
    """Numero de camaras de una particion. Devuelve 0 si la particion no existe.

    Los codigos de region se generan (CC.01 a CC.60) porque la API no publica la
    lista, asi que la mayoria no corresponden a ninguna region real y responden 400.
    Eso no es un error: significa que ahi no hay nada.
    """
    try:
        payload = request(key, {**params, "limit": "1", "include": "location"}, budget)
    except urllib.error.HTTPError as exc:
        if exc.code == 400:
            return 0
        raise
    return int(payload.get("total") or 0)


def page_through(key: str, params: dict[str, str], budget: Budget) -> Iterable[dict[str, Any]]:
    """Recorre una particion respetando el tope de offset del plan gratuito."""
    offset = 0
    while offset <= MAX_OFFSET:
        payload = request(key, {
            **params,
            "include": INCLUDE,
            "lang": "en",
            "limit": str(PAGE_LIMIT),
            "offset": str(offset),
        }, budget)
        webcams = payload.get("webcams") or []
        if not webcams:
            return
        yield from webcams
        if len(webcams) < PAGE_LIMIT:
            return
        offset += PAGE_LIMIT
        time.sleep(PAGE_PAUSE)


def normalise(webcam: dict[str, Any]) -> dict[str, Any] | None:
    if str(webcam.get("status") or "").lower() != "active":
        return None

    location = webcam.get("location") or {}
    try:
        latitude = float(location["latitude"])
        longitude = float(location["longitude"])
    except (KeyError, TypeError, ValueError):
        return None

    player = webcam.get("player") or {}
    embed = player.get("day") or player.get("month") or player.get("lifetime")
    urls = webcam.get("urls") or {}
    detail = urls.get("detail")
    if not embed or not detail:
        # Sin reproductor estable o sin ficha no se puede cumplir la condicion de
        # Windy de enlazar cada imagen con ellos, asi que no se publica.
        return None

    categories = [c.get("id") for c in (webcam.get("categories") or []) if c.get("id")]
    category = "other"
    for candidate in categories:
        if candidate in CATEGORY_MAP:
            category = CATEGORY_MAP[candidate]
            break

    webcam_id = webcam.get("webcamId")
    if webcam_id is None:
        return None

    return {
        "external_id": str(webcam_id),
        "title": str(webcam.get("title") or f"Windy webcam {webcam_id}"),
        "country_code": location.get("country_code") or None,
        "country_name": location.get("country") or None,
        "region": location.get("region") or None,
        "city": location.get("city") or None,
        "latitude": latitude,
        "longitude": longitude,
        "category": category,
        "media_type": "iframe",
        "embed_url": embed,
        "source_page_url": detail,
        # Las miniaturas de la API caducan; no se guardan en el catalogo estatico.
        "refresh_seconds": 600,
        "is_live": False,
        "is_embeddable": True,
        "status": "online",
        "last_seen_at": webcam.get("lastUpdatedOn") or None,
        "attribution": "Windy.com",
        "license_name": "Windy Webcams API Terms of Use",
        "license_url": "https://api.windy.com/webcams/terms",
        "terms_url": "https://api.windy.com/webcams/terms",
        "privacy_level": "public-landscape",
        "priority": 5,
    }


def region_codes(country: str, descubiertos: set[str]) -> list[str]:
    """Codigos de region de un pais, priorizando los observados en los datos.

    Generarlos como CC.01..CC.60 solo funciona donde GeoNames usa codigos numericos.
    En Estados Unidos son abreviaturas de estado (US.CA), asi que el troceado por
    region no encontraba nada: 0 de 31.344 camaras de trafico. Los codigos reales
    salen del campo region_code de las camaras ya vistas del mismo pais; los
    numericos quedan solo como complemento para paises poco muestreados.
    """
    reales = sorted(c for c in descubiertos if c.startswith(f"{country}."))
    numericos = [f"{country}.{n:02d}" for n in range(1, 61)]
    return reales + [c for c in numericos if c not in descubiertos]


def subdividir(puntos: list[tuple[float, float]]) -> list[tuple[float, float, int]]:
    """Circulos que cubren una nube de camaras, para trocearla geograficamente.

    Ultimo recurso cuando ni pais, ni categoria, ni region caben en una consulta: el
    caso de estados como California. La sonda confirmo que nearby (lat, lon, radio en
    km) es el unico parametro de area que la API respeta; bbox responde 500.

    Los circulos se solapan a proposito. Es preferible pedir dos veces una camara,
    que el dedupe por identificador descarta, a dejar un hueco sin cubrir.
    """
    if not puntos:
        return []
    lats = [p[0] for p in puntos]
    lons = [p[1] for p in puntos]
    lat0, lat1 = min(lats), max(lats)
    lon0, lon1 = min(lons), max(lons)

    # Rejilla de 4x4 sobre el rectangulo observado, con radio que cubre cada celda.
    filas = columnas = 4
    alto = max((lat1 - lat0) / filas, 0.05)
    ancho = max((lon1 - lon0) / columnas, 0.05)
    circulos = []
    for f in range(filas):
        for c in range(columnas):
            lat = lat0 + alto * (f + 0.5)
            lon = lon0 + ancho * (c + 0.5)
            # Media diagonal de la celda en kilometros, con margen.
            km_lat = alto * 111.0 / 2
            km_lon = ancho * 111.0 * math.cos(math.radians(lat)) / 2
            radio = int(math.hypot(km_lat, km_lon) * 1.3) + 1
            circulos.append((round(lat, 4), round(lon, 4), min(radio, 250)))
    return circulos


def harvest(key: str, params: dict[str, str], budget: Budget, seen: set[str],
            truncated: list[str], regiones: set[str] | None = None,
            extent: list[tuple[float, float]] | None = None) -> Iterable[dict[str, Any]]:
    """Recorre una particion y entrega sus camaras nuevas.

    De paso apunta los codigos de region que aparecen. La API no publica la lista y
    no se pueden generar: usa codigos de GeoNames, que en unos paises son numericos
    (IT.05) y en otros abreviaturas (US.CA). Los reales estan en los propios datos.
    """
    contadas = 0
    for webcam in page_through(key, params, budget):
        contadas += 1
        location = webcam.get("location") or {}
        if regiones is not None:
            codigo = (location.get("region_code") or "").strip()
            if codigo:
                regiones.add(codigo)
        if extent is not None:
            try:
                extent.append((float(location["latitude"]), float(location["longitude"])))
            except (KeyError, TypeError, ValueError):
                pass
        record = normalise(webcam)
        if not record or record["external_id"] in seen:
            continue
        seen.add(record["external_id"])
        yield record
    if contadas >= MAX_OFFSET + PAGE_LIMIT:
        truncated.append(str(params))


def orden_de_paises() -> list[str]:
    """Paises a recorrer, empezando por donde se quedo la pasada anterior."""
    try:
        ultimo = RESUME_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        ultimo = ""
    if ultimo in COUNTRIES:
        corte = COUNTRIES.index(ultimo)
        return COUNTRIES[corte:] + COUNTRIES[:corte]
    return list(COUNTRIES)


def guardar_reanudacion(country: str | None) -> None:
    RESUME_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESUME_PATH.write_text((country or "") + "\n", encoding="utf-8")


def windy_loader(key: str, estado: dict[str, Any]) -> Iterable[dict[str, Any]]:
    budget = Budget(MAX_REQUESTS, time.monotonic() + TIME_BUDGET_S)
    seen: set[str] = set()
    truncated: list[str] = []
    CAP = MAX_OFFSET + PAGE_LIMIT
    paises = orden_de_paises()
    pendiente: str | None = None

    regiones: set[str] = set()

    def seguro(params: dict[str, str], extent: list | None = None):
        """Recorre una particion sin dejar que su fallo tumbe el proveedor entero."""
        try:
            yield from harvest(key, params, budget, seen, truncated, regiones, extent)
        except Incompleta:
            raise
        except urllib.error.HTTPError as exc:
            print(f"Windy: particion {params} descartada (HTTP {exc.code})", file=sys.stderr)
        except RuntimeError as exc:
            print(f"Windy: particion {params} descartada ({exc})", file=sys.stderr)

    try:
        for indice, country in enumerate(paises):
            total = count_for(key, {"countries": country}, budget)
            if total <= 0:
                continue
            print(f"Windy: {country} ({total}) | acumuladas {len(seen)} | peticiones {budget.used}",
                  file=sys.stderr)

            if total <= CAP:
                yield from seguro({"countries": country})
                continue

            print(f"Windy: {country} no cabe en una consulta, troceando por categoria", file=sys.stderr)
            tamanos = {}
            for cat in WINDY_CATEGORIES:
                tamanos[cat] = count_for(key, {"countries": country, "categories": cat}, budget)

            # Primero las categorias que caben: ademas de traer sus camaras, revelan
            # los codigos de region reales con los que trocear las que no caben.
            for cat in sorted(tamanos, key=lambda c: tamanos[c]):
                n = tamanos[cat]
                if n <= 0:
                    continue
                if n <= CAP:
                    yield from seguro({"countries": country, "categories": cat})
                    continue

                print(f"Windy: {country}/{cat} declara {n}, troceando por region", file=sys.stderr)
                cubierto = 0
                for rc in region_codes(country, regiones):
                    m = count_for(key, {"countries": country, "categories": cat, "regions": rc}, budget)
                    if m <= 0:
                        continue
                    cubierto += m
                    base_params = {"countries": country, "categories": cat, "regions": rc}
                    puntos: list[tuple[float, float]] = []
                    yield from seguro(base_params, puntos)

                    if m > CAP:
                        # Ni la region cabe: se trocea por zonas sobre las camaras ya
                        # vistas, que indican donde estan realmente concentradas.
                        circulos = subdividir(puntos)
                        print(f"Windy: {country}/{cat}/{rc} declara {m}, "
                              f"subdividiendo en {len(circulos)} zonas", file=sys.stderr)
                        for lat, lon, radio in circulos:
                            yield from seguro({**base_params, "nearby": f"{lat},{lon},{radio}"})
                if cubierto < n:
                    truncated.append(f"{country}/{cat}: {cubierto} de {n} localizadas por region")

            # Repesca: una camara sin ninguna categoria no la devuelve ningun filtro
            # de categoria. El dedupe por external_id evita contarla dos veces.
            yield from seguro({"countries": country})
            pendiente = paises[indice + 1] if indice + 1 < len(paises) else None

    except (urllib.error.HTTPError, RuntimeError) as exc:
        # Un fallo que escapa a las guardas anteriores deja el recorrido a medias,
        # pero lo ya recogido es valido: se entrega y se anota donde continuar.
        estado["completa"] = False
        estado["motivo"] = f"{type(exc).__name__}: {exc}"
        guardar_reanudacion(pendiente or country)
        print(f"Windy: recorrido interrumpido ({exc})", file=sys.stderr)
    except Incompleta as motivo:
        # No es un error: se ha recogido lo que cabia en el presupuesto y la siguiente
        # pasada continuara por aqui. Lo que no se puede hacer es podar, porque el
        # recorrido esta a medias y parecerian retiradas camaras que si siguen vivas.
        estado["completa"] = False
        estado["motivo"] = str(motivo)
        guardar_reanudacion(pendiente or country)
        print(f"Windy: pasada incompleta ({motivo}); continuara por {pendiente or country}",
              file=sys.stderr)
    else:
        estado["completa"] = True
        guardar_reanudacion(None)
        print("Windy: recorrido completo", file=sys.stderr)

    estado["peticiones"] = budget.used
    print(f"Windy: {len(seen)} camaras unicas con {budget.used} peticiones", file=sys.stderr)
    for aviso in truncated:
        print(f"Windy: particion incompleta -> {aviso}", file=sys.stderr)


def main() -> int:
    key = os.getenv("WINDY_WEBCAMS_KEY", "").strip()
    if not key:
        print("Windy catalog: WINDY_WEBCAMS_KEY no configurado; se omite")
        return 0

    provider = {
        "code": "WINDY_WEBCAMS",
        "name": "Windy Webcams",
        "homepage_url": "https://www.windy.com/webcams",
        "api_url": "https://api.windy.com/webcams",
        "country_code": None,
        "attribution": "Windy.com",
        "license_name": "Windy Webcams API Terms of Use",
        "license_url": "https://api.windy.com/webcams/terms",
        "terms_url": "https://api.windy.com/webcams/terms",
        "refresh_seconds": 600,
        "enabled": 1,
        "notes": "Camaras de calle, paisaje y turismo de todo el mundo. Requiere la clave gratuita WINDY_WEBCAMS_KEY. Sus condiciones obligan a enlazar cada imagen con Windy y a mostrar la cortesia en el contexto donde se muestran.",
    }

    with closing(base.ensure_database()) as connection:
        columns = list(provider)
        updates = ",".join(f"{c}=excluded.{c}" for c in columns if c != "code")
        connection.execute(
            f"INSERT INTO providers ({','.join(columns)}) VALUES ({','.join(f':{c}' for c in columns)}) "
            f"ON CONFLICT(code) DO UPDATE SET {updates}", provider,
        )
        connection.commit()

        estado: dict[str, Any] = {"completa": True}
        report = base.run_provider(
            connection, "WINDY_WEBCAMS",
            lambda: windy_loader(key, estado),
            should_prune=lambda: estado.get("completa", False),
        )
        report.update({k: v for k, v in estado.items() if k != "completa"})
        report["recorridoCompleto"] = estado.get("completa", False)
        base.export_catalog(connection, [report])
        total = connection.execute(
            "SELECT COUNT(*) FROM cameras WHERE active=1 AND is_public=1"
        ).fetchone()[0]

    print(json.dumps(report, ensure_ascii=False))
    print(f"Windy catalog ready: {total} public records")
    # Una pasada parcial no es un fallo: lo recogido es valido y la siguiente
    # continuara donde esta se quedo. Solo se considera error no traer nada.
    if report.get("status") != "ok" and not report.get("count"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
