# Fuentes de cámaras públicas

Cams importa exclusivamente fuentes gratuitas cuya consulta pública está documentada. Cada adaptador falla de forma independiente y conserva en SQLite los datos obtenidos por las demás redes.

El recuento vigente se genera automáticamente en:

```text
public/data/catalog-meta.json
```

La ejecución confirmada del 13 de julio de 2026 contiene **12.508 cámaras activas**, 12.444 online y 64 sin verificar.

## España

### DGT National Access Point

- Red estatal, excepto las redes gestionadas directamente por Cataluña y País Vasco.
- Catálogo DATEX II 3.7.
- Endpoint: `https://nap.dgt.es/datex2/v3/dgt/DevicePublication/camaras_datex2_v37.xml`.
- Snapshot y coordenadas oficiales.
- Frecuencia: 180 segundos.
- Licencia registrada: Creative Commons Attribution.
- Recuento confirmado: 1.932.

### Ayuntamiento de Madrid

- Cámaras urbanas: 357.
- Madrid Calle 30: 37.
- Coordenadas e imágenes obtenidas de los conjuntos municipales abiertos.

### Barcelona

Cams conserva 27 ubicaciones municipales históricas con coordenadas individuales. Algunas páginas antiguas ya no exponen el JPG; esos registros quedan como `link` o `unknown` y el reproductor muestra **abrir fuente original** en vez de «formato no compatible».

### Servei Català de Trànsit / CIVICAT

El adaptador `sct_catalog.py` consulta:

```text
https://mct.gencat.cat/sct-gis/wfs
```

El servidor utiliza criptografía TLS antigua. Cams reduce el nivel criptográfico solo para ese host, pero mantiene la validación del certificado y del nombre. Después de negociar TLS, el servidor responde **HTTP 403 Forbidden** a GitHub Actions. Por tanto:

- no se desactiva la validación TLS;
- no se usan credenciales filtradas;
- no se publican cámaras ficticias del SCT;
- la integración queda pendiente de un feed moderno, una autorización o una cuenta oficial.

## Europa

### Finlandia — Fintraffic

- Endpoint: `https://tie.digitraffic.fi/api/weathercam/v1/stations`.
- Imagen: `https://weathercam.digitraffic.fi/{presetId}.jpg`.
- Se importa cada preset como una cámara independiente.
- Recuento confirmado: 2.272.

### Reino Unido — Transport for London

- Endpoint: `https://api.tfl.gov.uk/Place/Type/JamCam`.
- Licencia: Open Government Licence v3.0.
- Cobertura: Greater London, no todo el Reino Unido.
- Recuento confirmado: 882.

### Irlanda — Transport Infrastructure Ireland

- Endpoint GraphQL: `https://traffic.tii.ie/api/graphql`.
- Capa: `normalCameras`.
- Se exigen coordenadas reales, estado activo y una vista `IMAGE`.
- Licencia registrada: CC BY 4.0.
- Recuento confirmado: 242.

### Islandia — Vegagerðin / umferdin.is

- Página pública: `https://umferdin.is/en/cameras`.
- El importador lee el catálogo SSR publicado por el propio portal.
- Se extraen identificador, carretera, coordenadas e imágenes reales.
- Recuento confirmado: 165.

### Países Bajos — Rijkswaterstaat

- Endpoint: `https://api.rwsverkeersinfo.nl/api/cameras/`.
- Se utilizan `latitude`, `longitude` y `static_url`.
- Recuento confirmado: 26.

### Alemania — Autobahn API

```text
https://verkehr.autobahn.de/o/autobahn/
https://verkehr.autobahn.de/o/autobahn/{roadId}/services/webcam
```

El adaptador recorre las autopistas anunciadas. En la ejecución actual la API devolvió colecciones de webcam vacías, por lo que Alemania no se contabiliza como cubierta.

### Suecia — Trafikverket preparada

Requiere una clave gratuita guardada como:

```text
TRAFIKVERKET_KEY
```

Cams consulta el objeto `Camera` en:

```text
POST https://api.trafikinfo.trafikverket.se/v2/data.json
```

Recupera `Id`, `Name`, `Geometry.WGS84` y `PhotoUrl`. Sin secreto, la etapa se omite sin error.

## Estados Unidos

### California — Caltrans

- Doce distritos de CWWP2.
- Snapshots y algunos streams.
- Recuento confirmado: 883.

### Nueva York — 511 New York

- Endpoint: `https://511ny.org/api/getcameras?format=json`.
- Snapshots y `VideoUrl` cuando está publicado.
- Se excluyen cámaras bloqueadas o deshabilitadas.
- Recuento confirmado: 1.868.

### Oregón — TripCheck

- Inventario: `https://tripcheck.com/Scripts/map/data/cctvinventory.js`.
- Imagen: `https://tripcheck.com/RoadCams/cams/{filename}`.
- Recuento confirmado: 1.127.

### Washington State DOT

- Endpoint preparado: `https://data.wsdot.wa.gov/log/public/cameras.json`.
- La última ejecución no produjo registros válidos, por lo que no se cuenta como cobertura activa hasta revisar el formato o la disponibilidad del endpoint.

### Redes 511 con clave gratuita

| Secreto | Red |
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

## Canadá

### Columbia Británica — DriveBC

- Catálogo CSV abierto del Gobierno de British Columbia.
- Recuento confirmado: 1.034.

### Ontario — Ontario 511

- Endpoint: `https://511on.ca/api/v2/get/cameras?format=json`.
- Recuento confirmado: 934.

### Alberta — Alberta 511

- Endpoint: `https://511.alberta.ca/api/v2/get/cameras?format=json`.
- Se usa la primera vista habilitada de cada cámara.
- Recuento confirmado: 367.

### Toronto Open Data

- Catálogo municipal GeoJSON.
- Coordenadas y `IMAGEURL` oficiales.
- Recuento confirmado: 336.

## Asia y Pacífico

### Corea del Sur — ITS Korea preparada

La API oficial devuelve coordenadas y streams HLS de autopistas y carreteras nacionales. Requiere una clave gratuita:

```text
ITS_KR_KEY
```

Endpoint:

```text
https://openapi.its.go.kr/api/NCCTVInfo
```

El adaptador consulta los tipos `ex` e `its` para toda la península. Sin secreto, la fuente se omite limpiamente.

### Japón

No se han activado las listas manuales encontradas porque son recopilaciones de YouTube sin garantía de emisión. La cobertura japonesa se incorporará mediante fuentes oficiales de MLIT, prefecturas, NEXCO, volcanes, puertos o meteorología cuando se verifiquen sus términos y formatos.

### Singapur — LTA

- Endpoint: `https://api.data.gov.sg/v1/transport/traffic-images`.
- Recuento confirmado: 8.

### Nueva Zelanda — GeoNet

- Endpoint: `https://images.geonet.org.nz/volcano/cameras/all.json`.
- Licencia: CC BY 3.0 NZ.
- Recuento confirmado: 11.

## Política para YouTube

Los 144 registros históricos se conservan en SQLite, pero permanecen inactivos. Solo se publican los identificadores incluidos en:

```text
data/verified_youtube.json
```

Esto evita presentar como directo emisiones terminadas, grabaciones, vídeos ajenos a la ubicación o canales que bloquean la inserción.

## Arquitectura de importación

```text
build_catalog.py             fuentes base
quality_catalog.py           países y control de calidad de YouTube
extend_catalog.py            DGT, Madrid y Barcelona
fintraffic_catalog.py        Finlandia
europe_catalog.py            Irlanda, Islandia y Países Bajos
international_catalog.py     EE. UU., Canadá y Autobahn
north_america_catalog.py     Alberta, Toronto y Washington
sct_catalog.py               compatibilidad aislada con SCT
keyed_catalog.py             Suecia, Corea y redes 511 con clave
catalog_stats.py             estadísticas de cobertura
```

## Criterios de incorporación

Para publicar una cámara se exige:

- coordenadas válidas;
- proveedor identificable;
- URL de origen;
- tipo de medio correcto;
- estado diferenciado;
- atribución y términos registrados;
- ausencia de secretos en el navegador;
- fallo aislado por proveedor.

No se incorporan cámaras privadas, credenciales filtradas, catálogos comerciales copiados, coordenadas inventadas ni mecanismos que eludan autenticación o cuotas.

## Windy Webcams

Camaras de calle, paisaje, costa, montana y turismo de todo el mundo. Complementa las
redes de trafico oficiales, que solo cubren carreteras.

- Endpoint: `https://api.windy.com/webcams/api/v3/webcams`
- Clave gratuita: secreto `WINDY_WEBCAMS_KEY`
- Adaptador: `scripts/catalog/windy_catalog.py`
- Diagnostico: `scripts/catalog/windy_probe.py`
- Sincronizacion: `.github/workflows/windy-sync.yml`, diaria

### Limites medidos del plan gratuito

| Parametro | Valor |
|---|---|
| `limit` maximo por pagina | 50 |
| `offset` maximo | 1000 |
| Registros por consulta | 1050 |
| Catalogo declarado | 71.565 |

Hay paises que superan el tope por si solos, asi que se trocea primero por pais y,
cuando el pais no cabe, por pais y categoria. Las particiones que aun asi tocan techo
se registran en el log para poder subdividirlas mas adelante.

### Condiciones que impone Windy

1. Cada imagen debe enlazar con la ficha (`urls.detail`) o el reproductor (`player`).
2. Debe mostrarse la cortesia *Webcams provided by windy.com - add a webcam* en el
   contexto donde aparecen sus camaras. Implementada en `CameraPanel` y limitada a
   las camaras cuyo `providerCode` es `WINDY_WEBCAMS`.
3. Solo se pueden usar las URLs que entrega la API, sin ampliar las imagenes.

### Por que no se guardan las imagenes

Las URLs de imagen estan protegidas por tokens que caducan a los diez minutos en el
plan gratuito y despues devuelven 401. Guardarlas en un catalogo estatico regenerado
cada pocas horas produciria imagenes rotas, y ademas chocaria con la regla de
`CAMERA_SOURCE_POLICY.md` que prohibe copiar de forma permanente lo que la fuente solo
autoriza de forma temporal. Se guarda `player.day`, que es un iframe estable y cumple
por si mismo la condicion de enlazado.

## Proveedores retirados

Se documentan aqui para no volver a intentarlos sin motivo y para que la lista de
fuentes no aparente funcionar mas de lo que funciona.

### Autobahn GmbH (Alemania)

Retirado. Su API responde 200 en `/{autopista}/services/webcam` pero devuelve
`{"webcam": []}` en las 113 autopistas. No es un endpoint equivocado ni un fallo de
red: ya no publican webcams. El adaptador se conserva por si vuelven a hacerlo. Las
camaras alemanas del catalogo proceden de Windy.

### Bruxelles Mobilite (Belgica)

Retirado. Comprobado:

| Endpoint | Resultado |
|---|---|
| `www.bruxellesmobilite.irisnet.be/cameras/json/fr/` | certificado que no coincide con el dominio; sin verificar devuelve HTML |
| `mobilite-mobiliteit.brussels/cameras/json/fr/` | HTML, no JSON |
| `data.mobility.brussels/traffic/api/camera/` | 404 |
| GeoServer `bm_camera` | 404 |
| `opendata.brussels.be` | ningun dataset de camaras |

El problema no era el certificado sino que el API JSON ya no existe.

### Servei Catala de Transit: cambio de fuente

El WFS de `mct.gencat.cat/sct-gis/wfs` devuelve 403 a peticiones automatizadas. Se
sustituye por el fichero abierto oficial de la Generalitat, que responde con
normalidad y no exige artificios de TLS:

    http://www.gencat.cat/transit/opendata/cameres.xml

Es un FeatureCollection de WFS con 164 camaras y los campos geom, carretera,
municipi, pk, link y font. Las coordenadas vienen proyectadas, asi que el adaptador
incluye la conversion de UTM 31N a WGS84 y descarta cualquier punto que caiga fuera
de Catalunya, en lugar de publicar ubicaciones absurdas.

### WSDOT: cambio de fuente

`data.wsdot.wa.gov/log/public/cameras.json` devuelve 404. Se sustituye por el
servicio ArcGIS abierto de WSDOT, que no exige codigo de acceso y publica 1.533
camaras. No admite paginacion: pasarle `resultRecordCount` provoca un 400.
