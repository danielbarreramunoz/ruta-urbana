/**
 * Lugares de interés cercanos vía Overpass API (OpenStreetMap, gratis y sin key).
 * Solo online: la app avisa y permite reintentar. El parseo es puro y testeable.
 *
 * No se promete nada sobre horarios ni trámites disponibles: OSM es comunitario
 * y puede estar desactualizado. El pin solo marca "aquí hay un lugar posible".
 */
import type { Interes } from './types';

export type CategoriaPoi = 'farmacia' | 'salud' | 'banco' | 'registro-civil' | 'municipalidad' | 'oficina';

export interface Poi {
  /** id estable de OSM (tipo/número) para deduplicar. */
  id: string;
  categoria: CategoriaPoi;
  nombre: string;
  lat: number;
  lng: number;
}

export const ETIQUETA_POI: Record<CategoriaPoi, string> = {
  farmacia: 'Farmacia',
  salud: 'Centro de salud',
  banco: 'Banco',
  'registro-civil': 'Registro Civil',
  municipalidad: 'Municipalidad',
  oficina: 'Oficina pública',
};

/** Interés del perfil al que aporta cada categoría. */
export const INTERES_POI: Record<CategoriaPoi, Interes> = {
  farmacia: 'salud',
  salud: 'salud',
  banco: 'dinero',
  'registro-civil': 'tramites',
  municipalidad: 'tramites',
  oficina: 'tramites',
};

/** Radio de búsqueda por defecto (metros). */
export const RADIO_POI_M = 3000;
/** No devolver POIs de una zona anterior lejana como respaldo sin red. */
export const RADIO_CACHE_FALLBACK_M = 1500;
/** TTL de caché: no golpear Overpass en cada apertura. */
export const TTL_CACHE_MS = 12 * 60 * 60 * 1000;

/**
 * Instancias públicas de Overpass (globales). La principal se satura seguido
 * (502 "queue full"), así que se prueba en orden hasta que una responda.
 * Ojo: NO usar espejos regionales como overpass.osm.ch (solo Suiza): responden
 * 200 con cero elementos para Chile.
 */
export const ENDPOINTS_OVERPASS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
/** Último endpoint que respondió bien, para no empezar por el saturado. */
const CLAVE_ENDPOINT = 'ruta-urbana/pois-endpoint';


interface PoiCache {
  at: number;
  lat: number;
  lng: number;
  radioM: number;
  pois: Poi[];
}

// v4 fuerza una consulta tras fusionar Overpass con farmacias por etiqueta OSM:
// las cachés v2/v3 podían contener un solo resultado Photon durante 12 h.
const CLAVE_CACHE = 'ruta-urbana/pois-v4';

/** Query Overpass: farmacias, salud y oficinas de trámites alrededor de un punto. */
export function queryOverpass(lat: number, lng: number, radioM = RADIO_POI_M): string {
  const around = `(around:${Math.round(radioM)},${lat},${lng})`;
  // `nwr` agrupa nodos, vías y relaciones en una sola cláusula: la consulta
  // anterior con 8 cláusulas tardaba o era rechazada por Overpass saturado.
  return `[out:json][timeout:20];(
nwr["amenity"~"^(pharmacy|hospital|clinic|doctors|townhall|bank)$"]${around};
nwr["shop"~"^(chemist|pharmacy)$"]${around};
nwr["healthcare"="pharmacy"]${around};
nwr["office"~"^(government|administrative|register_office)$"]${around};
nwr["government"="registro_civil"]${around};
);out center tags 200;`;
}

function categoriaDe(tags: Record<string, unknown>): CategoriaPoi | null {
  const gov = String(tags.government ?? '');
  const office = String(tags.office ?? '');
  const amenity = String(tags.amenity ?? '');
  const shop = String(tags.shop ?? '');
  const healthcare = String(tags.healthcare ?? '');
  if (gov === 'registro_civil' || office === 'register_office') return 'registro-civil';
  if (amenity === 'townhall') return 'municipalidad';
  if (amenity === 'bank') return 'banco';
  if (amenity === 'pharmacy' || shop === 'chemist' || shop === 'pharmacy' || healthcare === 'pharmacy') return 'farmacia';
  if (amenity === 'hospital' || amenity === 'clinic' || amenity === 'doctors') return 'salud';
  if (office === 'government' || office === 'administrative') {
    const nombre = String(tags.name ?? '').toLowerCase();
    if (nombre.includes('registro civil') || nombre.includes('civil')) return 'registro-civil';
    if (nombre.includes('municipal')) return 'municipalidad';
    return 'oficina';
  }
  return null;
}

/** Convierte la respuesta de Overpass en POIs propios (descarta sin nombre/coords). */
export function parsearOverpass(json: unknown): Poi[] {
  const elementos = (json as { elements?: unknown })?.elements;
  if (!Array.isArray(elementos)) return [];
  const vistos = new Set<string>();
  const out: Poi[] = [];
  for (const raw of elementos) {
    if (typeof raw !== 'object' || raw === null) continue;
    const e = raw as Record<string, unknown>;
    const tags = (e.tags ?? {}) as Record<string, unknown>;
    const categoria = categoriaDe(tags);
    if (!categoria) continue;
    const nombre = typeof tags.name === 'string' ? tags.name.trim() : '';
    if (!nombre) continue;
    const lat = Number(e.lat ?? (e.center as { lat?: number } | undefined)?.lat);
    const lng = Number(e.lon ?? (e.center as { lon?: number } | undefined)?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const id = `${typeof e.type === 'string' ? e.type : 'n'}/${String(e.id ?? `${lat},${lng}`)}`;
    if (vistos.has(id)) continue;
    vistos.add(id);
    out.push({ id, categoria, nombre, lat, lng });
  }
  return out;
}

function leerCache(): PoiCache | null {
  try {
    const raw = localStorage.getItem(CLAVE_CACHE);
    return raw ? (JSON.parse(raw) as PoiCache) : null;
  } catch {
    return null;
  }
}

function guardarCache(c: PoiCache): void {
  try {
    localStorage.setItem(CLAVE_CACHE, JSON.stringify(c));
  } catch {
    /* cuota llena: se pierde la caché, no la partida */
  }
}

/** Caché válida para el mismo punto (±300 m) y dentro del TTL. */
export function cacheSirve(c: PoiCache | null, lat: number, lng: number, ahoraMs = Date.now()): boolean {
  // Nunca considerar válida una lista vacía: si Overpass respondió 0 por un
  // espejo regional o un corte, antes quedaba cacheada 12 h y bloqueaba
  // cualquier reintento al moverse.
  if (!c || !Array.isArray(c.pois) || c.pois.length === 0) return false;
  if (!dentroDe(c, lat, lng, 300)) return false;
  return ahoraMs - c.at <= TTL_CACHE_MS;
}

/** ¿La caché cubre este punto dentro de `maxM` metros? */
function dentroDe(c: PoiCache | null, lat: number, lng: number, maxM: number): boolean {
  if (!c || !Array.isArray(c.pois)) return false;
  const dLat = (c.lat - lat) * 111320;
  const dLng = (c.lng - lng) * 111320 * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng) < maxM;
}

export interface ResultadoPoi {
  pois: Poi[];
  /** true si salió de la caché local (sin red). */
  cache: boolean;
  /** true si la caché está vencida o es de otra zona (solo ante error de red). */
  desactualizado?: boolean;
}

/** Espera máxima de la consulta antes de abortar (Overpass a veces se cuelga). */
const TIMEOUT_FETCH_MS = 5000;

function fetchConTimeout(url: string, init: RequestInit, ms = TIMEOUT_FETCH_MS): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function endpointPreferido(): string[] {
  let previo = '';
  try {
    previo = localStorage.getItem(CLAVE_ENDPOINT) ?? '';
  } catch {
    /* sin storage */
  }
  return [...ENDPOINTS_OVERPASS].sort((a, b) => (a === previo ? -1 : b === previo ? 1 : 0));
}

/**
 * Prueba las instancias de Overpass en orden. Si una falla o no responde en
 * 12 s, pasa a la siguiente; recuerda la que funcionó para la próxima carga.
 */
async function pedirOverpass(lat: number, lng: number, radioM: number): Promise<Response> {
  let ultimoError: unknown = null;
  for (const url of endpointPreferido()) {
    try {
      const res = await fetchConTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(queryOverpass(lat, lng, radioM))}`,
      }, 12000);
      if (!res.ok) {
        ultimoError = new Error(`overpass ${res.status}`);
        continue;
      }
      try {
        localStorage.setItem(CLAVE_ENDPOINT, url);
      } catch {
        /* sin storage */
      }
      return res;
    } catch (e) {
      ultimoError = e;
    }
  }
  throw ultimoError instanceof Error ? ultimoError : new Error('overpass sin respuesta');
}

/* ── Respaldo por Photon (komoot) ─────────────────────────────────────────
 * Overpass se cae o satura por temporadas; Photon responde en ~1 s y tiene
 * CORS abierto. Busca por nombre dentro de un bbox, así que se consultan las
 * categorías por su palabra habitual en español.
 */
export const PHOTON_URL = 'https://photon.komoot.io/api/';

const BUSQUEDAS_PHOTON = [
  'farmacia', 'cruz verde', 'salcobrand', 'ahumada',
  'banco', 'banco estado', 'municipalidad', 'registro civil',
  'clinica', 'hospital',
];

interface PhotonFeature {
  properties?: Record<string, unknown>;
  geometry?: { coordinates?: unknown };
}

function categoriaPhoton(p: Record<string, unknown>): CategoriaPoi | null {
  const key = String(p.osm_key ?? '');
  const value = String(p.osm_value ?? '');
  const nombre = String(p.name ?? '').toLowerCase();
  if (value === 'pharmacy' || value === 'chemist' || (key === 'healthcare' && value === 'pharmacy')) return 'farmacia';
  if (key === 'shop' && value === 'chemist') return 'farmacia';
  if (value === 'bank') return 'banco';
  if (value === 'townhall' || value === 'municipality') return 'municipalidad';
  if (value === 'hospital' || value === 'clinic' || value === 'doctors' || value === 'dentist') return 'salud';
  if (key === 'office' && (value === 'government' || value === 'administrative')) {
    if (nombre.includes('registro civil')) return 'registro-civil';
    if (nombre.includes('municipal')) return 'municipalidad';
    return 'oficina';
  }
  return null;
}

/** POIs por Photon dentro de `radioM`. Lanza si el servicio no responde. */
export async function cargarPhoton(lat: number, lng: number, radioM = RADIO_POI_M): Promise<Poi[]> {
  const dLat = radioM / 111320;
  const dLng = radioM / (111320 * Math.cos((lat * Math.PI) / 180));
  const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
  const respuestas = await Promise.allSettled(
    BUSQUEDAS_PHOTON.map((q) =>
      fetchConTimeout(
        `${PHOTON_URL}?q=${encodeURIComponent(q)}&bbox=${bbox}&limit=50&lang=en`,
        { method: 'GET' },
        8000,
      ),
    ),
  );
  const ok = respuestas.filter((r): r is PromiseFulfilledResult<Response> => r.status === 'fulfilled' && r.value.ok);
  if (ok.length === 0) throw new Error('photon sin respuesta');
  const out: Poi[] = [];
  const vistos = new Set<string>();
  for (const r of ok) {
    const json = (await r.value.json()) as { features?: unknown };
    if (!Array.isArray(json.features)) continue;
    for (const raw of json.features as PhotonFeature[]) {
      const p = raw.properties ?? {};
      const categoria = categoriaPhoton(p);
      if (!categoria) continue;
      const coords = raw.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const lngPoi = Number(coords[0]);
      const latPoi = Number(coords[1]);
      if (!Number.isFinite(latPoi) || !Number.isFinite(lngPoi)) continue;
      const dLatM = (latPoi - lat) * 111320;
      const dLngM = (lngPoi - lng) * 111320 * Math.cos((lat * Math.PI) / 180);
      if (Math.hypot(dLatM, dLngM) > radioM) continue;
      const tipo = p.osm_type === 'N' ? 'node' : p.osm_type === 'W' ? 'way' : p.osm_type === 'R' ? 'relation' : '';
      const id = tipo && p.osm_id ? `${tipo}/${p.osm_id}` : `photon/${String(p.name ?? categoria)}/${latPoi},${lngPoi}`;
      if (vistos.has(id)) continue;
      vistos.add(id);
      const nombre = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : ETIQUETA_POI[categoria];
      out.push({ id, categoria, nombre, lat: latPoi, lng: lngPoi });
    }
  }
  return out;
}

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const CLAVE_NOMINATIM = 'ruta-urbana/nominatim-ultimo-ms';
let colaNominatim: Promise<void> = Promise.resolve();

interface NominatimFarmacia {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  category?: string;
  type?: string;
  name?: string;
  display_name?: string;
}

/** Respeta el máximo de 1 req/s de Nominatim, incluso con varios teleports. */
function espaciarNominatim(): Promise<void> {
  const tarea = colaNominatim.then(async () => {
    let ultima = 0;
    try {
      ultima = Number(localStorage.getItem(CLAVE_NOMINATIM) ?? 0);
    } catch {
      /* sin storage */
    }
    const espera = Math.max(0, 1100 - (Date.now() - ultima));
    if (espera > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, espera));
    try {
      localStorage.setItem(CLAVE_NOMINATIM, String(Date.now()));
    } catch {
      /* sin storage */
    }
  });
  colaNominatim = tarea.catch(() => {});
  return tarea;
}

/**
 * Búsqueda estructurada por etiqueta OSM (no por texto): encuentra todas las
 * farmacias amenity=pharmacy dentro del área, aunque tengan nombres distintos.
 */
export async function cargarFarmaciasNominatim(
  lat: number,
  lng: number,
  radioM = RADIO_POI_M,
): Promise<Poi[]> {
  await espaciarNominatim();
  const dLat = radioM / 111320;
  const dLng = radioM / (111320 * Math.cos((lat * Math.PI) / 180));
  const params = new URLSearchParams({
    format: 'jsonv2',
    amenity: 'pharmacy',
    viewbox: `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`,
    bounded: '1',
    limit: '50',
    addressdetails: '0',
  });
  const res = await fetchConTimeout(`${NOMINATIM_URL}?${params}`, { method: 'GET' }, 10000);
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const data = (await res.json()) as NominatimFarmacia[];
  const out: Poi[] = [];
  const vistos = new Set<string>();
  for (const item of data) {
    if (item.category !== 'amenity' || item.type !== 'pharmacy') continue;
    const latPoi = Number(item.lat);
    const lngPoi = Number(item.lon);
    if (!Number.isFinite(latPoi) || !Number.isFinite(lngPoi)) continue;
    const dLatM = (latPoi - lat) * 111320;
    const dLngM = (lngPoi - lng) * 111320 * Math.cos((lat * Math.PI) / 180);
    if (Math.hypot(dLatM, dLngM) > radioM) continue;
    const tipo = item.osm_type === 'N' ? 'node' : item.osm_type === 'W' ? 'way' : 'relation';
    const id = item.osm_id != null ? `${tipo}/${item.osm_id}` : `nominatim/${latPoi},${lngPoi}`;
    if (vistos.has(id)) continue;
    vistos.add(id);
    const nombre = item.name?.trim() || item.display_name?.split(',')[0]?.trim() || 'Farmacia';
    out.push({ id, categoria: 'farmacia', nombre, lat: latPoi, lng: lngPoi });
  }
  return out;
}


/**
 * Carga POIs cercanos. Overpass primero (catálogo completo de OSM), Photon y
 * Nominatim completan los resultados cuando Overpass está saturado o incompleto. Ante fallo total usa
 * la última caché solo si su centro está a menos de 1,5 km; nunca confundir
 * los POIs de una teletransportación anterior con los de la nueva zona.
 */
export async function cargarPois(lat: number, lng: number, radioM = RADIO_POI_M): Promise<ResultadoPoi> {
  const cache = leerCache();
  if (cacheSirve(cache, lat, lng)) return { pois: cache!.pois, cache: true };

  let ultimoError: unknown = null;
  let huboRespuesta = false;
  let poisZona: Poi[] = [];

  try {
    const res = await pedirOverpass(lat, lng, radioM);
    const json: unknown = await res.json();
    huboRespuesta = true;
    const remark = (json as { remark?: unknown })?.remark;
    if (typeof remark === 'string' && remark.length > 0) throw new Error(remark);
    poisZona = parsearOverpass(json);
  } catch (e) {
    ultimoError = e;
  }

  // Complementa OSM aunque Overpass haya devuelto algunos POI: Photon es por
  // búsqueda textual y puede omitir la segunda farmacia de una misma zona.
  // Nominatim consulta una vez la etiqueta estructurada amenity=pharmacy.
  if (poisZona.filter((p) => p.categoria === 'farmacia').length < 8) {
    try {
      const farmacias = await cargarFarmaciasNominatim(lat, lng, radioM);
      huboRespuesta = true;
      const porId = new Map(poisZona.map((p) => [p.id, p]));
      for (const p of farmacias) {
        if (!porId.has(p.id)) porId.set(p.id, p);
      }
      poisZona = [...porId.values()];
    } catch (e) {
      ultimoError = e;
    }
  }
  if (poisZona.length > 0) {
    guardarCache({ at: Date.now(), lat, lng, radioM, pois: poisZona });
    return { pois: poisZona, cache: false };
  }

  // Photon queda como último recurso textual cuando Overpass y Nominatim no
  // encontraron nada; si el primero ya aportó POI no reemplazar cobertura por
  // una búsqueda de texto limitada a resultados de mayor relevancia.
  try {
    const pois = await cargarPhoton(lat, lng, radioM);
    huboRespuesta = true;
    if (pois.length > 0) {
      guardarCache({ at: Date.now(), lat, lng, radioM, pois });
      return { pois, cache: false };
    }
  } catch (e) {
    ultimoError = e;
  }

  if (
    cache &&
    cache.pois.length > 0 &&
    dentroDe(cache, lat, lng, Math.min(RADIO_CACHE_FALLBACK_M, radioM * 0.5))
  ) {
    return { pois: cache.pois, cache: true, desactualizado: true };
  }
  // Si algún proveedor respondió (aunque fuera con 0), no es un error de red:
  // la zona simplemente no tiene POIs de estas categorías.
  if (huboRespuesta) return { pois: [], cache: false };
  throw ultimoError instanceof Error ? ultimoError : new Error('sin datos de lugares');
}
