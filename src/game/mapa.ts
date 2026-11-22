/**
 * Límites del mapa alrededor del personaje (puro TS, sin DOM).
 * Evita alejar/desplazar a zonas que obligan a cargar medio país de baldosas.
 */
import { haversineM, type LatLng } from './fog';

/** Máximo alejamiento (zoom) permitido. */
export const ZOOM_MIN_MAPA = 14;
export const ZOOM_MAX_MAPA = 19;

/** Distancia máxima del centro del mapa al personaje (metros). */
export const LIMITE_PAN_M = 3000;

/**
 * Recorta el centro pedido para que no se aleje más de `limiteM` del personaje.
 * Si está dentro, devuelve el mismo punto.
 */
export function limitarCentro(centro: LatLng, personaje: LatLng, limiteM = LIMITE_PAN_M): LatLng {
  const d = haversineM(centro, personaje);
  if (!Number.isFinite(d) || d <= limiteM) return centro;
  const t = limiteM / d;
  return {
    lat: personaje.lat + (centro.lat - personaje.lat) * t,
    lng: personaje.lng + (centro.lng - personaje.lng) * t,
  };
}

/** ¿El centro necesita recorte? (evita setView innecesario y bucles). */
export function centroFueraDeLimite(centro: LatLng, personaje: LatLng, limiteM = LIMITE_PAN_M): boolean {
  return haversineM(centro, personaje) > limiteM + 1;
}
