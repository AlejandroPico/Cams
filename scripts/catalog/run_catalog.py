#!/usr/bin/env python3
"""Punto de entrada seguro para reconstruir SQLite y exportar el catálogo."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from prepare_database import prepare_database

ROOT = Path(__file__).resolve().parents[2]
BUILDER = Path(__file__).with_name("build_catalog.py")
QUALITY = Path(__file__).with_name("quality_catalog.py")
EXTENDER = Path(__file__).with_name("extend_catalog.py")
FINTRAFFIC = Path(__file__).with_name("fintraffic_catalog.py")
INTERNATIONAL = Path(__file__).with_name("international_catalog.py")
EUROPE = Path(__file__).with_name("europe_catalog.py")
NORTH_AMERICA = Path(__file__).with_name("north_america_catalog.py")
SCT = Path(__file__).with_name("sct_catalog.py")
KEYED = Path(__file__).with_name("keyed_catalog.py")
STATS = Path(__file__).with_name("catalog_stats.py")
CAPTURE_METADATA = Path(__file__).with_name("capture_metadata.py")


def run_optional(script: Path, arguments: list[str], warning: str) -> None:
    result = subprocess.call([sys.executable, str(script), *arguments], cwd=ROOT)
    if result != 0:
        print(f"Advertencia: {warning}; se conserva el último catálogo válido.", file=sys.stderr)


def main() -> int:
    prepare_database()
    arguments = sys.argv[1:]
    base_result = subprocess.call([sys.executable, str(BUILDER), *arguments], cwd=ROOT)
    if base_result != 0:
        return base_result

    run_optional(QUALITY, [], "no se pudo aplicar el control de calidad de YouTube")

    if "--offline" not in arguments:
        run_optional(EXTENDER, arguments, "una parte de la ampliación española falló")
        run_optional(FINTRAFFIC, [], "Fintraffic no respondió")
        run_optional(INTERNATIONAL, arguments, "una parte de la ampliación internacional falló")
        run_optional(EUROPE, arguments, "una red europea sin credenciales no respondió")
        run_optional(NORTH_AMERICA, arguments, "una red adicional de Norteamérica no respondió")
        run_optional(SCT, [], "el WFS legado del Servei Català de Trànsit no respondió")
        run_optional(KEYED, [], "una fuente configurada mediante clave gratuita no respondió")

    stats_result = subprocess.call([sys.executable, str(STATS)], cwd=ROOT)
    if stats_result != 0:
        print("Advertencia: no se pudieron generar estadísticas de cobertura.", file=sys.stderr)
    run_optional(
        CAPTURE_METADATA,
        [],
        "no se pudieron conservar las fechas de captura publicadas por las fuentes",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
