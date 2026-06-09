# Arquitectura de Cams

## Principio de interfaz

La aplicación se organiza como una experiencia fullscreen. La pantalla principal se reserva para cámaras o lugares. Toda navegación, filtro, información técnica y configuración se canaliza desde el panel lateral tipo hamburguesa.

## Vistas

- `wallView`: vista inicial. Muestra todos los lugares del catálogo.
- `liveView`: mosaico de cámaras en directo.
- `mapView`: mapa mundial con marcadores.
- `catalogView`: listado técnico de cámaras.
- `configView`: importación, exportación y alta rápida de cámaras.

## Módulos

- `app.js`: arranque.
- `data/cameras.js`: catálogo base.
- `modules/state.js`: estado, persistencia y temporizador.
- `modules/filtering.js`: normalización, filtros y forma de mosaico.
- `modules/player.js`: miniaturas, iframes, URLs públicas y utilidades HTML.
- `modules/map.js`: mapa D3/TopoJSON y fallback SVG.
- `modules/ui.js`: eventos, renderizado, panel hamburguesa y catálogo.

## Persistencia

Se usa `localStorage` con dos claves:

- `cams_v2_catalog`
- `cams_v2_settings`

Esto permite probar cambios sin servidor ni base de datos.

## GitHub Pages

No hay build ni dependencias instalables. GitHub Pages sirve los ficheros estáticos desde la raíz.
