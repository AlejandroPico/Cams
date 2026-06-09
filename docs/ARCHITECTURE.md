# Arquitectura de Cams

## Enfoque

Cams está diseñado como una aplicación estática pura: HTML, CSS y JavaScript moderno mediante módulos ES. No requiere framework, servidor, empaquetador ni API propia.

La estructura está pensada para GitHub Pages, con rutas relativas y un único punto de entrada: `index.html`.

## Capas

### 1. Entrada HTML

`index.html` define la estructura semántica:

- Cabecera.
- Hero con estadísticas.
- Panel de filtros.
- Mosaico de cámaras.
- Panel de rotación.
- Diálogo de detalle.

No contiene lógica de negocio ni datos incrustados.

### 2. Estilos

`assets/css/styles.css` concentra la estética:

- Tema oscuro minimalista.
- Cards tipo mosaico.
- Paneles sticky en escritorio.
- Diseño responsive.
- Animación de progreso del rotador.

### 3. Datos

`assets/js/data/cameras.js` exporta:

- `CATALOG_META`: metadatos de versión.
- `CAMERAS`: catálogo inicial de 100 referencias.

Esta separación permite ampliar la base de datos sin tocar el resto de la aplicación.

### 4. Módulos JavaScript

- `app.js`: arranque de la aplicación.
- `modules/state.js`: estado compartido y control de rotación.
- `modules/filtering.js`: filtros, ordenación y estadísticas.
- `modules/player.js`: construcción del visor y utilidades de representación.
- `modules/ui.js`: renderizado, eventos, diálogo y rotador.

## Decisión importante: enlaces oficiales frente a iframes

En la web real, muchos proveedores de webcams impiden que sus páginas se muestren dentro de iframes. Forzar la incrustación genera resultados frágiles: pantallas en blanco, errores de navegador o páginas rotas.

Por eso la versión 1 funciona como catálogo robusto:

1. Cada cámara tiene `sourceUrl`.
2. Si una fuente se verifica como embebible, se añade `embedUrl`.
3. El usuario puede probar visor interno experimental.
4. El enlace oficial se mantiene siempre como salida fiable.

## Rendimiento

El catálogo actual es ligero. Para varios cientos o miles de cámaras se recomienda:

- Paginación o virtualización de la cuadrícula.
- Carga diferida de detalles.
- Separación del catálogo por regiones.
- Índice de búsqueda precalculado.
- Miniaturas servidas desde una carpeta propia solo si sus licencias lo permiten.

## GitHub Pages

El proyecto no necesita build. La carpeta raíz puede publicarse directamente desde `main`.
