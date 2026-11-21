import { haversineM, type LatLng } from './fog';
import type { Quest, QuestLocation } from './types';

export const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

export interface Objetivo extends QuestLocation {
  questId: string;
  questTitulo: string;
}

/** Ubicaciones de una misión como objetivos evaluables. */
export function objetivosDe(quest: Quest): Objetivo[] {
  return (quest.ubicaciones ?? []).map((u) => ({ ...u, questId: quest.id, questTitulo: quest.titulo }));
}

export interface Evaluacion {
  objetivo: Objetivo;
  distanciaM: number;
  dentro: boolean;
}

/** Evalúa la posición contra los objetivos: devuelve el más cercano dentro de su radio (o null). */
export function evaluarProximidad(pos: LatLng, objetivos: Objetivo[]): Evaluacion | null {
  let mejor: Evaluacion | null = null;
  for (const o of objetivos) {
    const distanciaM = haversineM(pos, { lat: o.latitud, lng: o.longitud });
    if (distanciaM <= o.radioM && (!mejor || distanciaM < mejor.distanciaM)) {
      mejor = { objetivo: o, distanciaM, dentro: true };
    }
  }
  return mejor;
}

/** ¿Pasó el cooldown desde la última alerta de ese objetivo? */
export function debeAlertar(ultimaAlertaMs: number | undefined, ahoraMs: number, cooldownMs = ALERT_COOLDOWN_MS): boolean {
  if (ultimaAlertaMs === undefined) return true;
  return ahoraMs - ultimaAlertaMs >= cooldownMs;
}
