import { useEffect, useRef } from 'react';
import { mostrarAviso, pedirPermisoAvisos, textoAviso, vibrar } from './alerts';
import { sonar } from './audio';
import { questById } from './data';
import { usePlayerPosition } from './geo';
import { debeAlertar, evaluarProximidad, objetivosDe } from './proximity';
import { useAlertStore, usePlayerStore, useSettingsStore } from './store';

/**
 * Motor de proximidad (Fase 3, versión PWA).
 * - Evalúa la posición efectiva (GPS real o joystick) contra las ubicaciones
 *   de la MISIÓN ACTIVA cada vez que cambia.
 * - Al entrar al radio: vibración + banner interno + notificación del sistema
 *   (solo si la app está oculta y hay permiso), con cooldown de 10 min.
 * - Limitación web honesta: sin la app abierta no hay geofencing en segundo plano.
 */
export function useProximity() {
  const { efectiva, mode, permiso, real, mock } = usePlayerPosition();
  const misionActivaId = usePlayerStore((s) => s.jugador.misionActivaId);
  const ultimasAlertas = useAlertStore((s) => s.ultimasAlertas);
  const dispararAlerta = useAlertStore((s) => s.dispararAlerta);
  const descartarAlerta = useAlertStore((s) => s.descartarAlerta);
  const avisosActivados = useAlertStore((s) => s.avisosActivados);
  const alerta = useAlertStore((s) => s.alerta);
  const ultimaEval = useRef<string>('');

  useEffect(() => {
    if (!misionActivaId) return;
    const quest = questById.get(misionActivaId);
    if (!quest) return;

    const firma = `${efectiva.lat.toFixed(5)},${efectiva.lng.toFixed(5)},${quest.id}`;
    if (firma === ultimaEval.current) return;
    ultimaEval.current = firma;

    const hit = evaluarProximidad(efectiva, objetivosDe(quest));
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
  }, [efectiva, misionActivaId, ultimasAlertas, dispararAlerta, avisosActivados]);

  return { alerta, descartarAlerta, efectiva, mode, permiso, real, mock };
}

/** Activa los avisos del sistema (pide permiso de Notification una vez). */
export async function activarAvisos(): Promise<boolean> {
  const permiso = await pedirPermisoAvisos();
  const ok = permiso === 'granted';
  useAlertStore.getState().setAvisosActivados(ok);
  if (ok) vibrar(60);
  return ok;
}
