# Cams

Cams es un visor mundial de webcams públicas, directos y snapshots. La aplicación abre en un globo interactivo, permite localizar cámaras y ofrece una segunda vista de mosaico minimalista.

## Estado actual

La última ejecución confirmada ha generado **15.351 cámaras activas**:

- 15.287 marcadas online;
- 64 ubicaciones o fuentes todavía sin verificar;
- 144 vídeos históricos de YouTube archivados e inactivos.

Cobertura confirmada por país:

| País | Cámaras |
|---|---:|
| Estados Unidos | 3.892 |
| Reino Unido | 3.705 |
| Canadá | 2.671 |
| España | 2.358 |
| Finlandia | 2.273 |
| Irlanda | 242 |
| Islandia | 165 |
| Países Bajos | 26 |
| Nueva Zelanda | 11 |
| Singapur | 8 |

El incremento principal de esta iteración corresponde a **2.823 cámaras de National Highways en Inglaterra**, añadidas sobre las 882 JamCams de Londres.

Los recuentos y el último diagnóstico de cada proveedor se regeneran en:

```text
public/data/catalog-meta.json
```

## Arquitectura

- React, TypeScript y Vite.
- MapLibre GL JS con proyección `globe`.
- SQLite como fuente maestra del catálogo.
- Python para importar, validar, depurar y exportar datos.
- Node.js 24 y Python 3.13 en GitHub Actions.
- Copia JSON integrada en el bundle como protección frente a errores 404.

## Mapa mundial

El visor ofrece tres bases intercambiables:

- **Satélite:** Esri World Imagery.
- **Geográfico:** OpenStreetMap.
- **Relieve:** OpenTopoMap.

El modo **Terreno 3D** añade elevación, hillshade y cámara inclinada. El globo incluye zoom urbano, brújula, pantalla completa, clústeres numéricos, iconos individuales, estado solar por color, localidades opcionales y filtros compartidos con el mosaico.

Al pulsar una cámara se abre una ventana flotante arrastrable con medio, ubicación, hora local, proveedor, estado y enlace de origen. Puede minimizarse, cerrarse, abrirse a pantalla completa y restablecer su posición con doble clic en la cabecera.

## Ubicación y antigüedad de las capturas

Cada snapshot muestra ahora una banda inferior con:

- ciudad, localidad, región y país disponibles;
- proveedor de la cámara;
- antigüedad actualizada cada quince segundos.

Cams distingue dos casos:

- **`captura hace…`**: el proveedor publicó una fecha real de la imagen;
- **`imagen recibida hace…`**: la fuente no facilita la hora de exposición y solo puede indicarse cuándo cargó el fotograma en el navegador.

La hora exacta aparece al mantener el cursor sobre el texto. No se presenta la hora de descarga como si fuera necesariamente la hora real de captura. Actualmente la marca temporal verificada se conserva para Singapore LTA; otros proveedores se añadirán únicamente cuando documenten un campo equivalente.

## Reproductor y fuentes no insertables

No todas las administraciones publican un JPG o stream insertable desde GitHub Pages. Algunas solo ofrecen una página, exigen una cabecera propia o bloquean el hotlink.

El reproductor distingue entre snapshot, HLS, vídeo, iframe autorizado, cámara offline, reproducción bloqueada, ubicación sin imagen insertable y error temporal. Cuando no puede reproducirse dentro de Cams, la ficha explica la causa y muestra **abrir fuente original**.

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

Cada ejecución exporta:

```text
public/data/cameras.json
public/data/catalog-meta.json
public/data/cams.sqlite3
src/data/catalog.seed.json
```

Documentación:

- [Esquema y columnas](docs/SQLITE_DATABASE.md)
- [Recuperación de SQLite](docs/SQLITE_RECOVERY.md)
- [Fuentes y condiciones](docs/CAMERA_SOURCES.md)
- [Cobertura y hoja de ruta](docs/COVERAGE_ROADMAP.md)

## Pipeline de importación

```text
build_catalog.py             fuentes base
quality_catalog.py           países y lista blanca de YouTube
extend_catalog.py            DGT, Madrid y Barcelona
fintraffic_catalog.py        Finlandia
europe_catalog.py            Irlanda, Islandia y Países Bajos
western_europe_catalog.py    Inglaterra y pruebas de Bruselas
international_catalog.py     Estados Unidos, Canadá y Autobahn Alemania
north_america_catalog.py     Alberta, Toronto y pruebas adicionales
sct_catalog.py               compatibilidad aislada con SCT/CIVICAT
keyed_catalog.py             fuentes gratuitas con secreto opcional
catalog_stats.py             estadísticas y salud por proveedor
capture_metadata.py          fechas de captura verificadas
```

Cada proveedor falla de forma independiente. Una red caída no elimina las cámaras válidas de las demás.

## Europa occidental

### Reino Unido

- Transport for London: 882 cámaras de Londres.
- National Highways: 2.823 cámaras de autopistas y carreteras principales de Inglaterra.
- Total confirmado: 3.705.

Traffic England ya no responde en su endpoint histórico. Cams utiliza como respaldo el resultado CC0 del recolector `traffic_england_gb` de All the Places, manteniendo las imágenes y páginas oficiales de National Highways.

### Alemania

La Autobahn API oficial continúa integrada, pero su colección `webcam` devuelve cero registros. No se publican puntos ficticios para compensarlo. La siguiente fase investigará BayernInfo y redes regionales.

### Bélgica

La prueba del endpoint histórico de Bruxelles Mobilité no se ha activado: el HTTPS presenta un certificado que no coincide con el dominio y el HTTP ya no devuelve JSON válido. Flandes y Valonia requieren adaptadores separados y no se copiarán desde agregadores comerciales.

### Francia, Luxemburgo y Portugal

No se ha encontrado todavía un inventario nacional anónimo, estable y reutilizable con coordenadas e imágenes directas. Francia está fragmentada entre DIR y concesionarias; Luxemburgo muestra cámaras mediante CITA sin exponer un catálogo abierto documentado; Portugal requiere revisar Infraestruturas de Portugal y operadores. Permanecen como prioridad de la siguiente ampliación.

## Control de calidad de YouTube

Los 144 vídeos históricos permanecen en SQLite, pero están inactivos. Solo se publican identificadores incluidos expresamente en:

```text
data/verified_youtube.json
```

Así, una cifra elevada no se consigue presentando grabaciones o emisiones terminadas como directos.

## Fuentes gratuitas activas

- DGT DATEX II, Ayuntamiento de Madrid, Madrid Calle 30 y Barcelona histórica.
- Fintraffic.
- Transport for London y National Highways.
- Transport Infrastructure Ireland.
- Vegagerðin de Islandia.
- Rijkswaterstaat de Países Bajos.
- Caltrans, 511 New York y Oregon TripCheck.
- DriveBC, Ontario 511, Alberta 511 y Toronto Open Data.
- Singapore LTA y GeoNet New Zealand.

## Fuentes gratuitas con clave preparada

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

- `TRAFIKVERKET_KEY`: red nacional de Suecia.
- `ITS_KR_KEY`: streams HLS de Corea del Sur.
- `DOT_*`: redes 511 estadounidenses.

Se guardan en:

```text
Settings → Secrets and variables → Actions
```

Nunca se escriben en SQLite, JSON, commits o JavaScript.

## Desarrollo

```bash
nvm use
npm install
npm run catalog:refresh
npm run dev
```

Comprobación y compilación:

```bash
npm run catalog:check
npm run build
```

Regeneración sin proveedores remotos:

```bash
npm run catalog:offline
```

## GitHub Actions

`deploy.yml` valida SQLite, ejecuta los proveedores, archiva YouTube no verificado, genera estadísticas y fechas verificadas, compila, persiste el catálogo y publica GitHub Pages.

`refresh-catalog.yml` actualiza la base cada seis horas.

En **Settings → Pages** debe estar seleccionada la fuente **GitHub Actions**.

## Política

Solo se integran cámaras públicas y fuentes cuya visualización o reutilización esté permitida. Cams no intenta acceder a cámaras privadas, eludir autenticación, sortear cuotas comerciales ni copiar catálogos protegidos.
