# Cams

Cams es un visor mundial de webcams públicas, directos y snapshots. La aplicación abre en un globo interactivo, permite localizar cámaras por todo el mundo y ofrece una segunda vista de mosaico minimalista.

## Estado actual

La última ejecución internacional confirmada ha producido **11.372 cámaras activas**, antes de la prueba final del adaptador específico de Cataluña.

El catálogo ya incluye redes oficiales de:

- España estatal, Madrid y Barcelona;
- Londres y Finlandia;
- California, Nueva York y Oregón;
- Columbia Británica y Ontario;
- Singapur y Nueva Zelanda.

Los recuentos vigentes por país y proveedor no se mantienen manualmente en este README. Se regeneran en:

```text
public/data/catalog-meta.json
```

## Arquitectura

- React, TypeScript y Vite.
- MapLibre GL JS con proyección `globe`.
- SQLite como fuente maestra del catálogo.
- Python para importar, validar, depurar y exportar datos.
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

## Reproductor y fuentes no insertables

No todas las administraciones publican un JPG o stream que pueda insertarse desde GitHub Pages. Algunas solo ofrecen una página de consulta o bloquean el hotlink.

El reproductor distingue ahora entre:

- snapshot disponible;
- HLS o vídeo;
- iframe autorizado;
- cámara offline;
- reproducción bloqueada por el proveedor;
- ubicación pública sin imagen insertable;
- error temporal de la imagen.

Cuando no puede reproducirse dentro de Cams, la ficha explica la causa y muestra **abrir fuente original**. Ya no utiliza el mensaje genérico «formato no compatible» para las cámaras de tipo enlace.

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

Base principal:

```text
data/cams.sqlite3
```

Esquema:

```text
data/schema.sql
```

Punto de entrada:

```text
scripts/catalog/run_catalog.py
```

Cada ejecución actualiza y exporta:

```text
public/data/cameras.json
public/data/catalog-meta.json
public/data/cams.sqlite3
src/data/catalog.seed.json
```

`src/data/catalog.seed.json` se compila dentro de la aplicación. Si GitHub Pages entrega un 404 temporal en `data/cameras.json`, Cams utiliza esa copia integrada.

Antes de importar, `prepare_database.py` comprueba la cabecera SQLite y ejecuta `PRAGMA quick_check`. Si encuentra una imagen malformada, elimina únicamente esa base y sus archivos auxiliares y la reconstruye desde `data/schema.sql`.

Documentación:

- [Esquema y significado de columnas](docs/SQLITE_DATABASE.md)
- [Recuperación de una base corrupta](docs/SQLITE_RECOVERY.md)
- [Fuentes y condiciones](docs/CAMERA_SOURCES.md)
- [Cobertura por países y hoja de ruta](docs/COVERAGE_ROADMAP.md)

## Pipeline de importación

```text
build_catalog.py          fuentes base
quality_catalog.py        depuración y lista blanca de YouTube
extend_catalog.py         DGT, Madrid y Barcelona
fintraffic_catalog.py     Finlandia
international_catalog.py  Alemania, Estados Unidos y Canadá
sct_catalog.py            compatibilidad aislada con SCT/CIVICAT
keyed_catalog.py          fuentes gratuitas con secreto opcional
catalog_stats.py          estadísticas territoriales y de calidad
```

Cada proveedor falla de forma independiente. Una red caída no elimina las cámaras de las demás ni impide conservar el último catálogo válido.

## Control de calidad de YouTube

Los 144 vídeos de la semilla histórica se conservan dentro de SQLite, pero han quedado inactivos por defecto. Muchos habían terminado, eran grabaciones o no correspondían realmente con la ubicación.

Solo se publican identificadores incluidos expresamente en:

```text
data/verified_youtube.json
```

De este modo, una cifra alta de cámaras no se consigue a costa de presentar vídeos antiguos como directos.

## Fuentes gratuitas activas

- DGT National Access Point DATEX II 3.7.
- Ayuntamiento de Madrid y Madrid Calle 30.
- Red histórica municipal de Barcelona.
- Servei Català de Trànsit / CIVICAT, mediante adaptador TLS aislado en prueba.
- Fintraffic Digitraffic.
- Transport for London JamCams.
- Caltrans CWWP2.
- 511 New York.
- Oregon TripCheck.
- DriveBC.
- Ontario 511.
- Singapore LTA Traffic Images.
- GeoNet New Zealand.
- Autobahn API alemana, aunque actualmente su colección de webcams puede estar vacía.

La explicación de endpoints, atribución y limitaciones está en [docs/CAMERA_SOURCES.md](docs/CAMERA_SOURCES.md).

## Fuentes gratuitas con clave preparada

Cams admite secretos opcionales de GitHub Actions. Si no existen, se omiten sin error.

```text
TRAFIKVERKET_KEY
DOT_GA_API_KEY
DOT_FL_API_KEY
DOT_AZ_API_KEY
DOT_ID_API_KEY
DOT_UT_API_KEY
DOT_LA_API_KEY
DOT_PA_API_KEY
DOT_SC_API_KEY
DOT_MA_API_KEY
```

`TRAFIKVERKET_KEY` activa las cámaras nacionales suecas. Los secretos `DOT_*` activan redes 511 estadounidenses con registro gratuito.

Las claves se guardan en:

```text
Settings → Secrets and variables → Actions
```

Nunca se incluyen en SQLite, JSON, commits o JavaScript del navegador.

## Mosaico

El mosaico consume exactamente el mismo catálogo que el mapa y admite:

- YouTube verificado;
- HLS;
- MJPEG;
- iframes autorizados;
- vídeo directo;
- snapshots con refresco periódico;
- parrillas de 1 a 30 cámaras;
- rotación, lotes aleatorios y filtros.

El filtro inicial es `Cualquier estado`. El usuario puede seleccionar después solo verificadas, disponibles, caídas o bloqueadas.

## Favicon

El favicon combina una cámara y un globo:

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

Regeneración sin consultar proveedores remotos:

```bash
npm run catalog:offline
```

## GitHub Actions

`.github/workflows/deploy.yml`:

1. utiliza Node.js 24 y Python 3.13;
2. valida o reconstruye SQLite;
3. ejecuta las fuentes públicas y las claves opcionales disponibles;
4. archiva los YouTube no verificados;
5. genera estadísticas por país, proveedor, medio, categoría y estado;
6. comprueba integridad y coincidencia de exportaciones;
7. compila la aplicación;
8. persiste la base y el catálogo generado en `main` con `[skip ci]`;
9. publica `dist` en GitHub Pages.

`.github/workflows/refresh-catalog.yml` actualiza la base cada seis horas y aplica la misma recuperación y depuración.

En **Settings → Pages** debe estar seleccionada la fuente **GitHub Actions**.

## Política

Solo se integran cámaras públicas y fuentes cuya visualización o reutilización esté permitida. Cams no intenta acceder a cámaras privadas, eludir autenticación, sortear cuotas comerciales ni copiar catálogos protegidos.
