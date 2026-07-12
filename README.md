# Cams

Cams es un visor mundial de webcams públicas, directos y snapshots. La aplicación abre en un globo interactivo, permite localizar cámaras por todo el mundo y ofrece una segunda vista de mosaico minimalista.

## Reconstrucción v4

Esta versión elimina dos causas concretas de los fallos anteriores:

- El mapa ya no contiene un temporizador que declare fallida la inicialización por un simple retraso del estilo o de las teselas.
- El catálogo ya no depende exclusivamente de una petición a `public/data/cameras.json`: también queda integrado dentro del bundle.

La arquitectura actual utiliza:

- React, TypeScript y Vite.
- MapLibre GL JS con proyección `globe`.
- Un mapa cartográfico básico que se carga antes que las capas opcionales.
- Fotografía satelital añadida después; si falla, el globo básico sigue funcionando.
- Clustering de cámaras en la GPU.
- SQLite como fuente maestra del catálogo.
- Python para importar, normalizar y exportar datos.
- Node.js 24 y Python 3.13 en GitHub Actions.

## Catálogo SQLite

La base principal se genera en:

```text
data/cams.sqlite3
```

El esquema completo está en:

```text
data/schema.sql
```

El punto de entrada seguro es:

```text
scripts/catalog/run_catalog.py
```

Cada ejecución actualiza SQLite y exporta:

```text
public/data/cameras.json
public/data/catalog-meta.json
public/data/cams.sqlite3
src/data/catalog.seed.json
```

El último archivo se compila dentro de la aplicación. Si GitHub Pages entrega un 404 temporal en `data/cameras.json`, Cams utiliza esa copia integrada y no se queda sin catálogo.

Antes de importar, `prepare_database.py` comprueba la cabecera SQLite y ejecuta `PRAGMA quick_check`. Si encuentra una imagen malformada, elimina únicamente esa base y sus archivos auxiliares y la reconstruye desde `data/schema.sql`. Véase [docs/SQLITE_RECOVERY.md](docs/SQLITE_RECOVERY.md).

La explicación campo por campo está en [docs/SQLITE_DATABASE.md](docs/SQLITE_DATABASE.md).

## Fuentes gratuitas iniciales

El importador consulta de manera independiente:

- Caltrans CWWP2, los doce distritos de California.
- Transport for London JamCams.
- Singapore LTA Traffic Images.
- GeoNet New Zealand Volcano Cameras.
- El catálogo histórico de Cams como candidatos de YouTube sin garantía de emisión actual.

Los proveedores remotos aportan snapshots y streams geolocalizados. Un fallo temporal de una fuente no borra las cámaras ya almacenadas ni impide importar las demás.

## Mapa

La inicialización se realiza por fases:

1. estilo cartográfico mínimo;
2. proyección esférica;
3. capa satelital;
4. cámaras y clústeres;
5. sombra día/noche;
6. iconos y nombres de localidades como mejoras opcionales.

Los recursos opcionales no pueden bloquear el globo. La base cartográfica permanece disponible aunque falle Esri, Natural Earth o el icono personalizado.

Los puntos de cámara se colorean según la iluminación aproximada:

- amarillo durante el día;
- naranja en amanecer o atardecer;
- azul durante la noche.

## Mosaico

El mosaico consume exactamente el mismo catálogo que el mapa y admite:

- YouTube;
- HLS;
- MJPEG;
- iframes autorizados;
- vídeo directo;
- snapshots con refresco periódico;
- parrillas de 1 a 30 cámaras;
- rotación y filtros.

El filtro inicial es `Cualquier estado`, por lo que las cámaras `unknown` ya no desaparecen de la interfaz. El usuario puede seleccionar después solo verificadas, disponibles, caídas o bloqueadas.

## Desarrollo

```bash
nvm use
npm install
npm run catalog:refresh
npm run dev
```

Comprobación aislada de SQLite:

```bash
npm run catalog:check
```

Compilación:

```bash
npm run build
```

Regeneración sin Internet:

```bash
npm run catalog:offline
```

## GitHub Actions

`.github/workflows/deploy.yml`:

1. fuerza el runtime JavaScript compatible con Node.js 24;
2. instala Node.js 24 y Python 3.13;
3. valida o reconstruye SQLite;
4. actualiza la base y los JSON;
5. comprueba integridad, recuentos y coincidencia de exportaciones;
6. compila la aplicación;
7. persiste la base y el catálogo generado en `main` con `[skip ci]`;
8. publica `dist` en GitHub Pages.

`.github/workflows/refresh-catalog.yml` actualiza la base cada seis horas y aplica la misma recuperación automática.

En **Settings → Pages** debe estar seleccionada la fuente **GitHub Actions**.

## Política

Solo se integran cámaras públicas y fuentes cuya visualización o reutilización esté permitida. Cams no intenta acceder a cámaras privadas, eludir autenticación, sortear cuotas comerciales ni copiar catálogos protegidos.
