# Pipeline del catálogo

El punto de entrada oficial es:

```bash
python scripts/catalog/run_catalog.py
```

Proceso:

1. `prepare_database.py` comprueba la cabecera SQLite y ejecuta `PRAGMA quick_check`.
2. Si `data/cams.sqlite3` está corrupta, elimina únicamente la base dañada y sus archivos auxiliares `-wal`, `-shm` o `-journal`.
3. `build_catalog.py` crea una base nueva, aplica `data/schema.sql`, importa las fuentes públicas y exporta el catálogo.
4. GitHub Actions valida `PRAGMA integrity_check`, el número mínimo de registros y la coincidencia entre SQLite y los dos JSON.
5. Solo después se compila y publica GitHub Pages.

Archivos generados:

```text
data/cams.sqlite3
public/data/cams.sqlite3
public/data/cameras.json
public/data/catalog-meta.json
src/data/catalog.seed.json
```

`src/data/catalog.seed.json` se integra dentro del bundle para que un error 404 del catálogo público no vacíe la aplicación.

Para reconstruir sin consultar proveedores externos:

```bash
python scripts/catalog/run_catalog.py --offline
```
