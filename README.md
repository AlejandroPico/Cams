# Cams

**Cams** es un visor mundial de webcams públicas, directos y snapshots. La reconstrucción actual sustituye el prototipo HTML por una aplicación React + TypeScript orientada a funcionar sin servicios de pago.

## Principios

- Coste operativo: **0 €**.
- Pantalla inicial: **mapa mundial**.
- Globo satelital con teselas progresivas y zoom hasta el nivel máximo disponible por la imagen base.
- Mosaico sin separaciones visuales entre cámaras.
- Directos, snapshots, imágenes refrescadas, HLS, MJPEG e iframes.
- Catálogo ampliable mediante archivos locales y fuentes públicas autorizadas.
- Sin extracción masiva de directorios comerciales ni copia de contenidos contra sus condiciones.

## Qué cambia en esta versión

- React 18, TypeScript y Vite.
- MapLibre GL JS con proyección de globo.
- Base satelital por teselas de Esri World Imagery, con atribución visible.
- Capa de día/noche calculada localmente y atenuada al acercarse para conservar definición.
- Iconos de cámara derivados del símbolo aportado al proyecto:
  - amarillo: día;
  - naranja: amanecer o atardecer;
  - azul: noche.
- Clustering nativo de MapLibre; los iconos ya no son elementos retardados que persiguen a la esfera.
- Etiquetas de localidades sin carreteras ni fronteras destacadas.
- Mapa como vista inicial y mosaico como segunda vista principal.
- Filtros por país, categoría, tipo de medio y estado.
- Ventana flotante para reproducir la cámara seleccionada.
- Mosaicos de 1, 2, 4, 6, 9, 12, 16, 20, 25 o 30 cámaras.
- Rotación automática y navegación por lotes.
- Pipeline Python extensible para consolidar fuentes gratuitas.
- GitHub Actions para desplegar y actualizar el catálogo sin servidor permanente.

## Desarrollo local

```bash
npm install
npm run catalog:refresh
npm run dev
```

Producción:

```bash
npm run build
npm run preview
```

## Publicación gratuita

El workflow `.github/workflows/deploy.yml` compila la aplicación y la publica con GitHub Pages. Debe configurarse Pages con **Source: GitHub Actions**.

El workflow `.github/workflows/refresh-catalog.yml` reconstruye el catálogo cada seis horas y solo crea un commit cuando cambian los datos.

## Catálogo

El catálogo resultante se publica en:

```text
public/data/cameras.json
public/data/catalog-meta.json
```

Fuentes de entrada actuales:

1. El catálogo heredado del prototipo.
2. `data/manual/cameras.csv`.
3. Fuentes JSON o GeoJSON declaradas y activadas en `data/sources.json`.

Cada fuente debe indicar atribución y licencia. El agregador deduplica por identificador y URL de medio.

## Añadir una fuente gratuita

Edite `data/sources.json`:

```json
{
  "name": "Red pública de webcams",
  "enabled": true,
  "url": "https://dominio-publico.example/cameras.geojson",
  "type": "snapshot",
  "refreshSeconds": 300,
  "attribution": "Organismo propietario",
  "license": "Licencia o condiciones de reutilización"
}
```

Para formatos distintos se añadirá un adaptador específico dentro de `scripts/ingest/providers/`.

## Límites reales

“Sin límite de catálogo” no significa dibujar medio millón de reproductores a la vez. El navegador muestra clústeres y solo carga medios cuando son visibles o seleccionados. La evolución prevista para catálogos muy grandes es generar teselas vectoriales o PMTiles desde GitHub Actions, manteniendo el alojamiento estático.

La imagen satelital no se almacena en el repositorio. Se solicita al proveedor de teselas y su resolución final depende de la cobertura pública disponible. No se utilizan Google Maps ni servicios que requieran facturación.

## Estructura

```text
src/
├── components/
│   ├── CameraPanel.tsx
│   ├── MediaPlayer.tsx
│   ├── Mosaic.tsx
│   ├── Sidebar.tsx
│   └── WorldMap.tsx
├── data/loadCatalog.ts
├── lib/
│   ├── catalog.ts
│   └── time.ts
├── map/
│   ├── cameraIcon.ts
│   ├── dayNight.ts
│   └── mapStyle.ts
├── App.tsx
├── main.tsx
├── styles.css
└── types.ts

scripts/ingest/aggregate.py
data/manual/cameras.csv
data/sources.json
```

## Política de cámaras

Cams solo debe integrar cámaras:

- públicas y accesibles sin eludir controles;
- con permiso de inserción o reutilización;
- con atribución visible cuando sea obligatoria;
- sin autenticación robada, scraping evasivo ni acceso a sistemas privados;
- sin funciones de reconocimiento facial, seguimiento de personas o identificación.

Véase `docs/CAMERA_SOURCE_POLICY.md`.
