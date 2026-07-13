# Cobertura territorial y hoja de ruta

Este documento distingue entre cuatro situaciones:

- **Operativa:** cámaras importadas y publicadas en SQLite.
- **Preparada:** adaptador terminado; falta una clave gratuita.
- **Investigación:** existe un portal público, pero todavía no se ha confirmado un feed estable y reutilizable.
- **Fragmentada:** no se ha localizado una red nacional única; habrá que integrar operadores regionales o municipales.

Los recuentos exactos y actuales están en `public/data/catalog-meta.json`. No se utilizan estimaciones como si fueran cámaras importadas.

## Cobertura operativa confirmada

La ejecución del 13 de julio de 2026 confirmó 11.372 cámaras activas antes de la última prueba específica del SCT:

| Territorio | Fuente operativa | Registros confirmados |
|---|---|---:|
| España estatal | DGT DATEX II | 1.932 |
| Madrid | Ayuntamiento de Madrid | 357 |
| Madrid Calle 30 | Madrid Calle 30 | 37 |
| Barcelona | Red municipal histórica | 27 |
| Reino Unido, Londres | Transport for London | 882 |
| Finlandia | Fintraffic | 2.272 |
| Estados Unidos, California | Caltrans | 883 |
| Estados Unidos, Nueva York | 511 New York | 1.868 |
| Estados Unidos, Oregón | TripCheck | 1.127 |
| Canadá, Columbia Británica | DriveBC | 1.034 |
| Canadá, Ontario | Ontario 511 | 934 |
| Singapur | LTA | 8 |
| Nueva Zelanda | GeoNet | 11 |

Los 144 vídeos históricos de YouTube ya no forman parte del catálogo activo. Permanecen archivados hasta que cada emisión sea verificada manualmente.

## Península ibérica

| Territorio | Estado | Trabajo previsto |
|---|---|---|
| España, red DGT | Operativa | Salud automática de snapshots y deduplicación con redes regionales. |
| Cataluña | Adaptador en prueba | WFS de SCT/CIVICAT con compatibilidad TLS aislada; comprobar capas e imágenes reales. |
| Barcelona ciudad | Parcial | Sustituir las 27 páginas antiguas por el feed municipal vigente cuando se identifique. |
| País Vasco | Investigación | Localizar el inventario público de Euskalmet/Tráfico y verificar términos de inserción. |
| Navarra | Investigación | Revisar el portal regional y cámaras de carreteras. |
| Portugal | Investigación | Revisar Infraestruturas de Portugal, ANSR y operadores de autopistas; no se publicará un catálogo comercial copiado. |
| Andorra | Fragmentada | Cámaras de movilidad, estaciones de esquí y meteorología por proveedor. |

## Europa occidental y central

| País | Estado | Fuente o estrategia prioritaria |
|---|---|---|
| Reino Unido | Parcial | TfL operativo; faltan National Highways, Traffic Wales, Traffic Scotland e Irlanda del Norte. |
| Irlanda | Investigación | Transport Infrastructure Ireland y autoridades urbanas. |
| Francia | Investigación | Bison Futé, DIR regionales y concesionarias; la red está fragmentada. |
| Alemania | Adaptador activo sin resultados | Autobahn API oficial; actualmente devuelve colecciones de webcam vacías. Revisar BayernInfo y portales regionales. |
| Austria | Investigación | ASFINAG y Tirol; verificar API, atribución e inserción de imágenes. |
| Suiza | Investigación | ASTRA y redes cantonales; verificar catálogo abierto vigente. |
| Italia | Investigación | ANAS, Autostrade per l'Italia y redes regionales. |
| Países Bajos | Investigación | Nationaal Dataportaal Wegverkeer y autoridades urbanas. |
| Bélgica | Fragmentada | Verkeerscentrum Vlaanderen, Wallonie Mobilité y Bruselas. |
| Luxemburgo | Investigación | CITA y portal nacional de movilidad. |
| Liechtenstein | Fragmentada | Fuentes meteorológicas y viarias compartidas con Suiza/Austria. |

## Países nórdicos y bálticos

| País | Estado | Fuente o estrategia prioritaria |
|---|---|---|
| Finlandia | Operativa | Fintraffic, 2.272 encuadres confirmados. |
| Suecia | Preparada | Trafikverket; requiere el secreto gratuito `TRAFIKVERKET_KEY`. |
| Noruega | Investigación | Statens vegvesen y cámaras meteorológicas de carretera. |
| Dinamarca | Investigación | Vejdirektoratet / Trafikinfo. |
| Islandia | Investigación | Vegagerðin y estaciones meteorológicas. |
| Estonia | Investigación | Transpordiamet y Tark Tee. |
| Letonia | Investigación | Latvijas Valsts ceļi. |
| Lituania | Investigación | eismoinfo.lt y autoridad de carreteras. |

## Europa central, oriental y balcánica

| País | Estado | Prioridad |
|---|---|---|
| Polonia | Investigación | GDDKiA y redes urbanas. |
| Chequia | Investigación | ŘSD y dopravniinfo.cz. |
| Eslovaquia | Investigación | Slovenská správa ciest y portales de montaña. |
| Hungría | Investigación | Útinform y Magyar Közút. |
| Eslovenia | Investigación | Promet.si / DARS. |
| Croacia | Investigación | HAK y Hrvatske autoceste. |
| Rumanía | Investigación | CNAIR y portales regionales. |
| Bulgaria | Investigación | Road Infrastructure Agency. |
| Serbia | Investigación | Putevi Srbije. |
| Bosnia y Herzegovina | Fragmentada | Operadores de autopistas y autoridades de entidades. |
| Montenegro | Investigación | Monteput y autoridad viaria. |
| Macedonia del Norte | Investigación | Autoridad de carreteras y pasos fronterizos. |
| Albania | Investigación | Autoridad de carreteras y municipios. |
| Grecia | Fragmentada | Concesionarias de autopistas, Attiki Odos y portales regionales. |
| Moldavia | Investigación | Administración estatal de carreteras. |
| Ucrania | Investigación sensible | Solo fuentes civiles públicas y estables; evitar ubicaciones que impliquen riesgos operativos. |
| Bielorrusia | No prioritaria | Revisar disponibilidad, legalidad y seguridad antes de incorporar. |
| Rusia | No prioritaria | No integrar catálogos dudosos ni cámaras con implicaciones de seguridad. |

## Turquía y Mediterráneo oriental

| Territorio | Estado | Estrategia |
|---|---|---|
| Turquía | Fragmentada | KGM, municipios metropolitanos y estaciones meteorológicas. |
| Chipre | Investigación | Autoridad de carreteras y tráfico urbano. |
| Malta | Investigación | Transport Malta y cámaras portuarias/meteorológicas. |

## Estados Unidos

Cobertura sin credenciales actualmente operativa:

- California: Caltrans.
- Nueva York: 511NY.
- Oregón: TripCheck.

Redes preparadas con claves gratuitas:

- Georgia, Florida, Arizona, Idaho, Utah, Louisiana, Pennsylvania, South Carolina y Massachusetts.

Después se priorizarán los estados que publiquen feeds oficiales sin coste: Washington, Colorado, Texas, Virginia, Maryland, Minnesota, Wisconsin, Iowa, Montana, Wyoming, Alaska, North Carolina, Ohio, Nevada, New Mexico y otros.

No se copiarán catálogos comerciales de agregadores. Cada cámara debe conservar proveedor oficial, atribución y URL de origen.

## Canadá

Operativas:

- Columbia Británica: DriveBC.
- Ontario: Ontario 511.

Siguientes redes:

- Québec 511.
- Alberta 511.
- Saskatchewan Highway Hotline.
- Manitoba 511.
- New Brunswick 511.
- Nova Scotia 511.
- Newfoundland and Labrador 511.
- cámaras municipales de Vancouver, Toronto, Ottawa, Montréal, Calgary y Edmonton cuando sus términos permitan integración.

## Japón

La cobertura japonesa está muy fragmentada entre oficinas regionales del MLIT, prefecturas, operadores de autopistas y portales de nieve o volcanes. No se ha confirmado todavía un inventario nacional único con coordenadas e imágenes reutilizables.

Plan:

1. identificar feeds oficiales por oficina regional del MLIT;
2. normalizar nombres japoneses y romanización;
3. verificar si las imágenes admiten hotlink o requieren proxy autorizado;
4. integrar NEXCO únicamente cuando sus términos lo permitan;
5. añadir cámaras meteorológicas, volcánicas y portuarias con licencia clara.

## Corea del Sur

Los portales nacionales ITS y `data.go.kr` ofrecen APIs de tráfico, pero varias exigen clave de servicio y condiciones específicas. Antes de activarlas se verificará:

- que el endpoint entregue coordenadas y una imagen o stream público;
- que la clave gratuita permita uso automatizado en GitHub Actions;
- que la redistribución del URL sea compatible con sus términos;
- que no se expongan secretos en el frontend.

El futuro secreto se añadirá únicamente cuando el adaptador y el contrato del API estén confirmados.

## Sudeste asiático y Pacífico

| Territorio | Estado | Fuente prioritaria |
|---|---|---|
| Singapur | Operativa | LTA Traffic Images. |
| Nueva Zelanda | Parcial | GeoNet; falta NZTA para carreteras. |
| Tailandia | Investigación | Department of Highways y Bangkok traffic. |
| Malasia | Investigación | LLM y autoridades urbanas. |
| Indonesia | Fragmentada | BMKG, volcanes, puertos y ciudades. |
| Filipinas | Fragmentada | MMDA y autoridades regionales. |
| Taiwán | Investigación | Freeway Bureau y transport data platform. |
| Hong Kong | Investigación | Transport Department open data. |
| Australia | Fragmentada | Transport for NSW, VicRoads, Queensland, WA y otras redes estatales. |

## Principios de calidad

Una gran cifra no es suficiente. Para considerar una cámara publicable se exige:

1. coordenadas válidas;
2. proveedor identificable;
3. URL de origen;
4. estado diferenciado entre `online`, `unknown`, `offline` y `blocked`;
5. tipo de medio correcto;
6. licencia o términos registrados;
7. ausencia de credenciales en el cliente;
8. exclusión de grabaciones antiguas presentadas como directo;
9. conservación de la atribución;
10. fallo aislado por proveedor.

## Orden de trabajo recomendado

1. Completar Cataluña con SCT/CIVICAT y sustituir las páginas antiguas de Barcelona.
2. Añadir Portugal y el resto de redes españolas autonómicas.
3. Activar Suecia y los estados 511 estadounidenses mediante secretos gratuitos.
4. Reino Unido completo, Irlanda, Francia, Austria, Suiza e Italia.
5. Noruega, Dinamarca, Islandia, Países Bajos y Bélgica.
6. Europa central, oriental y balcánica.
7. Canadá restante.
8. Japón y Corea mediante integraciones regionales verificadas.
9. Sudeste asiático y Australia.
