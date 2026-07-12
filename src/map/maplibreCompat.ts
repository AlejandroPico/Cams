import maplibregl from 'maplibre-gl';
import { supportsWebGL } from './webglSupport';

type MapLibreCompat = typeof maplibregl & {
  supported?: () => boolean;
};

const compatibleMapLibre = maplibregl as MapLibreCompat;

if (typeof compatibleMapLibre.supported !== 'function') {
  Object.defineProperty(compatibleMapLibre, 'supported', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: supportsWebGL
  });
}
