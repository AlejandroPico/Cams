# Cams

Mosaico minimalista de webcams públicas del mundo, preparado para publicarse directamente con **GitHub Pages**.

La versión actual recupera el enfoque de `worldcam_lite_v0_4.html`: pantalla completa, cámaras visibles desde el primer segundo y un único panel lateral tipo hamburguesa para navegación, filtros, mapa, catálogo técnico y configuración.

## Estado actual

- La página abre directamente en **Lugares**, con el mosaico principal de cámaras en reproducción.
- Se eliminan las miniaturas como vista principal: cada celda carga un reproductor real.
- Las cámaras visibles se cargan automáticamente y las siguientes se activan al entrar en pantalla durante el scroll.
- El mosaico queda con bordes rectos, sin redondeos y sin separación entre cámaras.
- No hay landing, hero ni tarjetas informativas externas ocupando la pantalla inicial.
- El botón hamburguesa es la vía principal para acceder a opciones, filtros, mapa, directo, catálogo y configuración.
- El catálogo base contiene **144 cámaras** procedentes de la versión WorldCam Minimal v0.4.
- La vista **Directo** mantiene el mosaico por lotes de 1, 2, 4, 6, 9, 16 o 25 cámaras.
- La vista **Mapa** reutiliza D3 + TopoJSON para colocar puntos geográficos.
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

### Lugares

Es la vista inicial. Muestra el catálogo como mosaico compacto de cámaras en reproducción. No requiere pulsar una cámara para empezar a verla.

### Directo

Muestra un mosaico controlado de iframes, imágenes, MJPEG o HLS según el tipo de cámara. Sirve para ver pocas cámaras de forma más grande.

### Panel hamburguesa

Todo lo que no sea la cámara/listado principal vive dentro del panel lateral:

- navegación entre vistas;
- filtros;
- tamaño del mosaico en directo;
- rotación;
- modo visual;
- pantalla completa;
- búsqueda técnica;
- comprobación de cámaras.

## Nota sobre rendimiento

La vista inicial no dispara todos los reproductores del catálogo a la vez. Carga automáticamente los visibles y prepara los siguientes al aproximarse al viewport. Esto mantiene la idea de reproducción directa sin forzar decenas o cientos de iframes simultáneos desde el primer instante.

## Nota sobre YouTube y embeds

Muchas cámaras de YouTube pueden cambiar, dejar de emitir o bloquear inserción según el propietario del directo. Esta versión usa `youtube-nocookie.com/embed/ID` para la reproducción y evita miniaturas como vista principal.

## Próximos pasos

- Curar manualmente las cámaras que no sigan emitiendo.
- Añadir más cámaras paisajísticas con prioridad a costas, montañas, volcanes, skylines y espacios naturales.
- Separar el catálogo por regiones si supera varios cientos de entradas.
- Añadir favoritos locales.
- Añadir control de densidad del mosaico inicial.
- Crear una validación automática del catálogo.
