import { useEffect, useRef } from 'react';
import { mostrarAviso, pedirPermisoAvisos, textoAviso, vibrar } from './alerts';
import { sonar } from './audio';
import { usePlayerPosition } from './geo';
import { debeAlertar, evaluarProximidad, objetivosDe, type Evaluacion } from './proximity';
import { PROGRESO_VACIO, buscarQuest, questConDestino, useAlertStore, usePlayerStore, useQuestStore, useSettingsStore } from './store';
import type { Quest } from './types';

/**
 * Motor de proximidad (Fase 3, versión PWA).
 * - Evalúa la posición efectiva (GPS real o joystick) contra las ubicaciones
 *   de la MISIÓN ACTIVA cada vez que cambia.
 * - Al entrar al radio: vibración + banner interno + notificación del sistema
 *   (solo si la app está oculta y hay permiso), con cooldown de 10 min.
 * - Limitación web honesta: sin la app abierta no hay geofencing en segundo plano.
 */
export function useProximity() {
  const { efectiva, mode, permiso, real, mock, detalle, errorInfo, precisionM, seguro, reintentar } = usePlayerPosition();
  const misionActivaId = usePlayerStore((s) => s.jugador.misionActivaId);
  const secundarias = usePlayerStore((s) => s.jugador.secundariasActivas);
  const firmaSecundarias = secundarias.join(',');  const ultimasAlertas = useAlertStore((s) => s.ultimasAlertas);
  const dispararAlerta = useAlertStore((s) => s.dispararAlerta);
  const descartarAlerta = useAlertStore((s) => s.descartarAlerta);
  const avisosActivados = useAlertStore((s) => s.avisosActivados);
  const alerta = useAlertStore((s) => s.alerta);
  const ultimaEval = useRef<string>('');

  useEffect(() => {
    // Todas las activas: 1 principal + hasta 2 secundarias (ids desde la firma).
    const secIds = firmaSecundarias ? firmaSecundarias.split(',') : [];
    const activas = [...new Set([...(misionActivaId ? [misionActivaId] : []), ...secIds])];
    if (activas.length === 0) return;
    const progresos = useQuestStore.getState().progresos;
    const quests = activas
      .map((id) => {
        const base = buscarQuest(id);
        return base ? questConDestino(base, progresos[id] ?? PROGRESO_VACIO) : null;
      })
      .filter((q): q is Quest => q !== null);
    if (quests.length === 0) return;

    const firma = `${efectiva.lat.toFixed(5)},${efectiva.lng.toFixed(5)},${activas.join('|')}`;
    if (firma === ultimaEval.current) return;
    ultimaEval.current = firma;

    // El más cercano dentro de su radio, entre todas las activas.
    let hit: Evaluacion | null = null;
    for (const q of quests) {
      const h = evaluarProximidad(efectiva, objetivosDe(q));
      if (h && (!hit || h.distanciaM < hit.distanciaM)) hit = h;
    }
    if (!hit) return;

    const clave = `${hit.objetivo.questId}:${hit.objetivo.id}`;
    if (!debeAlertar(ultimasAlertas[clave], Date.now())) return;

    dispararAlerta({
      questId: hit.objetivo.questId,
      locationId: hit.objetivo.id,
      nombre: hit.objetivo.nombre,
      sensible: hit.objetivo.sensible,
      questTitulo: hit.objetivo.questTitulo,
      distanciaM: Math.round(hit.distanciaM),
    });
    vibrar([100, 50, 100]);
    sonar('alerta', useSettingsStore.getState().sonido);
    if (avisosActivados) {
      const { titulo, cuerpo } = textoAviso(hit.objetivo, hit.objetivo.questTitulo);
      mostrarAviso(titulo, cuerpo);
    }
  }, [efectiva, misionActivaId, firmaSecundarias, ultimasAlertas, dispararAlerta, avisosActivados]);

  return { alerta, descartarAlerta, efectiva, mode, permiso, real, mock, detalle, errorInfo, precisionM, seguro, reintentar };
}

/** Activa los avisos del sistema (pide permiso de Notification una vez). */
export async function activarAvisos(): Promise<boolean> {
  const permiso = await pedirPermisoAvisos();
  const ok = permiso === 'granted';
  useAlertStore.getState().setAvisosActivados(ok);
  if (ok) vibrar(60);
  return ok;
}
