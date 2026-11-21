/**
 * RUTA URBANA — Motor de niebla (Fase 1).
 * Puro TS, sin dependencias de RN: toda la matemática es testeable en Node.
 *
 * El mundo se divide en celdas cuadradas de 100 m (CELL_M).
 * - `cellKey`: celda que contiene un punto.
 * - `cellsAround`: celdas cuyo centro cae dentro de un radio (revelado).
 * - `bboxCells`: grilla cuadrada para renderizar la niebla cercana.
 * Todo en [lng, lat] (orden GeoJSON).
 */

export const CELL_M = 100;
export const REVEAL_RADIUS_M = 100;
const M_PER_DEG_LAT = 111320;

export interface LatLng {
  lat: number;
  lng: number;
}

const mPerDegLng = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

const toMeters = (p: LatLng) => ({ x: p.lng * mPerDegLng(p.lat), y: p.lat * M_PER_DEG_LAT });

const fromMeters = (x: number, y: number, refLat: number): LatLng => ({
  lat: y / M_PER_DEG_LAT,
  lng: x / mPerDegLng(refLat),
});

/** Clave estable de la celda que contiene el punto. */
export function cellKey(p: LatLng): string {
  const { x, y } = toMeters(p);
  return `${Math.floor(x / CELL_M)},${Math.floor(y / CELL_M)}`;
}

/** Centro geográfico de una celda. */
export function cellCenter(key: string): LatLng {
  const [ix, iy] = key.split(',').map(Number);
  const y = (iy + 0.5) * CELL_M;
  const refLat = y / M_PER_DEG_LAT;
  return fromMeters((ix + 0.5) * CELL_M, y, refLat);
}

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Celdas que intersectan el círculo de revelado (cobertura real de radio). */
export function cellsAround(p: LatLng, radiusM: number = REVEAL_RADIUS_M): string[] {
  const { x, y } = toMeters(p);
  const steps = Math.ceil(radiusM / CELL_M) + 1;
  const ix0 = Math.floor(x / CELL_M);
  const iy0 = Math.floor(y / CELL_M);
  const out: string[] = [];
  for (let ix = ix0 - steps; ix <= ix0 + steps; ix++) {
    for (let iy = iy0 - steps; iy <= iy0 + steps; iy++) {
      // Distancia del punto al rectángulo de la celda (0 si cae dentro).
      const dx = Math.max(ix * CELL_M - x, 0, x - (ix + 1) * CELL_M);
      const dy = Math.max(iy * CELL_M - y, 0, y - (iy + 1) * CELL_M);
      if (Math.hypot(dx, dy) <= radiusM) out.push(`${ix},${iy}`);
    }
  }
  return out;
}

/** Grilla cuadrada de (2*half+1)^2 celdas centrada en el punto (para render). */
export function bboxCells(p: LatLng, half: number): string[] {
  const { x, y } = toMeters(p);
  const ix0 = Math.floor(x / CELL_M);
  const iy0 = Math.floor(y / CELL_M);
  const out: string[] = [];
  for (let ix = ix0 - half; ix <= ix0 + half; ix++) {
    for (let iy = iy0 - half; iy <= iy0 + half; iy++) out.push(`${ix},${iy}`);
  }
  return out;
}

/** Polígono GeoJSON de una celda ([lng, lat]). */
export function cellPolygon(key: string): number[][][] {
  const [ix, iy] = key.split(',').map(Number);
  const refLat = ((iy + 0.5) * CELL_M) / M_PER_DEG_LAT;
  const x0 = ix * CELL_M;
  const x1 = (ix + 1) * CELL_M;
  const y0 = iy * CELL_M;
  const y1 = (iy + 1) * CELL_M;
  const c = (x: number, y: number): number[] => {
    const p = fromMeters(x, y, refLat);
    return [p.lng, p.lat];
  };
  return [[c(x0, y0), c(x1, y0), c(x1, y1), c(x0, y1), c(x0, y0)]];
}

/** Círculo GeoJSON (radio de revelado visible en el mapa). */
export function circlePolygon(center: LatLng, radiusM: number, steps = 48): number[][][] {
  const ring: number[][] = [];
  const latR = radiusM / M_PER_DEG_LAT;
  const lngR = radiusM / mPerDegLng(center.lat);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([center.lng + lngR * Math.cos(a), center.lat + latR * Math.sin(a)]);
  }
  return [ring];
}

/** FeatureCollection de celdas NO visitadas (la niebla a dibujar). */
export function fogFeatureCollection(nearby: string[], visited: Set<string> | string[]) {
  const has = Array.isArray(visited) ? new Set(visited).has.bind(new Set(visited)) : visited.has.bind(visited);
  return {
    type: 'FeatureCollection' as const,
    features: nearby.filter((k) => !has(k)).map((k) => ({
      type: 'Feature' as const,
      id: k,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: cellPolygon(k) },
    })),
  };
}
