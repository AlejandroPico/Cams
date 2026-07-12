# Cams

Cams es un visor mundial de webcams públicas, directos y snapshots. La aplicación abre en un globo interactivo, permite localizar cámaras por todo el mundo y ofrece una segunda vista de mosaico minimalista.

## Arquitectura actual

- React, TypeScript y Vite.
- MapLibre GL JS con proyección `globe`.
- SQLite como fuente maestra del catálogo.
- Python para importar, normalizar y exportar datos.
- Node.js 24 y Python 3.13 en GitHub Actions.
- Catálogo JSON integrado dentro del bundle como protección frente a errores 404.

## Mapa mundial

El visor ofrece tres representaciones intercambiables sin reconstruir el mapa:

- **Satélite:** fotografía aérea de Esri World Imagery.
- **Geográfico:** cartografía de OpenStreetMap.
- **Relieve:** mapa topográfico de OpenTopoMap.

El modo **Terreno 3D** añade un modelo de elevación `raster-dem`, hillshade y una cámara inclinada. Si el proveedor de elevaciones no responde, el resto del mapa continúa funcionando.

Otras funciones:

- zoom desde el globo completo hasta escala urbana;
- brújula, inclinación y pantalla completa;
- clústeres con el número de cámaras agrupadas;
- iconos individuales de cámara generados localmente en canvas;
- borde amarillo de día, naranja en transición y azul de noche;
- sombra día/noche actualizada cada minuto;
- localidades opcionales;
- filtros compartidos con el mosaico.

Al pulsar una cámara individual se abre una ventana flotante con el medio, ubicación, hora local, proveedor, estado y enlace de origen. En escritorio puede arrastrarse por la cabecera, minimizarse, abrirse a pantalla completa y recuperar su posición inicial con doble clic en la cabecera.

## Menú lateral

El panel hamburguesa está dividido en bloques plegables:

- resumen cuantitativo del catálogo;
- búsqueda y filtros;
- selección de base cartográfica;
- terreno 3D, día/noche y localidades;
- configuración del mosaico;
- estado del catálogo SQLite.

La interfaz mantiene la estética oscura, rectilínea y minimalista del proyecto.

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

`src/data/catalog.seed.json` se compila dentro de la aplicación. Si GitHub Pages entrega un 404 temporal en `data/cameras.json`, Cams utiliza esa copia integrada.

Antes de importar, `prepare_database.py` comprueba la cabecera SQLite y ejecuta `PRAGMA quick_check`. Si encuentra una imagen malformada, elimina únicamente esa base y sus archivos auxiliares y la reconstruye desde `data/schema.sql`. Véase [docs/SQLITE_RECOVERY.md](docs/SQLITE_RECOVERY.md).

La explicación campo por campo está en [docs/SQLITE_DATABASE.md](docs/SQLITE_DATABASE.md).

## Fuentes gratuitas

Fuentes base:

- Caltrans CWWP2, doce distritos de California.
- Transport for London JamCams.
- Singapore LTA Traffic Images.
- GeoNet New Zealand Volcano Cameras.
- catálogo histórico de Cams como candidatos de YouTube no verificados.

Ampliación española y europea:

- DGT National Access Point DATEX II 3.7;
- cámaras urbanas del Ayuntamiento de Madrid;
- cámaras de Madrid Calle 30;
- 27 ubicaciones municipales de tráfico de Barcelona;
- Fintraffic Digitraffic Weather Cameras de Finlandia.

`run_catalog.py` ejecuta el catálogo base y después `extend_catalog.py`. Cada proveedor falla de manera independiente. Una red caída no borra las cámaras almacenadas ni bloquea el despliegue.

La documentación de fuentes está en [docs/CAMERA_SOURCES.md](docs/CAMERA_SOURCES.md).

## Mosaico

El mosaico consume exactamente el mismo catálogo que el mapa y admite:

- YouTube;
- HLS;
- MJPEG;
- iframes autorizados;
- vídeo directo;
- snapshots con refresco periódico;
- parrillas de 1 a 30 cámaras;
- rotación, lotes aleatorios y filtros.

El filtro inicial es `Cualquier estado`, por lo que las cámaras `unknown` no desaparecen. El usuario puede seleccionar después solo verificadas, disponibles, caídas o bloqueadas.

## Favicon

El favicon combina una cámara y un globo. Se sirve desde:

```text
public/icons/favicon.svg
```

La referencia incluye versión para evitar que el navegador conserve indefinidamente el icono anterior.

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

1. utiliza Node.js 24 y Python 3.13;
2. valida o reconstruye SQLite;
3. importa las fuentes base y la ampliación europea;
4. comprueba integridad, recuentos y coincidencia de exportaciones;
5. compila la aplicación;
6. persiste la base y el catálogo generado en `main` con `[skip ci]`;
7. publica `dist` en GitHub Pages.

`.github/workflows/refresh-catalog.yml` actualiza la base cada seis horas y aplica la misma recuperación automática.

En **Settings → Pages** debe estar seleccionada la fuente **GitHub Actions**.

## Política

Solo se integran cámaras públicas y fuentes cuya visualización o reutilización esté permitida. Cams no intenta acceder a cámaras privadas, eludir autenticación, sortear cuotas comerciales ni copiar catálogos protegidos.
