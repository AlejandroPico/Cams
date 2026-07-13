# Fuentes de cámaras públicas

Cams importa exclusivamente fuentes gratuitas cuya consulta pública está documentada. Cada adaptador falla de forma independiente y conserva en SQLite los datos obtenidos en ejecuciones anteriores.

El recuento vigente por proveedor, país, tipo de medio, categoría y estado se publica automáticamente en:

```text
public/data/catalog-meta.json
```

## España: DGT National Access Point

- Ámbito: red estatal española, excepto las redes gestionadas directamente por Cataluña y País Vasco.
- Tipo: snapshots de información viaria.
- Catálogo: DATEX II 3.7.
- Endpoint: `https://nap.dgt.es/datex2/v3/dgt/DevicePublication/camaras_datex2_v37.xml`.
- Frecuencia usada por Cams: 180 segundos.
- Licencia registrada: Creative Commons Attribution.

El parser identifica los elementos XML por su nombre local y recupera identificador, carretera, coordenadas y URL de imagen, aunque el proveedor cambie los prefijos de espacio de nombres.

## Cataluña: Servei Català de Trànsit / CIVICAT

El SCT mantiene su propia red, separada de la DGT. Cams incorpora un adaptador para el WFS público de MCT/CIVICAT:

```text
https://mct.gencat.cat/sct-gis/wfs
```

El importador:

1. consulta `GetCapabilities`;
2. descubre capas cuyo nombre contiene `camera`, `càmera`, `cctv` o `webcam`;
3. solicita las entidades en GeoJSON y EPSG:4326;
4. extrae coordenadas, carretera, punto kilométrico, municipio e imagen cuando está publicada.

El servidor utiliza parámetros Diffie-Hellman antiguos que OpenSSL 3 rechaza con su nivel de seguridad normal. `sct_catalog.py` aplica `SECLEVEL=1` únicamente a este host y conserva la validación del certificado. El nivel TLS del resto del proyecto no se modifica.

Cuando el WFS solo publica la ubicación, la cámara se conserva como enlace `unknown`; no se marca falsamente como snapshot online.

## Madrid: cámaras urbanas y Calle 30

Cams incorpora dos conjuntos abiertos del Ayuntamiento de Madrid:

- cámaras urbanas de tráfico en KML;
- cámaras de Calle 30 en XML.

Se importan nombre, coordenadas, imagen pública cuando está incluida y enlace al conjunto original. Los snapshots urbanos se refrescan cada diez minutos y los de Calle 30 cada cinco minutos.

## Barcelona: red municipal histórica

- Ámbito: 27 intersecciones, plazas y tramos de las rondas de Barcelona.
- Tipo: snapshot cuando la página municipal todavía devuelve una imagen; enlace público cuando no lo hace.
- Coordenadas: una posición individual por cámara, no un único punto central de Barcelona.
- Frecuencia usada por Cams: 300 segundos.
- Atribución: Ajuntament de Barcelona.

Las antiguas páginas municipales no siempre exponen ya la imagen directamente. En esos casos el reproductor muestra una explicación y un botón **abrir fuente original**, en lugar del mensaje genérico «formato no compatible».

## Finlandia: Fintraffic Digitraffic

- Ámbito: red viaria nacional.
- Tipo: cámaras meteorológicas de carretera, normalmente con varios encuadres por estación.
- Endpoint: `https://tie.digitraffic.fi/api/weathercam/v1/stations`.
- Imagen: `https://weathercam.digitraffic.fi/{presetId}.jpg`.
- Frecuencia usada por Cams: 600 segundos.
- Atribución: Fintraffic / Digitraffic.

El adaptador envía la cabecera `Digitraffic-User`, negocia JSON comprimido con gzip e importa cada preset como una cámara independiente.

## Reino Unido: Transport for London

- Ámbito: Greater London.
- Tipo: snapshots de tráfico.
- Endpoint: `https://api.tfl.gov.uk/Place/Type/JamCam`.
- Frecuencia usada por Cams: 60 segundos.
- Licencia registrada: Open Government Licence v3.0.

Esta fuente cubre Londres, no todo el Reino Unido. Las redes de National Highways, Gales, Escocia e Irlanda del Norte se mantienen como líneas de trabajo separadas.

## Alemania: Autobahn API

Cams consulta la API oficial:

```text
https://verkehr.autobahn.de/o/autobahn/
https://verkehr.autobahn.de/o/autobahn/{roadId}/services/webcam
```

La API no requiere clave. El adaptador recorre las autopistas anunciadas y procesa `coordinate`, `imageurl` y `linkurl`. Si el servicio devuelve listas vacías, no se inventan registros ni se reutilizan imágenes antiguas.

## Estados Unidos

### Caltrans CWWP2

- Doce distritos de California.
- Snapshots y, cuando existe, stream.
- Frecuencia: 60 segundos.
- Página pública: `https://quickmap.dot.ca.gov/`.

El fallo de un distrito no bloquea los otros once.

### 511 New York

- Endpoint: `https://511ny.org/api/getcameras?format=json`.
- Sin credenciales.
- Snapshots y `VideoUrl` cuando está disponible.
- Se descartan registros marcados por el proveedor como deshabilitados o bloqueados.

### Oregon TripCheck

- Inventario: `https://tripcheck.com/Scripts/map/data/cctvinventory.js`.
- Imagen: `https://tripcheck.com/RoadCams/cams/{filename}`.
- Sin credenciales.

### Redes 511 con clave gratuita

El adaptador `keyed_catalog.py` admite estas redes IBI 511:

| Secreto de GitHub | Red |
|---|---|
| `DOT_GA_API_KEY` | Georgia 511 |
| `DOT_FL_API_KEY` | Florida 511 |
| `DOT_AZ_API_KEY` | Arizona 511 |
| `DOT_ID_API_KEY` | Idaho 511 |
| `DOT_UT_API_KEY` | Utah 511 |
| `DOT_LA_API_KEY` | Louisiana 511 |
| `DOT_PA_API_KEY` | Pennsylvania 511 |
| `DOT_SC_API_KEY` | South Carolina 511 |
| `DOT_MA_API_KEY` | Massachusetts 511 |

Las claves se solicitan gratuitamente en el portal 511 correspondiente. Se guardan en **Settings → Secrets and variables → Actions** y nunca se escriben en SQLite, JSON o JavaScript.

## Canadá

### DriveBC

- Catálogo abierto CSV de Columbia Británica.
- Dataset oficial de `catalogue.data.gov.bc.ca`.
- Las imágenes se derivan del identificador oficial de cámara.
- Frecuencia usada por Cams: 300 segundos.

### Ontario 511

- Endpoint: `https://511on.ca/api/v2/get/cameras?format=json`.
- Sin credenciales en la integración actual.
- Se utiliza la primera vista habilitada de cada cámara.

## Suecia: Trafikverket, preparada

La API nacional requiere una clave gratuita. El secreto esperado es:

```text
TRAFIKVERKET_KEY
```

Endpoint:

```text
POST https://api.trafikinfo.trafikverket.se/v2/data.json
```

Cams consulta el objeto `Camera` y recupera `Id`, `Name`, `Geometry.WGS84` y `PhotoUrl`. Sin el secreto, la etapa se omite sin producir error.

## Singapur: LTA Traffic Images

- Endpoint: `https://api.data.gov.sg/v1/transport/traffic-images`.
- Snapshots de tráfico con coordenadas y dimensiones.
- Frecuencia usada por Cams: 60 segundos.
- Singapore Open Data Licence.

## Nueva Zelanda: GeoNet

- Cámaras públicas de volcanes.
- Endpoint: `https://images.geonet.org.nz/volcano/cameras/all.json`.
- Frecuencia usada por Cams: 300 segundos.
- Licencia: CC BY 3.0 NZ.

## Política para YouTube

Los 144 registros históricos continúan almacenados en SQLite para no perder el trabajo de catalogación, pero permanecen inactivos por defecto.

Solo se publican los identificadores incluidos en:

```text
data/verified_youtube.json
```

Esto evita mostrar como cámara en directo:

- emisiones terminadas;
- vídeos grabados;
- contenidos ajenos a la ubicación;
- identificadores reutilizados;
- canales que bloquean la inserción.

## Arquitectura de importación

```text
build_catalog.py          fuentes base
quality_catalog.py        depuración y lista blanca de YouTube
extend_catalog.py         DGT, Madrid y Barcelona
fintraffic_catalog.py     Finlandia
international_catalog.py  Alemania, Estados Unidos y Canadá
sct_catalog.py            compatibilidad aislada con SCT/CIVICAT
keyed_catalog.py          fuentes gratuitas con secreto opcional
catalog_stats.py          recuentos por país, medio, categoría y estado
```

`run_catalog.py` ejecuta la cadena completa. Una fuente caída no elimina las cámaras almacenadas por las demás.

## Criterios de incorporación

Antes de activar otro proveedor deben registrarse:

- URL pública del proveedor;
- atribución;
- licencia o términos;
- intervalo razonable de actualización;
- categoría;
- política de inserción o enlace;
- nivel de privacidad de la vista.

No se incorporan cámaras privadas, endpoints obtenidos mediante credenciales filtradas, fuentes que prohíban la redistribución ni mecanismos que eludan cuotas, autenticación o protecciones comerciales.
