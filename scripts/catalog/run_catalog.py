#!/usr/bin/env python3
"""Punto de entrada seguro para reconstruir SQLite y exportar el catálogo."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from prepare_database import prepare_database

ROOT = Path(__file__).resolve().parents[2]
BUILDER = Path(__file__).with_name("build_catalog.py")
EXTENDER = Path(__file__).with_name("extend_catalog.py")


def main() -> int:
    prepare_database()
    arguments = sys.argv[1:]
    base_result = subprocess.call([sys.executable, str(BUILDER), *arguments], cwd=ROOT)
    if base_result != 0:
        return base_result

    if "--offline" in arguments:
        return 0

    extra_result = subprocess.call([sys.executable, str(EXTENDER), *arguments], cwd=ROOT)
    if extra_result != 0:
        print(
            "Advertencia: la ampliación europea falló, pero se conserva el catálogo base válido.",
            file=sys.stderr
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
