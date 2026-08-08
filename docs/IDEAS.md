# Ideas de mejora

Estado del proyecto al cerrar esta sesion: **68.627 camaras** en 125 paises, frente a
las 15.351 del inicio.

Las ideas van ordenadas por relacion entre lo que aportan y lo que cuestan. La
columna *Esfuerzo* es orientativa: bajo es cosa de un rato, alto son varias sesiones.

## 1. Cobertura: mas camaras y mejor repartidas

| Idea | Por que | Esfuerzo |
|---|---|---|
| **Cuarto nivel de troceado en Windy** | El registro de la sincronizacion marca que particiones tocan el tope de 1.050. Estados grandes como California siguen truncados. Subdividir esas por `nearby` (lat, lon, radio), que la sonda confirmo que funciona. | Medio |
| **Fuentes espanolas no viales** | Es la carencia mas visible: 2.582 camaras de trafico frente a 1.043 del resto. Windy solo publica 1.430 en Espana, asi que no puede compensarlo. Candidatas: Euskadi (da timeout desde los runners, habria que reintentar), Navarra, Aragon, Baleares, puertos del Estado, estaciones de esqui. | Medio |
| **Escribir a WorldCam** | Sus condiciones mencionan acuerdos con *Partners*. Un correo a info@worldcam.eu pidiendo acceso para un proyecto abierto y sin animo de lucro cuesta cinco minutos y es la via legitima a un catalogo que copiar no podemos. | Bajo |
| **Redes 511 de EE. UU. con clave** | Ya hay adaptador escrito para nueve estados. Solo faltan las claves gratuitas en los secretos del repositorio. | Bajo |
| **Suecia y Corea del Sur** | Mismo caso: adaptadores listos, faltan `TRAFIKVERKET_KEY` e `ITS_KR_KEY`. | Bajo |
| **Reintentar Bruselas y Autobahn cada varios meses** | Se retiraron con motivo documentado. Una comprobacion periodica evita que se queden olvidados si vuelven. | Bajo |

## 2. Calidad: que lo que se ve funcione

| Idea | Por que | Esfuerzo |
|---|---|---|
| **Verificar que las imagenes cargan** | Hoy el estado `online` significa que el proveedor la lista, no que la imagen exista. Un comprobador periodico por muestreo detectaria las rotas y marcaria su estado de verdad. Es probablemente lo que mas mejoraria la sensacion de uso. | Medio |
| **Detectar camaras que bloquean el hotlink** | Algunas fuentes exigen `Referer` propio y fallan solo desde GitHub Pages. Distinguirlas de las caidas evita culpar al proveedor equivocado. | Medio |
| **Deduplicacion por proximidad** | Ahora se comparan coordenadas exactas a 11 metros. Dos registros de la misma camara con coordenadas ligeramente distintas se cuelan. Un radio de 50-100 m con comparacion de titulo los cazaria. | Bajo |
| **Revisar los duplicados internos de Windy** | Hay 2.448 puntos con varias camaras identicas en titulo y coordenada, seis en algunos casos. Decidimos conservarlas por si son encuadres distintos, pero convendria comprobar unas cuantas y actuar en consecuencia. | Bajo |
| **Reactivar camaras recuperadas** | La poda las marca inactivas, pero si el organismo vuelve a publicarlas no hay nada que las devuelva salvo que reaparezcan con el mismo identificador. Una revision periodica de las inactivas cerraria el ciclo. | Bajo |

## 3. Rendimiento y arquitectura

| Idea | Por que | Esfuerzo |
|---|---|---|
| **Servir el catalogo por trozos** | `cameras.json` son 47 MB y el navegador lo descarga entero para pintar un mapa donde se ven veinte camaras. Partirlo por continente o por rejilla geografica y cargar bajo demanda seria el mayor salto de velocidad posible. | Alto |
| **Sacar los datos generados del historial de git** | Ya bajamos de 179 a 38 MB por ejecucion, pero cada pasada sigue guardando una copia completa. En unos meses el repositorio pesara varios gigas. Alternativas: publicar el catalogo como *release asset*, usar una rama huerfana solo de datos, o Git LFS. | Medio |
| **Dividir el bundle** | 1,79 MB de JavaScript inicial. MapLibre y Cesium podrian cargarse solo cuando se usan. | Medio |
| **Indice geoespacial en el cliente** | Con 68.000 puntos, filtrar y agrupar en cada movimiento del mapa se nota. Una rejilla o un R-tree lo dejaria fluido. | Medio |

## 4. Interfaz

| Idea | Por que | Esfuerzo |
|---|---|---|
| **Favoritos** | Guardar camaras concretas y un modo mosaico que use solo esas. Encaja con el uso de salvapantallas y no depende de filtros. | Bajo |
| **Enlaces compartibles** | Codificar posicion del mapa y filtros en la URL, para volver a una vista o enviarla. | Bajo |
| **Ordenar el mosaico por hora local** | Con rotacion automatica salen muchas camaras nocturnas a oscuras. Priorizar las que estan de dia mejora mucho el resultado. | Bajo |
| **Filtro por hora local o luz** | Lo mismo, pero controlado por ti en vez de automatico. | Bajo |
| **Buscador con tolerancia a erratas** | Hoy la busqueda es coincidencia literal: *coruna* no encuentra *A Coruna*. Normalizar acentos ayudaria. | Bajo |
| **Recordar la ultima camara abierta** | Reabrirla al volver, en la linea de las preferencias que ya se conservan. | Bajo |

## 5. Mantenimiento

| Idea | Por que | Esfuerzo |
|---|---|---|
| **Pruebas automaticas del pipeline** | Esta sesion encontro cuatro fallos que unas pruebas habrian cazado antes: el upsert roto, la ausencia de poda, la captura de errores estrecha y los codigos de region inventados. Un punado de pruebas sobre una base de ejemplo evitaria repetirlos. | Medio |
| **Aviso cuando un proveedor se cae** | Hoy hay que mirar `catalog-meta.json` a mano. Que el workflow avise cuando un proveedor pasa de tener camaras a cero. | Bajo |
| **Historico de recuentos** | Guardar la evolucion por proveedor y pais permite ver degradaciones lentas, que son las que pasan desapercibidas. | Bajo |
| **Documentar el CSV manual en el README** | Ya esta en `data/manual/README.md`, pero desde el README principal no se ve. | Bajo |

## Si solo se pudieran hacer tres

1. **Verificar que las imagenes cargan.** Es lo que separa un catalogo grande de un
   catalogo que funciona, y ahora mismo no hay forma de saber cuantas de las 68.627
   dan imagen de verdad.
2. **Servir el catalogo por trozos.** 47 MB por visita es el techo de todo lo demas.
3. **Fuentes espanolas no viales.** Es tu queja recurrente y la unica con solucion
   real: mas fuentes propias, una a una.
