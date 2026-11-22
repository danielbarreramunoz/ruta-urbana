import { useEffect, useRef, useState } from 'react';
import { cellKey, haversineM, type LatLng } from './fog';
import { useExplorationStore } from './store';

export type PermissionStatus = 'pendiente' | 'ok' | 'denegado' | 'no-fijado';

/** Motivo del último fallo, para mostrar ayuda precisa en el celu (PWA por IP LAN = HTTP). */
export type DetalleGps = null | 'inseguro' | 'sin-soporte' | 'permiso-denegado' | 'sin-fix';

/** Precisión máxima aceptada para pintar niebla (un fix peor es salto, no caminata). */
export const PRECISION_MAX_REVELAR_M = 80;
/** Desplazamiento mínimo desde lo último revelado (frena la deriva con GPS quieto). */
export const DESPLAZAMIENTO_MIN_REVELAR_M = 30;

/** Decisión pura de revelado: testeable con node, sin DOM. */
export function debeRevelar(
  pos: LatLng,
  opts: { mode: 'gps' | 'joystick'; accuracyM: number | null; ultimo: LatLng | null },
): boolean {
  // El PAD es deliberado: siempre pinta.
  if (opts.mode === 'gps') {
    if (opts.accuracyM != null && opts.accuracyM > PRECISION_MAX_REVELAR_M) return false;
    if (opts.ultimo && haversineM(pos, opts.ultimo) < DESPLAZAMIENTO_MIN_REVELAR_M) return false;
  }
  return cellKey(pos) !== (opts.ultimo ? cellKey(opts.ultimo) : null);
}

/**
 * Posición efectiva del jugador en web:
 * - modo gps + permiso + fix → coordenada real (watchPosition).
 * - en otro caso → coordenada virtual del joystick.
 * Revela niebla solo al cambiar de celda.
 */
export function usePlayerPosition() {
  const mode = useExplorationStore((s) => s.mode);
  const mock = useExplorationStore((s) => s.mock);
  const reveal = useExplorationStore((s) => s.reveal);
  const setMode = useExplorationStore((s) => s.setMode);

  const [permiso, setPermiso] = useState<PermissionStatus>('pendiente');
  const [real, setReal] = useState<LatLng | null>(null);
  const [precisionM, setPrecisionM] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<DetalleGps>(null);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const ultimaRevelada = useRef<LatLng | null>(null);
  const huboFix = useRef(false);
  /** Último fix aceptado: el sondeo grueso por red no pisa un GPS fino reciente. */
  const mejorFix = useRef<{ acc: number; at: number } | null>(null);

  const seguro = typeof window === 'undefined' ? true : window.isSecureContext !== false;

  useEffect(() => {
    if (mode !== 'gps') return;
    if (!('geolocation' in navigator)) {
      setPermiso('denegado');
      setDetalle('sin-soporte');
      setErrorInfo('sin geolocation en este navegador');
      return;
    }
    // Geolocalización web exige contexto seguro (HTTPS o localhost).
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setPermiso('denegado');
      setDetalle('inseguro');
      setErrorInfo('contexto inseguro (HTTP por IP)');
      return;
    }
    setPermiso((p) => (p === 'ok' ? p : 'pendiente'));
    let cancelado = false;
    const fijar = (pos: GeolocationPosition, esRed: boolean) => {
      if (cancelado) return;
      const acc = pos.coords.accuracy ?? 9999;
      // Si hay un fix fino reciente, el sondeo por red (±50-200 m y con saltos
      // entre antenas) no mueve el avatar: era el que pintaba niebla lejana.
      const previo = mejorFix.current;
      if (esRed && previo && Date.now() - previo.at < 30000 && previo.acc <= 50 && acc > previo.acc) return;
      mejorFix.current = { acc, at: Date.now() };
      huboFix.current = true;
      setPermiso('ok');
      setDetalle(null);
      setErrorInfo(null);
      setReal({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setPrecisionM(pos.coords.accuracy ?? null);
    };
    const fallar = (err: GeolocationPositionError, origen: string) => {
      if (cancelado) return;
      const code = err?.code;
      setErrorInfo(`${origen} ${code ?? '?'}: ${err?.message ?? 'sin mensaje'}`);
      if (code === 1) {
        setPermiso('denegado');
        setDetalle('permiso-denegado');
        setMode('joystick');
      } else {
        setPermiso((p) => (p === 'ok' ? p : 'no-fijado'));
        if (!huboFix.current) setDetalle('sin-fix');
      }
    };
    // Watch fino (GPS). En Chrome Android el primer fix de alta precisión
    // suele tardar más de 20 s: timeout largo para no matarlo con code 3.
    const watchId = navigator.geolocation.watchPosition((p) => fijar(p, false), (e) => fallar(e, 'watch'), {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 60000,
    });
    // Sondeo por red en bucle (rápido, ±50-200 m): aunque el watch fino se
    // quede colgado (clásico code 3 en Chrome Android), esto mueve el avatar
    // y lo sigue mientras caminas. Su fallo nunca mata el watch.
    let pollTimer: number | undefined;
    const pedirRed = () => {
      if (cancelado) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fijar(pos, true);
          pollTimer = window.setTimeout(pedirRed, 5000);
        },
        (e) => {
          fallar(e, 'red');
          pollTimer = window.setTimeout(pedirRed, 5000);
        },
        { enableHighAccuracy: false, maximumAge: 10000, timeout: 25000 },
      );
    };
    pedirRed();
    return () => {
      cancelado = true;
      window.clearTimeout(pollTimer);
      navigator.geolocation.clearWatch(watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, setMode, intento, seguro]);

  const efectiva: LatLng = mode === 'gps' && real ? real : mock;

  // Revela niebla con guardias: sin fix malo ni deriva en el mismo punto.
  useEffect(() => {
    if (debeRevelar(efectiva, { mode, accuracyM: precisionM, ultimo: ultimaRevelada.current })) {
      ultimaRevelada.current = efectiva;
      reveal(efectiva);
    }
  }, [efectiva, reveal, mode, precisionM]);

  return { efectiva, real, mock, mode, permiso, detalle, errorInfo, precisionM, seguro, reintentar: () => setIntento((i) => i + 1) };
}
