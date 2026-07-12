# Pipeline del catálogo

- `build_catalog.py`: crea/actualiza SQLite, importa fuentes y exporta JSON.
- `decode_bootstrap.py`: genera una base SQLite mínima cuando se necesita arrancar sin una copia binaria previa.

El despliegue ejecuta el generador antes de Vite, por lo que `src/data/catalog.seed.json` contiene el catálogo generado en el propio bundle.
