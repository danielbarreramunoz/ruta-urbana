import { haversineM, type LatLng } from './fog';

/** Desplaza un punto al azar dentro de un radio (privacidad: ubicación difusa). */
export function difuminar(p: LatLng, radioM = 200, azar: () => number = Math.random): LatLng {
  const ang = azar() * 2 * Math.PI;
  const r = Math.sqrt(azar()) * radioM;
  const dLat = (r * Math.sin(ang)) / 111320;
  const dLng = (r * Math.cos(ang)) / (111320 * Math.cos((p.lat * Math.PI) / 180));
  return { lat: p.lat + dLat, lng: p.lng + dLng };
}

/** Código de 4 dígitos estable por dispositivo (intercambio presencial). */
export function codigoDeDispositivo(deviceId: string): string {
  let h = 0;
  for (let i = 0; i < deviceId.length; i++) h = (h * 31 + deviceId.charCodeAt(i)) >>> 0;
  return String(1000 + (h % 9000));
}

export function codigoValido(code: string): boolean {
  return /^\d{4}$/.test(code.trim());
}

/** Distancia aproximada a otro jugador (posiciones ya difuminadas). */
export function distanciaAJugador(a: LatLng, b: LatLng): number {
  return Math.round(haversineM(a, b));
}

export interface Vecino {
  id: string;
  nombre: string;
  nivel: number;
  pos: LatLng;
  at: number;
}

/** Vecinos vigentes (vistos en los últimos 60 s) ordenados por cercanía. */
export function vecinosCercanos(yo: LatLng, otros: Vecino[], ahoraMs = Date.now(), maxMs = 60_000): (Vecino & { distanciaM: number })[] {
  return otros
    .filter((o) => ahoraMs - o.at <= maxMs)
    .map((o) => ({ ...o, distanciaM: distanciaAJugador(yo, o.pos) }))
    .sort((a, b) => a.distanciaM - b.distanciaM);
}

/** Resumen de intercambio presencial: ambos suben Carisma (cada uno lo aplica en su juego). */
export function recompensaIntercambio(): { xp: number; atributos: { carisma: number } } {
  return { xp: 30, atributos: { carisma: 1 } };
}
