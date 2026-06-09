# Cams

Mosaico minimalista de webcams públicas del mundo, preparado para publicarse directamente con **GitHub Pages**.

La versión actual recupera el enfoque de `worldcam_lite_v0_4.html`: pantalla completa, cámaras visibles desde el primer segundo y un único panel lateral tipo hamburguesa para navegación, filtros, mapa, catálogo técnico y configuración.

## Estado actual

- La página abre directamente en **Lugares**, con todo el listado de cámaras disponible.
- No hay landing, hero ni tarjetas informativas externas ocupando la pantalla inicial.
- El botón hamburguesa es la vía principal para acceder a opciones, filtros, mapa, directo, catálogo y configuración.
- El catálogo base contiene **144 cámaras** procedentes de la versión WorldCam Minimal v0.4.
- La vista **Directo** muestra el mosaico de cámaras en vivo con selección de 1, 2, 4, 6, 9, 16 o 25 cámaras.
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

Es la vista inicial. Muestra todos los lugares/cámaras del catálogo como mosaico compacto. Al pulsar una cámara, se abre la vista **Directo** con esa cámara a pantalla completa.

### Directo

Muestra un mosaico real de iframes, imágenes, MJPEG o HLS según el tipo de cámara. Para no saturar el navegador, la vista en directo trabaja por lotes configurables.

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

## Nota sobre YouTube y embeds

Muchas cámaras de YouTube pueden cambiar, dejar de emitir o bloquear inserción según el propietario del directo. Esta versión usa `youtube-nocookie.com/embed/ID` para la vista en directo y miniaturas públicas para el listado inicial.

## Próximos pasos

- Curar manualmente las cámaras que no sigan emitiendo.
- Añadir más cámaras paisajísticas con prioridad a costas, montañas, volcanes, skylines y espacios naturales.
- Separar el catálogo por regiones si supera varios cientos de entradas.
- Añadir favoritos locales.
- Añadir previsualización expandida antes de abrir el directo.
- Crear una validación automática del catálogo.
