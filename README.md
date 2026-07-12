# Cams

**Cams** es un visor mundial de webcams públicas, directos y snapshots. La aplicación está construida con React, TypeScript, Vite y MapLibre, y se publica sin servicios de pago mediante GitHub Pages.

## Principios

- Coste operativo: **0 €**.
- Pantalla inicial: **mapa mundial**.
- Globo satelital con teselas progresivas y zoom hasta el nivel máximo disponible por la imagen base.
- Mosaico sin separaciones visuales entre cámaras.
- Directos, snapshots, imágenes refrescadas, HLS, MJPEG e iframes.
- Catálogo ampliable mediante archivos locales y fuentes públicas autorizadas.
- Sin extracción masiva de directorios comerciales ni copia de contenidos contra sus condiciones.

## Estado de la reconstrucción

### Mapa

- MapLibre GL JS como motor geoespacial.
- Proyección de globo activada después de cargar el estilo principal.
- Base satelital por teselas de Esri World Imagery, con atribución visible.
- Mapa OpenStreetMap de respaldo si la fuente satelital no responde.
- Inicialización desacoplada de iconos y etiquetas externas: el terreno puede aparecer aunque falle una capa secundaria.
- Panel de diagnóstico cuando WebGL o el estilo cartográfico no pueden iniciarse.
- Capa de día/noche calculada localmente y atenuada al acercarse.
- Clustering nativo de MapLibre para evitar el retraso de marcadores HTML.
- Etiquetas opcionales de localidades, sin carreteras ni fronteras resaltadas.
- Iconos de cámara con estado lumínico:
  - amarillo: día;
  - naranja: amanecer o atardecer;
  - azul: noche.

### Mosaico

- Parrillas de 1, 2, 4, 6, 9, 12, 16, 20, 25 o 30 cámaras.
- Sin huecos ni marcos decorativos entre reproducciones.
- Navegación anterior, siguiente y aleatoria.
- Rotación automática configurable.
- Filtros por país, categoría, tipo de medio y estado.
- Directos y snapshots proceden del mismo catálogo que alimenta el mapa.
- Las cámaras confirmadas como caídas quedan ocultas por defecto.
- Cada celda indica si está online, sin verificar o fuera de servicio.

## Comprobación de cámaras

El comando `npm run catalog:refresh`:

1. consolida el catálogo histórico, el CSV manual y las fuentes JSON o GeoJSON activadas;
2. deduplica registros;
3. consulta endpoints públicos de YouTube para distinguir directos activos, grabaciones terminadas y fuentes no verificables;
4. escribe el resultado en `public/data/cameras.json`;
5. guarda estadísticas y fecha de comprobación en `public/data/catalog-meta.json`.

La comprobación no utiliza credenciales, no descarga vídeos y no elude controles. Un resultado `unknown` significa que la disponibilidad no pudo determinarse con seguridad; no se presenta como directo verificado.

## Desarrollo local

El proyecto fija **Node.js 24** mediante `.nvmrc`.

```bash
nvm use
npm install
npm run catalog:refresh
npm run dev
```

Producción:

```bash
npm run build
npm run preview
```

Para regenerar el catálogo sin comprobar YouTube:

```bash
npm run catalog:fast
```

## GitHub Actions y publicación

Los workflows utilizan acciones basadas en Node.js 24:

- `actions/checkout@v5`;
- `actions/setup-node@v5` con Node 24;
- `actions/setup-python@v6`;
- `actions/configure-pages@v6`;
- `actions/upload-pages-artifact@v5`;
- `actions/deploy-pages@v5`.

`.github/workflows/deploy.yml` reconstruye el catálogo, compila la aplicación y publica `dist` en GitHub Pages después de cada cambio en `main`.

`.github/workflows/refresh-catalog.yml` comprueba y actualiza el catálogo cada seis horas. Solo crea un commit cuando cambian los archivos publicados.

En **Settings → Pages**, la fuente debe ser **GitHub Actions**.

## Catálogo

Archivos publicados:

```text
public/data/cameras.json
public/data/catalog-meta.json
```

Fuentes de entrada:

1. catálogo heredado del prototipo;
2. `data/manual/cameras.csv`;
3. fuentes JSON o GeoJSON activadas en `data/sources.json`.

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

Para formatos distintos se añadirá un adaptador específico dentro de `scripts/ingest/`.

## Límites reales

“Sin límite de catálogo” no significa dibujar medio millón de reproductores a la vez. El navegador muestra clústeres y solo carga medios cuando son visibles o seleccionados. Para catálogos muy grandes, la evolución prevista es generar teselas vectoriales o PMTiles desde GitHub Actions y mantener el alojamiento estático.

La imagen satelital no se almacena en el repositorio. Se solicita al proveedor de teselas y la resolución final depende de la cobertura disponible. No se utilizan Google Maps ni servicios que requieran facturación.

## Estructura principal

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
├── map.css
├── styles.css
└── types.ts

scripts/ingest/
├── aggregate.py
├── refresh.py
└── youtube_health.py
```

## Política de cámaras

Cams solo debe integrar cámaras:

- públicas y accesibles sin eludir controles;
- con permiso de inserción o reutilización;
- con atribución visible cuando sea obligatoria;
- sin autenticación robada, scraping evasivo ni acceso a sistemas privados;
- sin funciones de reconocimiento facial, seguimiento de personas o identificación.

Véase `docs/CAMERA_SOURCE_POLICY.md`.
