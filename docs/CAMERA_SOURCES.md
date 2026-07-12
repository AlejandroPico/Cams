# Fuentes de cámaras públicas

Cams importa exclusivamente fuentes gratuitas cuya consulta pública está documentada. Cada adaptador falla de forma independiente y conserva en SQLite los datos obtenidos en ejecuciones anteriores.

## España: DGT National Access Point

- Ámbito: red estatal española, excepto las redes gestionadas directamente por Cataluña y País Vasco.
- Tipo: snapshots de información viaria.
- Catálogo: DATEX II 3.7.
- Endpoint: `https://nap.dgt.es/datex2/v3/dgt/DevicePublication/camaras_datex2_v37.xml`.
- Imagen: URL publicada por DATEX II o patrón público de Infocar.
- Frecuencia usada por Cams: 180 segundos.
- Licencia registrada: Creative Commons Attribution.

El parser no depende del prefijo XML concreto: identifica los elementos por su nombre local y recupera identificador, carretera, coordenadas y URL de imagen.

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

El adaptador prueba las páginas municipales históricas de `bcn.cat` y `transit.bcn.es`. Si una ubicación deja de proporcionar imagen, el registro se conserva como `unknown` para mantener la posición y la fuente, pero no se presenta falsamente como una cámara online.

## Finlandia: Fintraffic Digitraffic

- Ámbito: red viaria de Finlandia.
- Tipo: cámaras meteorológicas de carretera, normalmente con varios encuadres por estación.
- Endpoint: `https://tie.digitraffic.fi/api/weathercam/v1/stations`.
- Imagen: `https://weathercam.digitraffic.fi/{presetId}.jpg`.
- Frecuencia usada por Cams: 600 segundos.
- Atribución: Fintraffic / Digitraffic.

El adaptador envía la cabecera `Digitraffic-User`, importa cada preset como una cámara independiente y conserva el nombre de la estación y del encuadre.

## Caltrans CWWP2

- Ámbito: doce distritos de California.
- Tipo: cámaras de tráfico.
- Datos: coordenadas, nombre, snapshot y, cuando existe, stream.
- Frecuencia usada por Cams: 60 segundos.
- Proveedor: California Department of Transportation.
- Página pública: `https://quickmap.dot.ca.gov/`.

El importador consulta los doce endpoints `cctvStatusD01.json` a `cctvStatusD12.json`. Si un distrito no responde, se procesan los demás.

## Transport for London JamCams

- Ámbito: Greater London.
- Tipo: snapshots de tráfico.
- Endpoint: `https://api.tfl.gov.uk/Place/Type/JamCam`.
- Frecuencia usada por Cams: 60 segundos.
- Licencia registrada: Open Government Licence v3.0.

## Singapore LTA Traffic Images

- Ámbito: Singapur.
- Tipo: snapshots de tráfico con coordenadas y dimensiones.
- Endpoint: `https://api.data.gov.sg/v1/transport/traffic-images`.
- Frecuencia usada por Cams: 60 segundos.
- Condiciones registradas: Singapore Open Data Licence.

## GeoNet New Zealand

- Ámbito: cámaras de volcanes de Nueva Zelanda.
- Tipo: snapshots paisajísticos.
- Endpoint: `https://images.geonet.org.nz/volcano/cameras/all.json`.
- Frecuencia usada por Cams: 300 segundos.
- Licencia registrada: CC BY 3.0 NZ.

## Semilla histórica de Cams

Los 144 registros originales de YouTube se conservan para no perder ubicaciones ya recopiladas. Se importan como `unknown`, no como directos verificados. La reproducción puede haber terminado o el propietario puede impedir la inserción.

## Arquitectura de importación

El pipeline tiene dos fases:

```text
build_catalog.py   → fuentes base mundiales
extend_catalog.py  → España, Barcelona, Madrid y Finlandia
```

`run_catalog.py` ejecuta ambas. Si la ampliación europea falla temporalmente, el catálogo base válido se conserva y el despliegue puede continuar.

## Ampliación futura

Antes de activar otro proveedor deben registrarse:

- URL pública del proveedor;
- atribución;
- licencia o términos;
- intervalo razonable de actualización;
- categoría;
- política de inserción o enlace;
- nivel de privacidad de la vista.

No se deben incorporar cámaras privadas, endpoints obtenidos mediante credenciales filtradas, fuentes que prohíban la redistribución ni mecanismos que eludan cuotas o protecciones.
