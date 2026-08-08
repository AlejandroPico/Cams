# Camaras anadidas a mano

`cameras.csv` permite incorporar camaras que ningun agregador publica: una webcam
municipal, la de un puerto, la de una estacion de esqui o la panoramica de un
ayuntamiento. Se lee en cada ejecucion del catalogo, asi que basta con anadir una
fila y hacer commit.

## Como anadir una camara

1. Localiza la **pagina original del propietario**, no la de un directorio. Los
   directorios como WorldCam sirven para *encontrar* la camara; lo que se guarda
   aqui es la fuente original.
2. Copia la URL de la imagen o del reproductor.
3. Anade una fila y haz commit.

## Columnas

| Columna | Obligatoria | Notas |
|---|---|---|
| `title` | si | Nombre visible |
| `lat`, `lon` | si | Grados decimales, con punto |
| una fuente | si | `snapshotUrl`, `embedUrl`, `url` o `videoId` |
| `id` | no | Si se omite se deriva del titulo y las coordenadas |
| `type` | no | Se deduce de la fuente si se deja vacio |
| `category` | no | `city`, `coast`, `landscape`, `mountain`, `port`, `traffic`... |
| `country`, `city`, `timezone` | no | Mejoran el buscador y la hora local |
| `attribution`, `license` | no | Credito del propietario |

## Ejemplo

```csv
,Puerto de Barcelona,España,Barcelona,41.3510,2.1760,port,,Port de Barcelona,online,Europe/Madrid,,,,https://ejemplo.org/puerto.jpg,https://ejemplo.org,300,Port de Barcelona,
```

Las filas sin coordenadas validas o sin ninguna fuente de imagen se descartan y se
avisa en el registro de la ejecucion, con su numero de linea.

## Prioridad

Estas camaras entran con prioridad 10, por delante de los agregadores. Es
deliberado: si te has molestado en anadirla a mano, mandas tu.
