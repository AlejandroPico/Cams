# Cams

Cams es un visor mundial de webcams públicas, directos y snapshots. La aplicación abre en un globo interactivo, permite localizar cámaras por todo el mundo y ofrece una segunda vista de mosaico minimalista.

## Estado actual

La última ejecución confirmada ha generado **12.508 cámaras activas**:

- 12.444 marcadas online;
- 64 ubicaciones o fuentes todavía sin verificar;
- 144 vídeos históricos de YouTube archivados e inactivos.

Cobertura confirmada por país:

| País | Cámaras |
|---|---:|
| Estados Unidos | 3.878 |
| Canadá | 2.671 |
| España | 2.353 |
| Finlandia | 2.272 |
| Reino Unido | 882 |
| Irlanda | 242 |
| Islandia | 165 |
| Países Bajos | 26 |
| Nueva Zelanda | 11 |
| Singapur | 8 |

Los recuentos vigentes por país, proveedor, medio, categoría y estado se regeneran en:

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

El modo **Terreno 3D** añade elevación `raster-dem`, hillshade y cámara inclinada. El globo también ofrece zoom urbano, brújula, pantalla completa, clústeres numéricos, iconos individuales de cámara, estado solar por color, localidades opcionales y filtros compartidos con el mosaico.

Al pulsar una cámara individual se abre una ventana flotante arrastrable con el medio, ubicación, hora local, proveedor, estado y enlace de origen. Puede minimizarse, cerrarse, abrirse a pantalla completa y recuperar su posición inicial con doble clic en la cabecera.

## Reproductor y fuentes no insertables

No todas las administraciones publican un JPG o stream que pueda insertarse desde GitHub Pages. Algunas solo ofrecen una página de consulta, exigen una cabecera propia o bloquean el hotlink.

El reproductor distingue entre:

- snapshot disponible;
- HLS o vídeo;
- iframe autorizado;
- cámara offline;
- reproducción bloqueada;
- ubicación pública sin imagen insertable;
- error temporal de la imagen.

Cuando una cámara no puede reproducirse dentro de Cams, la ficha explica la causa y muestra **abrir fuente original**. Las cámaras de Barcelona que solo conservan una página pública ya no muestran el mensaje genérico «formato no compatible».

## Menú lateral

El panel hamburguesa está dividido en bloques plegables para:

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

Antes de importar, `prepare_database.py` comprueba la cabecera SQLite y ejecuta `PRAGMA quick_check`. Una imagen malformada se elimina y reconstruye desde `data/schema.sql`.

Documentación:

- [Esquema y significado de columnas](docs/SQLITE_DATABASE.md)
- [Recuperación de una base corrupta](docs/SQLITE_RECOVERY.md)
- [Fuentes y condiciones](docs/CAMERA_SOURCES.md)
- [Cobertura por países y hoja de ruta](docs/COVERAGE_ROADMAP.md)

## Pipeline de importación

```text
build_catalog.py             fuentes base
quality_catalog.py           depuración, países y lista blanca de YouTube
extend_catalog.py            DGT, Madrid y Barcelona
fintraffic_catalog.py        Finlandia
europe_catalog.py            Irlanda, Islandia y Países Bajos
international_catalog.py     Estados Unidos, Canadá y Autobahn Alemania
north_america_catalog.py     Alberta, Toronto y pruebas adicionales
sct_catalog.py               compatibilidad aislada con SCT/CIVICAT
keyed_catalog.py             fuentes gratuitas con secreto opcional
catalog_stats.py             estadísticas territoriales y de calidad
```

Cada proveedor falla de forma independiente. Una red caída no elimina las cámaras de las demás ni impide conservar el último catálogo válido.

## Control de calidad de YouTube

Los 144 vídeos de la semilla histórica siguen almacenados en SQLite, pero están inactivos. Muchos habían terminado, eran grabaciones o no correspondían realmente con la ubicación.

Solo se publican identificadores incluidos expresamente en:

```text
data/verified_youtube.json
```

Así, una cifra alta de cámaras no se consigue presentando vídeos antiguos como directos.

## Fuentes gratuitas activas

- DGT National Access Point DATEX II 3.7.
- Ayuntamiento de Madrid y Madrid Calle 30.
- Red histórica municipal de Barcelona.
- Fintraffic Digitraffic.
- Transport for London JamCams.
- Transport Infrastructure Ireland.
- Vegagerðin / umferdin.is de Islandia.
- Rijkswaterstaat de Países Bajos.
- Caltrans CWWP2.
- 511 New York.
- Oregon TripCheck.
- DriveBC.
- Ontario 511.
- Alberta 511.
- City of Toronto Open Data.
- Singapore LTA Traffic Images.
- GeoNet New Zealand.

La Autobahn API alemana está integrada, pero actualmente devuelve una colección de webcams vacía. Washington State DOT está preparado, pero su fuente no produjo registros en la última ejecución y no se cuenta como cobertura activa.

### Cataluña y SCT/CIVICAT

El adaptador específico del Servei Català de Trànsit consigue negociar el TLS antiguo del servidor de MCT/CIVICAT manteniendo la validación del certificado. La petición automatizada termina, sin embargo, en **HTTP 403 Forbidden** desde GitHub Actions. Por eso todavía no se publican cámaras del SCT como si se hubieran importado correctamente.

Las 27 ubicaciones municipales históricas de Barcelona permanecen diferenciadas: muestran imagen cuando existe y, en caso contrario, enlace a la fuente con estado `unknown`.

## Fuentes gratuitas con clave preparada

Cams admite secretos opcionales de GitHub Actions. Si no existen, la fuente se omite sin error:

```text
TRAFIKVERKET_KEY
ITS_KR_KEY
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

- `TRAFIKVERKET_KEY`: cámaras nacionales suecas.
- `ITS_KR_KEY`: streams HLS de autopistas y carreteras nacionales de Corea del Sur.
- `DOT_*`: redes 511 estadounidenses con registro gratuito.

Las claves se guardan en:

```text
Settings → Secrets and variables → Actions
```

Nunca se escriben en SQLite, JSON, commits o JavaScript del navegador.

## Japón

No se han activado las listas localizadas hasta ahora porque son recopilaciones manuales de YouTube sin garantía de emisión, justo el tipo de contenido retirado por el control de calidad. La futura cobertura japonesa se incorporará mediante feeds oficiales del MLIT, prefecturas, NEXCO, volcanes o puertos cuando sus términos y formatos estén verificados.

## Mosaico

El mosaico consume exactamente el mismo catálogo que el mapa y admite YouTube verificado, HLS, MJPEG, iframe autorizado, vídeo directo y snapshots con refresco periódico. Permite parrillas de 1 a 30 cámaras, rotación, lotes aleatorios y filtros.

## Favicon

El favicon combina una cámara y un globo:

```text
public/icons/favicon.svg
```

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

Regeneración sin proveedores remotos:

```bash
npm run catalog:offline
```

## GitHub Actions

`.github/workflows/deploy.yml`:

1. utiliza Node.js 24 y Python 3.13;
2. valida o reconstruye SQLite;
3. ejecuta las fuentes públicas y los secretos opcionales disponibles;
4. archiva los YouTube no verificados;
5. genera estadísticas por país, proveedor, medio, categoría y estado;
6. comprueba integridad y coincidencia de exportaciones;
7. compila la aplicación;
8. persiste la base y el catálogo en `main` con `[skip ci]`;
9. publica `dist` en GitHub Pages.

`.github/workflows/refresh-catalog.yml` actualiza la base cada seis horas.

En **Settings → Pages** debe estar seleccionada la fuente **GitHub Actions**.

## Política

Solo se integran cámaras públicas y fuentes cuya visualización o reutilización esté permitida. Cams no intenta acceder a cámaras privadas, eludir autenticación, sortear cuotas comerciales ni copiar catálogos protegidos.
