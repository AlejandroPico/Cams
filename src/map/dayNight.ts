export type LightState = 'day' | 'twilight' | 'night';

interface SunPoint {
  lat: number;
  lon: number;
}

const rad = (value: number) => value * Math.PI / 180;
const deg = (value: number) => value * 180 / Math.PI;

function normaliseLon(value: number): number {
  let lon = value;
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

export function subsolarPoint(date = new Date()): SunPoint {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 0);
  const day = Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - start) / 86_400_000);
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const gamma = 2 * Math.PI / 365 * (day - 1 + (hours - 12) / 24);

  const equationOfTime = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(gamma) -
    0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) -
    0.040849 * Math.sin(2 * gamma)
  );

  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  return {
    lat: deg(declination),
    lon: normaliseLon((720 - utcMinutes - equationOfTime) / 4)
  };
}

function vector(lat: number, lon: number) {
  const phi = rad(lat);
  const lambda = rad(lon);
  const cosPhi = Math.cos(phi);
  return {
    x: cosPhi * Math.cos(lambda),
    y: cosPhi * Math.sin(lambda),
    z: Math.sin(phi)
  };
}

export function illumination(lat: number, lon: number, date = new Date()): number {
  const sun = subsolarPoint(date);
  const a = vector(lat, lon);
  const b = vector(sun.lat, sun.lon);
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function lightState(lat: number, lon: number, date = new Date()): LightState {
  const value = illumination(lat, lon, date);
  if (value > 0.1) return 'day';
  if (value > -0.12) return 'twilight';
  return 'night';
}

export function buildNightGrid(date = new Date()): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const step = 6;

  for (let south = -90; south < 90; south += step) {
    const north = Math.min(90, south + step);
    for (let west = -180; west < 180; west += step) {
      const east = west + step;
      const lat = (south + north) / 2;
      const lon = (west + east) / 2;
      const value = illumination(lat, lon, date);
      if (value > 0.16) continue;

      const shade = value < -0.18
        ? Math.min(0.66, 0.34 + (-value * 0.32))
        : Math.max(0.07, (0.16 - value) * 0.72);

      features.push({
        type: 'Feature',
        properties: { shade },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south]
          ]]
        }
      });
    }
  }

  return { type: 'FeatureCollection', features };
}
