#!/usr/bin/env python3
"""Valida la base SQLite de Cams y elimina una imagen corrupta antes de importar.

El catálogo es regenerable desde el esquema y las fuentes públicas. Por eso una base
malformada no debe bloquear GitHub Actions: se descarta y se reconstruye de forma limpia.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "cams.sqlite3"
SQLITE_HEADER = b"SQLite format 3\x00"


def database_is_healthy(path: Path = DB_PATH) -> bool:
    """Devuelve True para una base inexistente o una imagen SQLite íntegra."""
    if not path.exists():
        return True
    if not path.is_file() or path.stat().st_size < 512:
        return False
    try:
        with path.open("rb") as handle:
            if handle.read(len(SQLITE_HEADER)) != SQLITE_HEADER:
                return False
        uri = f"file:{path.resolve().as_posix()}?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=5) as connection:
            result = connection.execute("PRAGMA quick_check").fetchone()
        return bool(result and result[0] == "ok")
    except (OSError, sqlite3.DatabaseError):
        return False


def remove_database_files(path: Path = DB_PATH) -> None:
    """Elimina la base corrupta y posibles archivos auxiliares WAL/SHM."""
    for candidate in (path, Path(f"{path}-wal"), Path(f"{path}-shm"), Path(f"{path}-journal")):
        try:
            candidate.unlink(missing_ok=True)
        except OSError as exc:
            raise RuntimeError(f"No se pudo eliminar {candidate}: {exc}") from exc


def prepare_database(path: Path = DB_PATH) -> bool:
    """Deja preparada la ruta y devuelve True si fue necesario reconstruirla."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if database_is_healthy(path):
        state = "no existe todavía" if not path.exists() else "íntegra"
        print(f"SQLite preparada: {path.relative_to(ROOT)} ({state})")
        return False

    print(f"SQLite corrupta detectada: {path.relative_to(ROOT)}; se reconstruirá desde cero")
    remove_database_files(path)
    return True


if __name__ == "__main__":
    prepare_database()
