# Cobertura territorial y hoja de ruta

Estados utilizados:

- **Operativa:** cámaras importadas y publicadas en SQLite.
- **Preparada:** adaptador terminado; falta una clave gratuita.
- **Bloqueada:** el proveedor impide la ejecución automatizada.
- **Investigación:** existe un portal público, pero todavía no se ha confirmado un feed estable y reutilizable.
- **Fragmentada:** no existe una red nacional única o depende de operadores regionales.

Los recuentos actuales están en `public/data/catalog-meta.json`. No se convierten estimaciones en cámaras importadas.

## Cobertura operativa confirmada

La ejecución del 13 de julio de 2026 confirmó **12.508 cámaras activas**:

| Territorio | Fuente | Registros |
|---|---|---:|
| España estatal | DGT DATEX II | 1.932 |
| Madrid | Ayuntamiento de Madrid | 357 |
| Madrid Calle 30 | Madrid Calle 30 | 37 |
| Barcelona | Red municipal histórica | 27 |
| Reino Unido, Londres | Transport for London | 882 |
| Irlanda | Transport Infrastructure Ireland | 242 |
| Finlandia | Fintraffic | 2.272 |
| Islandia | Vegagerðin | 165 |
| Países Bajos | Rijkswaterstaat | 26 |
| Estados Unidos, California | Caltrans | 883 |
| Estados Unidos, Nueva York | 511 New York | 1.868 |
| Estados Unidos, Oregón | TripCheck | 1.127 |
| Canadá, Columbia Británica | DriveBC | 1.034 |
| Canadá, Ontario | Ontario 511 | 934 |
| Canadá, Alberta | Alberta 511 | 367 |
| Canadá, Toronto | Toronto Open Data | 336 |
| Singapur | LTA | 8 |
| Nueva Zelanda | GeoNet | 11 |

Los 144 vídeos históricos de YouTube permanecen archivados y no forman parte del catálogo activo.

## Península ibérica

| Territorio | Estado | Próximo trabajo |
|---|---|---|
| España, red DGT | Operativa | Salud de snapshots y deduplicación con redes regionales. |
| Cataluña, SCT | Bloqueada | El WFS negocia TLS, pero responde 403 a GitHub Actions. Buscar feed moderno o autorización oficial. |
| Barcelona ciudad | Parcial | Sustituir las 27 páginas antiguas por el catálogo municipal vigente. |
| País Vasco | Investigación | Localizar inventario público del Gobierno Vasco y términos de inserción. |
| Navarra | Investigación | Revisar el portal regional de carreteras. |
| Portugal | Investigación | Infraestruturas de Portugal, ANSR y operadores de autopistas. |
| Andorra | Fragmentada | Movilidad, estaciones de esquí y meteorología por proveedor. |

## Europa occidental y central

| País | Estado | Prioridad |
|---|---|---|
| Reino Unido | Parcial | TfL operativo; faltan National Highways, Gales, Escocia e Irlanda del Norte. |
| Irlanda | Operativa | 242 cámaras TII; revisar autoridades urbanas. |
| Francia | Investigación | Bison Futé, DIR regionales y concesionarias; evitar listas manuales de YouTube. |
| Alemania | Adaptador sin datos | Autobahn API integrada, pero devuelve colecciones vacías. Revisar BayernInfo y regiones. |
| Austria | Investigación | ASFINAG y Tirol; verificar autenticación y términos. |
| Suiza | Investigación | ASTRA y redes cantonales. |
| Italia | Investigación | ANAS, Autostrade per l'Italia y redes regionales. |
| Países Bajos | Operativa parcial | 26 cámaras Rijkswaterstaat; buscar NDW y ciudades. |
| Bélgica | Fragmentada | Flandes, Valonia y Bruselas por separado. |
| Luxemburgo | Investigación | CITA y portal nacional de movilidad. |
| Liechtenstein | Fragmentada | Fuentes compartidas con Suiza y Austria. |

## Países nórdicos y bálticos

| País | Estado | Prioridad |
|---|---|---|
| Finlandia | Operativa | 2.272 encuadres Fintraffic. |
| Suecia | Preparada | Requiere `TRAFIKVERKET_KEY`. |
| Noruega | Investigación | Statens vegvesen y cámaras meteorológicas. |
| Dinamarca | Investigación | Vejdirektoratet / Trafikinfo. |
| Islandia | Operativa | 165 cámaras Vegagerðin. |
| Estonia | Investigación | Transpordiamet/Tark Tee; no usar coordenadas urbanas inventadas. |
| Letonia | Investigación | Latvijas Valsts ceļi. |
| Lituania | Investigación técnica | El catálogo existe, pero las imágenes exigen Referer; falta una solución autorizada compatible con Pages. |

## Europa central, oriental y balcánica

| País | Estado | Fuente prioritaria |
|---|---|---|
| Polonia | Investigación | GDDKiA y redes urbanas. |
| Chequia | Investigación | ŘSD y dopravniinfo.cz. |
| Eslovaquia | Investigación | Slovenská správa ciest. |
| Hungría | Investigación | Útinform y Magyar Közút. |
| Eslovenia | Investigación | Promet.si / DARS. |
| Croacia | Investigación | HAK y Hrvatske autoceste. |
| Rumanía | Investigación | CNAIR. |
| Bulgaria | Investigación | Road Infrastructure Agency. |
| Serbia | Investigación | Putevi Srbije. |
| Bosnia y Herzegovina | Fragmentada | Operadores por entidad. |
| Montenegro | Investigación | Monteput. |
| Macedonia del Norte | Investigación | Autoridad de carreteras. |
| Albania | Investigación | Autoridad de carreteras y municipios. |
| Grecia | Fragmentada | Concesionarias y Attiki Odos. |
| Moldavia | Investigación | Administración estatal de carreteras. |
| Ucrania | Investigación sensible | Solo fuentes civiles seguras, estables y no operativas. |

## Turquía y Mediterráneo oriental

| Territorio | Estado | Estrategia |
|---|---|---|
| Turquía | Fragmentada | KGM y municipios metropolitanos. |
| Chipre | Investigación | Autoridad de carreteras. |
| Malta | Investigación | Transport Malta y cámaras portuarias/meteorológicas. |

## Estados Unidos

Operativas sin credenciales:

- California: Caltrans, 883.
- Nueva York: 511NY, 1.868.
- Oregón: TripCheck, 1.127.

Preparadas con claves gratuitas:

- Georgia, Florida, Arizona, Idaho, Utah, Louisiana, Pennsylvania, South Carolina y Massachusetts.

Washington State DOT está implementado, pero no devolvió registros válidos en la última ejecución. Se revisará su formato antes de contabilizarlo.

Después se priorizarán Washington, Colorado, Texas, Virginia, Maryland, Minnesota, Wisconsin, Iowa, Montana, Wyoming, Alaska, North Carolina, Ohio, Nevada y New Mexico.

## Canadá

Operativas:

- Columbia Británica: 1.034.
- Ontario 511: 934.
- Alberta 511: 367.
- Toronto Open Data: 336.

Siguientes redes:

- Québec 511.
- Saskatchewan Highway Hotline.
- Manitoba 511.
- New Brunswick 511.
- Nova Scotia 511.
- Newfoundland and Labrador 511.
- Vancouver, Ottawa, Montréal, Calgary y Edmonton cuando los términos permitan integrar imágenes.

## Corea del Sur

El adaptador oficial está preparado para:

```text
https://openapi.its.go.kr/api/NCCTVInfo
```

Requiere el secreto gratuito `ITS_KR_KEY`. Consultará autopistas (`ex`) y carreteras nacionales (`its`) y almacenará sus streams HLS.

## Japón

Las listas manuales localizadas hasta ahora dependen de vídeos de YouTube no verificados y no se incorporan.

Plan:

1. identificar feeds oficiales por oficina regional del MLIT;
2. revisar prefecturas y NEXCO;
3. normalizar japonés y romanización;
4. verificar hotlink, licencias y frecuencia;
5. incorporar volcanes, puertos y meteorología con atribución clara.

## Sudeste asiático y Pacífico

| Territorio | Estado | Fuente prioritaria |
|---|---|---|
| Singapur | Operativa | LTA Traffic Images. |
| Nueva Zelanda | Parcial | GeoNet; falta NZTA. |
| Tailandia | Investigación | Department of Highways y Bangkok. |
| Malasia | Investigación | LLM y autoridades urbanas. |
| Indonesia | Fragmentada | BMKG, volcanes, puertos y ciudades. |
| Filipinas | Fragmentada | MMDA y autoridades regionales. |
| Taiwán | Investigación | Freeway Bureau. |
| Hong Kong | Investigación | Transport Department Open Data. |
| Australia | Fragmentada | Redes estatales. |

## Criterios de calidad

Una cámara publicable requiere:

1. coordenadas reales;
2. proveedor y origen identificables;
3. tipo de medio correcto;
4. estado diferenciado;
5. atribución y términos;
6. ausencia de secretos en el cliente;
7. fallo aislado por proveedor;
8. exclusión de grabaciones antiguas presentadas como directo;
9. no inventar ubicaciones;
10. no copiar catálogos comerciales.

## Orden de trabajo

1. Resolver acceso autorizado a SCT/CIVICAT y el feed vigente de Barcelona.
2. Portugal, País Vasco y Navarra.
3. Activar Suecia, Corea y redes 511 mediante secretos gratuitos.
4. Reino Unido completo, Francia, Austria, Suiza e Italia.
5. Noruega, Dinamarca, Bélgica y Bálticos.
6. Europa central, oriental y balcánica.
7. Canadá restante y más estados de EE. UU.
8. Japón, Taiwán, Hong Kong y Sudeste Asiático.
