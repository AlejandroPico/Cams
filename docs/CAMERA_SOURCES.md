# Fuentes de cámaras públicas

Cams importa exclusivamente fuentes gratuitas cuya consulta pública está documentada. Cada adaptador falla de forma independiente y conserva en SQLite los datos obtenidos en ejecuciones anteriores.

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

## Ampliación

Para añadir otro proveedor se incorpora una función en `scripts/catalog/build_catalog.py` que produzca los campos normalizados del esquema SQLite. Antes de activarlo deben registrarse:

- URL pública del proveedor;
- atribución;
- licencia o términos;
- intervalo razonable de actualización;
- categoría;
- política de inserción o enlace;
- nivel de privacidad de la vista.

No se deben incorporar cámaras privadas, endpoints obtenidos mediante credenciales filtradas, fuentes que prohíban la redistribución ni mecanismos que eludan cuotas o protecciones.
