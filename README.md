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
- La vista **Mapa** muestra una **esfera terrestre 3D** con textura satelital estable, atmósfera, zoom ampliado, rotación, fronteras de países y marcadores de cámaras.
- Los marcadores del globo son iconos de cámara con la silueta aportada por el usuario, no tubos 3D.
- El borde del icono cambia por situación solar: amarillo en día, naranja en amanecer/anochecer y azul en noche.
- La línea visual del terminador día/noche queda eliminada para no ensuciar el globo.
- El doble clic sobre cámara o esfera ya no abre mapas ni cambia de modo.
- La ventana flotante de cámara muestra hora local con huso horario IANA cuando el país se reconoce; España usa `Europe/Madrid` y aplica horario de verano.
- El globo permite acercarse mucho más a la superficie mediante zoom óptico de la esfera.
- Para detalle de alta resolución se mantiene el botón **zoom satélite** dentro de la ventana flotante.
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

Muestra un globo 3D interactivo. La esfera usa textura satelital, relieve sutil, atmósfera, fondo espacial, fronteras nacionales y puntos de cámaras. El usuario puede rotar la Tierra y hacer zoom cerca de la superficie.

Los puntos de cámara se representan con iconos de cámara pequeños, basados en la silueta aportada por el usuario, con borde de alto contraste. El color del borde depende de la situación solar aproximada del punto: amarillo para día, naranja para amanecer/anochecer y azul para noche. No se dibuja ninguna línea de terminador ni capa de oscuridad sobre el globo.

Al pulsar un icono se abre una ventana flotante con el directo de esa cámara dentro del mismo escenario del globo, incluyendo hora local. El cálculo horario usa zona horaria IANA cuando el país se reconoce; si no, cae a una estimación por longitud. Desde esa ventana se puede abrir un **zoom satelital** con teselas de mayor detalle.

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

La hora local intenta resolverse con husos horarios IANA para países reconocidos. España se resuelve como `Europe/Madrid` salvo islas Canarias, donde se usa `Atlantic/Canary`. En países muy grandes se aplica una heurística por longitud. Si no se puede determinar el huso, se usa una aproximación por longitud.

## Nota sobre YouTube y embeds

Muchas cámaras de YouTube pueden cambiar, dejar de emitir o bloquear inserción según el propietario del directo. Esta versión usa `youtube-nocookie.com/embed/ID` para la reproducción y evita miniaturas como vista principal.

## Próximos pasos

- Curar manualmente las cámaras que no sigan emitiendo.
- Sustituir todas las heurísticas horarias por una base real de husos horarios por coordenadas.
- Añadir más cámaras paisajísticas con prioridad a costas, montañas, volcanes, skylines y espacios naturales.
- Separar el catálogo por regiones si supera varios cientos de entradas.
- Añadir favoritos locales.
- Añadir control de densidad del mosaico inicial.
- Crear una validación automática del catálogo.
