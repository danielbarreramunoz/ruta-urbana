/**
 * Geocodificación con Nominatim (OpenStreetMap, gratis y sin key).
 * Solo online y con uso moderado (debounce en la UI, 1 resultado por búsqueda).
 * El parseo es puro y testeable; la red puede fallar y la UI lo muestra.
 */
export interface ResultadoGeo {
  /** Nombre corto ("Farmacia Cruz Verde, Quilicura"). */
  nombre: string;
  /** Dirección completa para el detalle. */
  detalle: string;
  lat: number;
  lng: number;
}

/** Convierte el JSON de Nominatim a resultados propios (ignora basura). */
export function parsearNominatim(json: unknown): ResultadoGeo[] {
  if (!Array.isArray(json)) return [];
  const out: ResultadoGeo[] = [];
  for (const it of json) {
    if (typeof it !== 'object' || it === null) continue;
    const o = it as Record<string, unknown>;
    const lat = Number(o.lat);
    const lon = Number(o.lon ?? o.lng);
    const display = typeof o.display_name === 'string' ? o.display_name : '';
    const nombre =
      typeof o.name === 'string' && o.name ? o.name : display ? display.split(',').slice(0, 2).join(',').trim() : '';
    if (!nombre || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({ nombre, detalle: display, lat, lng: lon });
  }
  return out.slice(0, 5);
}

/** Busca una dirección (default Chile). Lanza si no hay red o el servicio falla. */
export async function buscarDireccion(texto: string, pais = 'cl'): Promise<ResultadoGeo[]> {
  const q = texto.trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=${pais}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  return parsearNominatim(await res.json());
}
