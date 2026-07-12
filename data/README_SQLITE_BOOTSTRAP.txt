data/cams.sqlite3 es una base SQLite válida versionada en el repositorio.

El archivo inicial contiene únicamente una marca de arranque. En cada ejecución de GitHub Actions, scripts/catalog/build_catalog.py aplica data/schema.sql, importa los proveedores gratuitos y reemplaza la copia publicada en public/data/cams.sqlite3.

La documentación completa del esquema está en docs/SQLITE_DATABASE.md.
