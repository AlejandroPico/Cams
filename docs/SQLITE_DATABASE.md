# Base de datos SQLite de Cams

La fuente maestra del catálogo es `data/cams.sqlite3`. GitHub Actions la crea y actualiza ejecutando `scripts/catalog/build_catalog.py`. El navegador no consulta SQLite directamente: el mismo proceso exporta `public/data/cameras.json` y una copia integrada en `src/data/catalog.seed.json`.

El esquema completo y ejecutable está en `data/schema.sql`.

## Tabla `providers`

Registra las redes u organismos de los que procede cada cámara.

| Campo | Significado |
|---|---|
| `id` | Identificador numérico interno. |
| `code` | Código estable y único del proveedor, por ejemplo `CALTRANS`. |
| `name` | Nombre legible del proveedor. |
| `homepage_url` | Página principal. |
| `api_url` | Endpoint usado para importar datos. |
| `country_code` | País principal del proveedor, cuando procede. |
| `attribution` | Texto que debe mostrarse para acreditar la fuente. |
| `license_name` | Nombre de la licencia o condiciones. |
| `license_url` | Enlace a la licencia. |
| `terms_url` | Enlace a términos adicionales. |
| `refresh_seconds` | Intervalo predeterminado de actualización. |
| `enabled` | `1` si el importador está habilitado; `0` si está desactivado. |
| `notes` | Observaciones técnicas o legales. |
| `created_at` | Fecha de creación del registro. |
| `updated_at` | Última modificación. |

## Tabla `cameras`

Contiene una fila por cámara o punto visual.

### Identidad y procedencia

| Campo | Significado |
|---|---|
| `id` | Identificador textual global y estable. No debe cambiar entre importaciones. |
| `provider_id` | Relación con `providers.id`. |
| `external_id` | Identificador utilizado por el proveedor original. |
| `title` | Nombre mostrado en el mapa y mosaico. |
| `description` | Explicación opcional de la vista. |

### Ubicación

| Campo | Significado |
|---|---|
| `country_code` | Código ISO del país cuando se conoce. |
| `country_name` | Nombre legible del país. |
| `region` | Región geográfica amplia. |
| `province` | Provincia, estado, distrito o subdivisión. |
| `city` | Ciudad principal. |
| `locality` | Barrio, pueblo, carretera, montaña u otra localidad más precisa. |
| `latitude` | Latitud decimal entre `-90` y `90`. |
| `longitude` | Longitud decimal entre `-180` y `180`. |
| `altitude_m` | Altitud aproximada en metros. |
| `timezone` | Zona horaria IANA, por ejemplo `Europe/Madrid`. |

### Clasificación y medio

| Campo | Significado |
|---|---|
| `category` | Categoría: tráfico, playa, ciudad, volcán, montaña, puerto, animales, etc. |
| `media_type` | `snapshot`, `image`, `mjpeg`, `hls`, `video`, `youtube`, `iframe` o `link`. |
| `stream_url` | URL directa de vídeo o stream. |
| `embed_url` | URL preparada para iframe o reproductor incrustado. |
| `snapshot_url` | Imagen actual de la cámara. |
| `source_page_url` | Página pública del propietario. |
| `thumbnail_url` | Miniatura alternativa. |
| `refresh_seconds` | Cada cuántos segundos se debe refrescar un snapshot. |
| `is_live` | `1` si es vídeo en directo; `0` para imagen o estado desconocido. |
| `is_public` | Debe ser `1` para exportarse a la aplicación pública. |
| `is_embeddable` | Indica si el proveedor permite mostrar el contenido dentro de Cams. |

### Estado y calidad

| Campo | Significado |
|---|---|
| `status` | `online`, `unknown`, `offline` o `blocked`. |
| `status_reason` | Motivo del estado actual. |
| `width_px` | Anchura conocida de la imagen. |
| `height_px` | Altura conocida. |
| `fps` | Fotogramas por segundo cuando existe vídeo. |
| `orientation_degrees` | Orientación de la cámara en grados. |
| `view_direction` | Dirección legible: norte, puerto, valle, pista, etc. |
| `language` | Idioma principal del proveedor o de la ficha. |

### Licencia, privacidad y mantenimiento

| Campo | Significado |
|---|---|
| `attribution` | Atribución específica de la cámara. |
| `license_name` | Licencia específica. |
| `license_url` | Enlace a la licencia. |
| `terms_url` | Términos del proveedor. |
| `privacy_level` | Naturaleza de la vista, por ejemplo `public-landscape` o `public-traffic`. |
| `active` | `1` para mantenerla en el catálogo. |
| `priority` | Orden relativo; un valor mayor aparece antes. |
| `first_seen_at` | Primera vez que se importó. |
| `last_seen_at` | Última vez que el proveedor la devolvió. |
| `last_checked_at` | Última comprobación. |
| `created_at` | Creación de la fila. |
| `updated_at` | Última actualización. |
| `source_payload_json` | Respuesta original del proveedor para auditoría. |
| `checksum` | Huella para detectar cambios de nombre o URL. |

## Otras tablas

- `tags`: vocabulario de etiquetas reutilizables.
- `camera_tags`: relación muchos-a-muchos entre cámaras y etiquetas.
- `health_checks`: historial de comprobaciones HTTP y errores.
- `ingestion_runs`: historial de cada ejecución de un importador.
- `schema_meta`: versión y metadatos del esquema.
- `camera_catalog`: vista SQL que combina cámaras y proveedores.

## Consultas útiles

```sql
-- Número total de cámaras activas
SELECT COUNT(*) FROM cameras WHERE active = 1;

-- Cámaras por proveedor
SELECT provider_code, COUNT(*)
FROM camera_catalog
WHERE active = 1
GROUP BY provider_code
ORDER BY COUNT(*) DESC;

-- Snapshots españoles
SELECT title, city, snapshot_url
FROM camera_catalog
WHERE country_code = 'ES' AND media_type = 'snapshot';

-- Añadir una etiqueta
INSERT OR IGNORE INTO tags(slug, label) VALUES('costa', 'Costa');
INSERT OR IGNORE INTO camera_tags(camera_id, tag_id)
SELECT 'identificador-de-camara', id FROM tags WHERE slug='costa';
```

## Edición manual

Puede abrirse `data/cams.sqlite3` con DB Browser for SQLite, DBeaver o la extensión SQLite de VS Code. Después de editarla, ejecute:

```bash
python scripts/catalog/build_catalog.py --offline
```

Esto vuelve a generar los JSON sin consultar Internet.
