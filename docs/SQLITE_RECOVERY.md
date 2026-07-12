# Recuperación automática de SQLite

Cams trata `data/cams.sqlite3` como un artefacto regenerable. El esquema, las fuentes y los exportadores son la fuente reproducible del catálogo.

## Problema que resuelve

Una imagen SQLite truncada o malformada puede producir:

```text
sqlite3.DatabaseError: database disk image is malformed
```

No se intenta aplicar migraciones sobre esa imagen porque cualquier lectura o escritura posterior es poco fiable.

## Secuencia de recuperación

`python scripts/catalog/run_catalog.py` ejecuta primero `prepare_database.py`:

1. comprueba que el archivo tenga la cabecera `SQLite format 3`;
2. abre la base en modo de solo lectura;
3. ejecuta `PRAGMA quick_check`;
4. si la comprobación falla, elimina la base corrupta y sus archivos auxiliares;
5. ejecuta `build_catalog.py`, que crea una base nueva y aplica `data/schema.sql`.

La recuperación no elimina el esquema, la documentación ni las fuentes. Después se vuelven a importar las cámaras y se regeneran los JSON.

## Barreras del despliegue

GitHub Pages solo se publica cuando:

- `PRAGMA integrity_check` devuelve `ok`;
- existen al menos 100 cámaras públicas activas;
- `data/cams.sqlite3`, `public/data/cameras.json` y `src/data/catalog.seed.json` contienen el mismo número de registros;
- TypeScript y Vite terminan la compilación.

## Uso local

```bash
npm run catalog:check
npm run catalog:refresh
```

Reconstrucción sin consultar Internet:

```bash
npm run catalog:offline
```
