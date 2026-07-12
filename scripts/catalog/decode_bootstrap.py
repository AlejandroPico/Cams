#!/usr/bin/env python3
"""Decodifica data/cams.sqlite3.base64.txt si la base binaria aún no existe."""
from __future__ import annotations

import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data" / "cams.sqlite3.base64.txt"
TARGET = ROOT / "data" / "cams.sqlite3"

if not TARGET.exists():
    TARGET.write_bytes(base64.b64decode(SOURCE.read_text(encoding="ascii")))
    print(f"Created {TARGET.relative_to(ROOT)}")
else:
    print(f"Existing database preserved: {TARGET.relative_to(ROOT)}")
