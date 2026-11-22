/**
 * Misiones cercanas a una posición (puro TS, sin DOM: testeable con node).
 * Las ubicaciones viven en `quests.json`; la distancia es haversine local,
 * así que funciona offline y sin costo.
 */
import { distanciaA } from './proximity';
import type { Quest, QuestLocation, QuestStatus } from './types';

export interface Cercana {
  questId: string;
  titulo: string;
  ubicacion: QuestLocation;
  /** Metros redondeados a la ubicación. */
  distanciaM: number;
  estado: QuestStatus;
}

export interface OpcionesCercanas {
  /** Cuántas devolver como máximo (default 5). */
  limite?: number;
  /** Radio máximo en metros (default 5000). */
  maxDistM?: number;
  /** Incluir misiones ya completadas (default false). */
  incluirCompletadas?: boolean;
}

/** Objetivos de misión ordenados por distancia ascendente. */
export function misionesCercanas(
  pos: { lat: number; lng: number },
  quests: Quest[],
  estadoDe: (questId: string) => QuestStatus,
  opts?: OpcionesCercanas,
): Cercana[] {
  const limite = opts?.limite ?? 5;
  const maxDistM = opts?.maxDistM ?? 5000;
  const out: Cercana[] = [];
  for (const q of quests) {
    const estado = estadoDe(q.id);
    if (!opts?.incluirCompletadas && estado === 'completada') continue;
    for (const u of q.ubicaciones ?? []) {
      const distanciaM = distanciaA(pos, u);
      if (distanciaM <= maxDistM) {
        out.push({ questId: q.id, titulo: q.titulo, ubicacion: u, distanciaM: Math.round(distanciaM), estado });
      }
    }
  }
  out.sort((a, b) => a.distanciaM - b.distanciaM);
  return out.slice(0, limite);
}

/** "120 M" / "1,2 KM": formato corto para la tarjeta de cercanas. */
export function formatoDistancia(m: number): string {
  if (m < 1000) return `${Math.round(m)} M`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} KM`;
}
