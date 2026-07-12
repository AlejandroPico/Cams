# Arquitectura de coste cero

## Ejecución

Cams usa una arquitectura estática para evitar servidores de pago:

1. GitHub Actions ejecuta el agregador Python.
2. El agregador genera un catálogo JSON normalizado.
3. Vite compila React y TypeScript.
4. GitHub Pages sirve el frontend y los datos.
5. El navegador solicita directamente las teselas cartográficas y los medios permitidos.

## Escalado

### Fase actual

- GeoJSON en cliente.
- Clustering MapLibre.
- Catálogo de cientos o decenas de miles de registros, según peso final.

### Fase de alta densidad

- Particionar cámaras por tesela geográfica.
- Generar PMTiles o MVT en GitHub Actions.
- Solicitar únicamente las teselas del viewport.
- Mantener un índice ligero para búsquedas y filtros.

Esta evolución no requiere un backend encendido permanentemente.

## Proveedores cartográficos

La aplicación usa una abstracción de estilo MapLibre. El proveedor actual de fotografía satelital se puede sustituir cambiando `src/map/mapStyle.ts`. No se utilizarán proveedores que exijan facturación para el funcionamiento básico.

## Catálogo

Solo se activan fuentes gratuitas y autorizadas. Cada entrada de `data/sources.json` debe incluir atribución, licencia y límites de actualización. El agregador no elude cuotas, autenticación ni protecciones.
