#!/usr/bin/env python3
"""Punto de entrada seguro para reconstruir SQLite y exportar el catálogo."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from prepare_database import prepare_database

ROOT = Path(__file__).resolve().parents[2]
BUILDER = Path(__file__).with_name("build_catalog.py")


def main() -> int:
    prepare_database()
    command = [sys.executable, str(BUILDER), *sys.argv[1:]]
    return subprocess.call(command, cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
