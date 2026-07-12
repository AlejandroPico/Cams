# Estado de SQLite

El workflow de despliegue ejecuta `scripts/catalog/build_catalog.py` antes de compilar. Esa ejecución crea `data/cams.sqlite3`, publica una copia en `public/data/cams.sqlite3` y persiste ambos archivos en `main` mediante un commit automático con `[skip ci]`.

Mientras el primer workflow termina, `data/cams.sqlite3.base64.txt` y `scripts/catalog/decode_bootstrap.py` proporcionan una base SQLite mínima reproducible.
