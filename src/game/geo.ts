import { useEffect, useRef, useState } from 'react';
import { cellKey, type LatLng } from './fog';
import { useExplorationStore } from './store';

export type PermissionStatus = 'pendiente' | 'ok' | 'denegado' | 'no-fijado';

/** Motivo del último fallo, para mostrar ayuda precisa en el celu (PWA por IP LAN = HTTP). */
export type DetalleGps = null | 'inseguro' | 'sin-soporte' | 'permiso-denegado' | 'sin-fix';

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
  const ultimaCelda = useRef<string | null>(null);
  const huboFix = useRef(false);

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
    const fijar = (pos: GeolocationPosition) => {
      if (cancelado) return;
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
    const watchId = navigator.geolocation.watchPosition(fijar, (e) => fallar(e, 'watch'), {
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
          fijar(pos);
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

  useEffect(() => {
    const key = cellKey(efectiva);
    if (key !== ultimaCelda.current) {
      ultimaCelda.current = key;
      reveal(efectiva);
    }
  }, [efectiva, reveal]);

  return { efectiva, real, mock, mode, permiso, detalle, errorInfo, precisionM, seguro, reintentar: () => setIntento((i) => i + 1) };
}
