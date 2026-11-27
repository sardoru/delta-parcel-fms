import { AreaUnit, GeoGeometry, LngLat } from '../types/farm';

export function formatArea(acres: number, unit: AreaUnit): string {
  if (unit === 'ha') {
    const ha = acres * 0.404686;
    return `${ha >= 100 ? Math.round(ha).toLocaleString() : ha.toFixed(1)} ha`;
  }
  return `${acres >= 100 ? Math.round(acres).toLocaleString() : acres.toFixed(1)} ac`;
}

export function formatTemp(tempF: number, unit: AreaUnit): string {
  if (unit === 'ha') {
    const c = Math.round(((tempF - 32) * 5) / 9);
    return `${c}°C`;
  }
  return `${Math.round(tempF)}°F`;
}

export function formatSpeed(mph: number, unit: AreaUnit): string {
  if (unit === 'ha') {
    return `${(mph * 1.60934).toFixed(1)} km/h`;
  }
  return `${mph.toFixed(1)} mph`;
}

export function formatWind(mph: number, unit: AreaUnit): string {
  if (unit === 'ha') {
    return `${Math.round(mph * 1.60934)} km/h`;
  }
  return `${Math.round(mph)} mph`;
}

export function formatYield(lbs: number, unit: AreaUnit): { value: string; unitText: string } {
  if (unit === 'ha') {
    const kg = Math.round(lbs * 0.453592);
    return { value: kg.toLocaleString(), unitText: 'kg harvested today' };
  }
  return { value: Math.round(lbs).toLocaleString(), unitText: 'lbs harvested today' };
}

/** Compute true geodesic area in acres for a WGS84 polygon ring using spherical excess */
export function computeGeodesicAcres(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  const R = 6378137; // WGS84 Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  let total = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % n];
    total += toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }
  const areaSqMeters = Math.abs((total * R * R) / 2);
  const acres = areaSqMeters / 4046.8564224;
  return Number(Math.max(0.5, acres).toFixed(1));
}

export function computeBbox(geometry: GeoGeometry): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visit = (pt: number[]) => {
    if (pt[0] < minLng) minLng = pt[0];
    if (pt[0] > maxLng) maxLng = pt[0];
    if (pt[1] < minLat) minLat = pt[1];
    if (pt[1] > maxLat) maxLat = pt[1];
  };

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach((ring) => ring.forEach(visit));
  } else {
    geometry.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach(visit)));
  }

  return [minLng, minLat, maxLng, maxLat];
}

export function computeRingCentroid(ring: LngLat[]): LngLat {
  if (ring.length === 0) return { lng: -89.9401, lat: 34.5101 };
  const s = ring.reduce((acc, p) => ({ lng: acc.lng + p.lng, lat: acc.lat + p.lat }), {
    lng: 0,
    lat: 0,
  });
  return { lng: Number((s.lng / ring.length).toFixed(5)), lat: Number((s.lat / ring.length).toFixed(5)) };
}

export function compassFromDegrees(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

export function wmoCodeToLabel(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code <= 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Delta Mist';
  if (code <= 67) return 'Light Rain';
  if (code <= 82) return 'Rain Showers';
  return 'Storm Watch';
}
