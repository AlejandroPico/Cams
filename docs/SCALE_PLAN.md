# Plan de escala del catálogo

## Hasta 10.000 cámaras

- Un único GeoJSON comprimido.
- Clustering MapLibre.
- Carga de medios bajo demanda.

## 10.000–250.000 cámaras

- Catálogo dividido por regiones o teselas.
- Índice global mínimo.
- Descarga por viewport y nivel de zoom.

## Más de 250.000 cámaras

- PMTiles/MVT generados en GitHub Actions.
- Propiedades mínimas en tesela.
- Metadatos completos en archivos fragmentados por ID.
- Búsqueda local mediante índices estáticos.

El mosaico nunca carga todo el catálogo. Solo reproduce el lote seleccionado.
