# Arquitectura de Cams

## Principio de interfaz

La aplicación se organiza como una experiencia fullscreen. La pantalla principal se reserva para cámaras o lugares. Toda navegación, filtro, información técnica y configuración se canaliza desde el panel lateral tipo hamburguesa.

## Vistas

- `wallView`: vista inicial. Muestra un lote de cámaras en reproducción directa.
- `liveView`: mosaico de cámaras en directo.
- `mapView`: globo 3D satelital con marcadores de cámaras.
- `catalogView`: listado técnico de cámaras.
- `configView`: importación, exportación y alta rápida de cámaras.

## Módulos

- `app.js`: arranque.
- `data/cameras.js`: catálogo base.
- `modules/state.js`: estado, persistencia y temporizador.
- `modules/filtering.js`: normalización, filtros y forma de mosaico.
- `modules/player.js`: iframes, URLs públicas y utilidades HTML.
- `modules/map.js`: globo 3D con Globe.gl, fronteras vía D3/TopoJSON y fallback SVG.
- `modules/ui.js`: eventos, renderizado, panel hamburguesa y catálogo.

## Visualización 3D

La vista `mapView` usa `Globe.gl` para montar una esfera interactiva. La capa base emplea una textura satelital, relieve suave y fondo espacial. Las fronteras se dibujan como polígonos transparentes con trazo claro para mantener la estética de satélite sin perder referencia política.

Los puntos de cámaras se agrupan por coordenadas aproximadas para evitar superposiciones masivas. Al pulsar un punto se abre la cámara correspondiente en la vista de directo.

## Persistencia

Se usa `localStorage` con dos claves:

- `cams_v2_catalog`
- `cams_v2_settings`

Esto permite probar cambios sin servidor ni base de datos.

## GitHub Pages

No hay build ni dependencias instalables. GitHub Pages sirve los ficheros estáticos desde la raíz.
