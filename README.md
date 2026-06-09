# Cams

Mosaico minimalista de cámaras web públicas del mundo, preparado para publicarse directamente con **GitHub Pages**.

Esta primera versión convierte el proyecto en una aplicación estática modular, separando HTML, CSS, JavaScript, datos y documentación. La base inicial contiene **100 referencias de webcams** organizadas por continente, categoría, proveedor, prioridad paisajística y ubicación.

## Objetivo

Crear un atlas visual de cámaras en directo con estética limpia, navegación rápida y una base de datos fácil de ampliar. La prioridad del catálogo son vistas paisajísticas: costas, montañas, volcanes, skylines, monumentos, naturaleza, puertos y lugares icónicos.

## Características de la versión 1

- Mosaico responsive de cámaras.
- Panel lateral de filtros por búsqueda, continente, categoría y proveedor.
- Priorización automática de cámaras paisajísticas.
- Panel de rotación secuencial con controles de anterior/siguiente, pausa y selección de intervalo.
- Ficha de detalle por cámara.
- Enlace de salida para localizar la fuente pública de cada cámara.
- Visor interno experimental para probar incrustaciones cuando el proveedor lo permita.
- Datos separados en `assets/js/data/cameras.js`.
- Sin backend, sin dependencias externas y sin proceso de build.

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

## Cómo añadir cámaras

Edita `assets/js/data/cameras.js`. En esta primera versión el catálogo usa una semilla compacta en texto. Cada línea sigue este formato:

```text
título|ciudad|país|continente|categoría|proveedor|tag1,tag2,tag3|puntuaciónPaisaje
```

Ejemplo:

```text
Barcelona playa|Barcelona|España|Europa|Costa|Proveedor oficial|playa,costa,paisaje|95
```

### Sobre `embedUrl`

Muchas webs de cámaras bloquean su inserción en iframes mediante cabeceras de seguridad o políticas internas. Por eso el proyecto conserva dos niveles:

- `sourceUrl`: enlace de acceso o búsqueda pública.
- `embedUrl`: solo debe rellenarse cuando se haya comprobado que la cámara permite incrustación estable.

## Próximos pasos recomendados

- Verificar una por una las cámaras más importantes y sustituir las búsquedas por URLs oficiales exactas.
- Convertir las cámaras más fiables en embeds reales, comprobando que cargan en iframe.
- Añadir miniaturas propias o capturas estáticas permitidas por cada proveedor.
- Incorporar un mapa mundial con marcadores.
- Añadir favoritos locales con `localStorage`.
- Crear un script de validación para detectar duplicados, campos vacíos y enlaces rotos.
- Separar el catálogo por regiones si la base de datos supera varios cientos de cámaras.

## Estado de la versión

Versión inicial refactorizada: **v1.0.0**  
Fecha: **9 de junio de 2026**
