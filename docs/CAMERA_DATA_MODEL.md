# Modelo de datos de cámaras

Cada cámara del catálogo es un objeto JavaScript con los siguientes campos.

| Campo | Tipo | Obligatorio | Descripción |
|---|---:|---:|---|
| `id` | string | Sí | Identificador único generado en formato kebab-case. |
| `title` | string | Sí | Nombre visible de la cámara. |
| `city` | string | Sí | Ciudad, región o punto geográfico principal. |
| `country` | string | Sí | País o territorio. |
| `continent` | string | Sí | Continente o región amplia. |
| `category` | string | Sí | Categoría funcional: Costa, Urbana, Montaña, Naturaleza, Monumento, Volcán, etc. |
| `provider` | string | Sí | Plataforma o entidad asociada a la referencia. |
| `sourceType` | string | Sí | Tipo de fuente. En v1 se usa `public-search`. |
| `sourceUrl` | string | Sí | URL inicial de acceso o búsqueda pública. |
| `embedUrl` | string/null | Sí | URL embebible si se ha verificado. `null` si no se ha comprobado o si la fuente bloquea iframes. |
| `latitude` | number | Futuro | Latitud aproximada para futuro mapa. En v1 queda en `0`. |
| `longitude` | number | Futuro | Longitud aproximada para futuro mapa. En v1 queda en `0`. |
| `tags` | string[] | Sí | Etiquetas de búsqueda y clasificación visual. |
| `landscapeScore` | number | Sí | Puntuación 0-100 de interés paisajístico. |
| `priority` | string | Sí | `alta`, `media` o `normal`. |
| `embeddable` | boolean | Sí | Indica si la cámara se considera embebible de forma estable. |
| `notes` | string | No | Observaciones técnicas o de curación. |

## Criterio de prioridad paisajística

- 90-100: cámara muy paisajística o icónica.
- 82-89: buena vista urbana, costera o cultural.
- 0-81: utilidad normal, menor peso visual o cámara más específica.

## Reglas de mantenimiento

1. No duplicar `id`.
2. Mantener `sourceUrl` como URL oficial, fuente legítima o búsqueda pública temporal.
3. No rellenar `embedUrl` sin verificar que carga en iframe.
4. No usar capturas o miniaturas ajenas salvo autorización/licencia compatible.
5. Evitar enlaces temporales de vídeo cuando el proveedor cambie el directo con frecuencia.
