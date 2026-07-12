import type { Camera } from '../types';

const COUNTRY_ZONES: Record<string, string> = {
  espana: 'Europe/Madrid', spain: 'Europe/Madrid', portugal: 'Europe/Lisbon',
  francia: 'Europe/Paris', france: 'Europe/Paris', italia: 'Europe/Rome', italy: 'Europe/Rome',
  alemania: 'Europe/Berlin', germany: 'Europe/Berlin', 'reino unido': 'Europe/London', 'united kingdom': 'Europe/London',
  irlanda: 'Europe/Dublin', ireland: 'Europe/Dublin', islandia: 'Atlantic/Reykjavik', iceland: 'Atlantic/Reykjavik',
  marruecos: 'Africa/Casablanca', morocco: 'Africa/Casablanca', sudafrica: 'Africa/Johannesburg', 'south africa': 'Africa/Johannesburg',
  japon: 'Asia/Tokyo', japan: 'Asia/Tokyo', china: 'Asia/Shanghai', india: 'Asia/Kolkata',
  tailandia: 'Asia/Bangkok', thailand: 'Asia/Bangkok', singapur: 'Asia/Singapore', singapore: 'Asia/Singapore',
  mexico: 'America/Mexico_City', argentina: 'America/Argentina/Buenos_Aires', chile: 'America/Santiago',
  colombia: 'America/Bogota', peru: 'America/Lima', brasil: 'America/Sao_Paulo', brazil: 'America/Sao_Paulo',
  uruguay: 'America/Montevideo', 'nueva zelanda': 'Pacific/Auckland', 'new zealand': 'Pacific/Auckland'
};

const normalise = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function resolveTimeZone(camera: Camera): string | null {
  if (camera.timezone) return camera.timezone;
  const country = normalise(camera.country);
  const city = normalise(camera.city);

  if ((country.includes('espana') || country.includes('spain')) && /canarias|tenerife|gran canaria|lanzarote|fuerteventura/.test(city)) {
    return 'Atlantic/Canary';
  }
  if (country.includes('espana') || country.includes('spain')) return 'Europe/Madrid';

  if (/estados unidos|united states|usa/.test(country)) {
    if (camera.lon < -150) return 'Pacific/Honolulu';
    if (camera.lon < -130) return 'America/Anchorage';
    if (camera.lon < -114) return 'America/Los_Angeles';
    if (camera.lon < -101) return 'America/Denver';
    if (camera.lon < -86) return 'America/Chicago';
    return 'America/New_York';
  }

  if (/canada/.test(country)) {
    if (camera.lon < -125) return 'America/Vancouver';
    if (camera.lon < -100) return 'America/Edmonton';
    if (camera.lon < -85) return 'America/Winnipeg';
    if (camera.lon < -60) return 'America/Toronto';
    return 'America/Halifax';
  }

  if (/australia/.test(country)) {
    if (camera.lon < 129) return 'Australia/Perth';
    if (camera.lon < 141) return 'Australia/Adelaide';
    return 'Australia/Sydney';
  }

  return COUNTRY_ZONES[country] || null;
}

export function formatLocalTime(camera: Camera, date = new Date()): string {
  const zone = resolveTimeZone(camera);
  if (zone) {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        timeZone: zone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date);
    } catch {
      // Fallback por longitud solo cuando el navegador no reconoce la zona IANA.
    }
  }

  const offset = Math.max(-12, Math.min(14, Math.round(camera.lon / 15)));
  const local = new Date(date.getTime() + offset * 3_600_000);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')} UTC${offset >= 0 ? '+' : ''}${offset}`;
}
