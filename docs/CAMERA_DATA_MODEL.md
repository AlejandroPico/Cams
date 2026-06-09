# Modelo de datos de cámaras

Cada entrada del catálogo contiene:

| Campo | Tipo | Descripción |
|---|---:|---|
| `id` | string | Identificador único. |
| `title` | string | Título mostrado al usuario. |
| `country` | string | País o territorio. |
| `city` | string | Ciudad, región o zona. |
| `lat` | number | Latitud. |
| `lon` | number | Longitud. |
| `category` | string | Categoría: playa, ciudad, montaña, volcán, animales, aeropuerto, tren, etc. |
| `type` | string | `youtube`, `iframe`, `image`, `mjpeg` o `hls`. |
| `videoId` | string | ID de YouTube cuando `type` es `youtube`. |
| `url` | string | URL para tipos no YouTube. |
| `active` | boolean | Indica si se muestra en el catálogo activo. |
| `provider` | string | Proveedor o plataforma. |

## Ejemplo

```json
{
  "title": "Mallorca · Tora Beach Paguera",
  "country": "España",
  "city": "Paguera",
  "lat": 39.5378,
  "lon": 2.4483,
  "category": "playa",
  "videoId": "iJYYdspOZDk",
  "id": "cam-069",
  "type": "youtube",
  "active": true,
  "provider": "YouTube"
}
```
