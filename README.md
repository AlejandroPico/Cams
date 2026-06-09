# Cams

Mosaico minimalista de webcams públicas del mundo, preparado para publicarse directamente con **GitHub Pages**.

La versión actual recupera el enfoque de `worldcam_lite_v0_4.html`: pantalla completa, cámaras visibles desde el primer segundo y un único panel lateral tipo hamburguesa para navegación, filtros, mapa, catálogo técnico y configuración.

## Estado actual

- La página abre directamente en **Mosaico**, con cámaras en reproducción.
- La pantalla principal ya no intenta mostrar todo el catálogo a la vez.
- El máximo visible simultáneo es **30 cámaras**, distribuido como **6 columnas × 5 filas**.
- El selector del panel hamburguesa permite elegir 1, 2, 4, 6, 9, 12, 16, 20, 25 o 30 cámaras, sin texto de multiplicaciones.
- Los botones anterior, siguiente y azar paginan por lotes del tamaño elegido.
- Se eliminan las miniaturas como vista principal: cada celda visible carga un reproductor real.
- El mosaico queda con bordes rectos, sin redondeos y sin separación entre cámaras.
- El control **Etiquetas** muestra u oculta los rótulos visuales superpuestos en cámaras y mosaicos.
- El panel hamburguesa corrige la legibilidad de desplegables en modo nocturno.
- No hay landing, hero ni tarjetas informativas externas ocupando la pantalla inicial.
- El botón hamburguesa es la vía principal para acceder a opciones, filtros, mapa, directo, catálogo y configuración.
- El catálogo base contiene **144 cámaras** procedentes de la versión WorldCam Minimal v0.4.
- La vista **Directo** usa la misma cantidad seleccionada en el mosaico principal.
- La vista **Mapa** muestra una **esfera terrestre 3D** con textura satelital, atmósfera, zoom ampliado, rotación, fronteras de países y marcadores de cámaras.
- Los marcadores del globo son iconos de cámara HTML/SVG, no tubos 3D.
- El borde del icono cambia por situación solar: amarillo en día, naranja en crepúsculo y rojo en noche.
- La ventana flotante de cámara muestra la hora local aproximada calculada desde la longitud de sus coordenadas.
- El globo permite acercarse mucho más a la superficie mediante zoom óptico de la esfera.
- Para detalle de alta resolución se añade un **zoom satelital profundo** con teselas, dentro del propio escenario del mapa.
- El mapa incorpora una guía día/noche mediante línea de terminador solar, sin oscurecer la textura satelital del globo.
- Al pulsar una cámara en el globo se abre una ventana flotante dentro del propio mapa, sin cambiar a la vista 1×1.
- La vista **Catálogo** permite ver, ocultar, comprobar o retirar cámaras del catálogo local.
- La vista **Config** permite añadir cámaras, importar JSON, exportar el catálogo y restaurar la base.

## Estructura del proyecto

```text
.
├── index.html
├── README.md
├── .nojekyll
├── .gitignore
├── assets/
│   ├── css/
│   │   ├── globe.css
│   │   ├── map-markers.css
│   │   ├── panel.css
│   │   └── styles.css
│   ├── img/
│   │   └── favicon.svg
│   └── js/
│       ├── app.js
│       ├── data/
│       │   └── cameras.js
│       └── modules/
│           ├── filtering.js
│           ├── map.js
│           ├── player.js
│           ├── state.js
│           └── ui.js
└── docs/
    ├── ARCHITECTURE.md
    └── CAMERA_DATA_MODEL.md
```

## Publicación en GitHub Pages

1. Entra en **Settings → Pages**.
2. En **Build and deployment**, selecciona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
3. Guarda la configuración.
4. GitHub Pages servirá directamente `index.html`.

## Funcionamiento

### Mosaico

Es la vista inicial. Muestra un lote de cámaras en reproducción directa. Por defecto carga 30 cámaras como máximo en una cuadrícula 6×5. El resto del catálogo no desaparece: se recorre con los botones anterior, siguiente o azar desde el panel hamburguesa.

### Directo

Muestra el mismo lote de cámaras en un mosaico controlado de iframes, imágenes, MJPEG o HLS según el tipo de cámara. Sirve para usar el modo fullscreen o rotación con el tamaño de lote seleccionado.

### Mapa

Muestra un globo 3D interactivo. La esfera usa textura satelital tipo Blue Marble, relieve sutil, atmósfera, fondo espacial, fronteras nacionales y puntos de cámaras. El usuario puede rotar la Tierra y hacer zoom mucho más cerca de la superficie.

Los puntos de cámara se representan con iconos SVG de cámara con halo de alto contraste. El color del halo depende de la situación solar aproximada del punto: día, crepúsculo o noche. Al pulsar un icono se abre una ventana flotante con el directo de esa cámara dentro del mismo escenario del globo, incluyendo hora local aproximada por longitud.

Desde esa ventana se puede abrir un **zoom satelital profundo** con teselas de mayor detalle. También se puede pulsar una zona del globo para abrir directamente ese visor de detalle sobre las coordenadas seleccionadas.

La transición día/noche se representa con una línea de terminador solar calculada en tiempo real. No se aplica una capa de oscuridad encima del planeta para no degradar la textura satelital.

### Panel hamburguesa

Todo lo que no sea la cámara/listado principal vive dentro del panel lateral:

- navegación entre vistas;
- filtros;
- tamaño del mosaico;
- paginación del mosaico;
- rotación;
- etiquetas;
- modo visual;
- pantalla completa;
- búsqueda técnica;
- comprobación de cámaras visibles.

## Nota sobre rendimiento

La vista inicial no dispara todo el catálogo a la vez. Renderiza exclusivamente el lote visible, con un máximo de 30 reproductores simultáneos.

En el globo 3D se evita recrear la escena si ya existe, se ajusta el tamaño sin recargar texturas, se limita el pixel ratio del render y se reducen resoluciones de puntos/fronteras para mejorar la fluidez.

## Dependencias externas de visualización

- D3 y TopoJSON para leer la geometría de países.
- Globe.gl para la esfera 3D.
- Leaflet para el visor de zoom satelital profundo.
- Texturas públicas de `three-globe` para la visualización satelital y el fondo espacial.
- Teselas satelitales externas para el detalle de aproximación.

## Nota sobre horas locales

La hora local mostrada en el globo se calcula de forma aproximada a partir de la longitud geográfica. No aplica todavía una base completa de husos horarios, fronteras administrativas ni cambios de horario de verano.

## Nota sobre YouTube y embeds

Muchas cámaras de YouTube pueden cambiar, dejar de emitir o bloquear inserción según el propietario del directo. Esta versión usa `youtube-nocookie.com/embed/ID` para la reproducción y evita miniaturas como vista principal.

## Próximos pasos

- Curar manualmente las cámaras que no sigan emitiendo.
- Sustituir la hora local aproximada por una base real de husos horarios.
- Añadir más cámaras paisajísticas con prioridad a costas, montañas, volcanes, skylines y espacios naturales.
- Separar el catálogo por regiones si supera varios cientos de entradas.
- Añadir favoritos locales.
- Añadir control de densidad del mosaico inicial.
- Crear una validación automática del catálogo.
