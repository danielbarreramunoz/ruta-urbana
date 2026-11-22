import { useEffect, useRef, useState } from 'react';
import { cellKey, type LatLng } from './fog';
import { useExplorationStore } from './store';

export type PermissionStatus = 'pendiente' | 'ok' | 'denegado' | 'no-fijado';

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
  const ultimaCelda = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== 'gps') return;
    if (!('geolocation' in navigator)) {
      setPermiso('denegado');
      setMode('joystick');
      return;
    }
    // Geolocalización web exige contexto seguro (HTTPS o localhost).
    // En HTTP por IP LAN el watch falla sin fix: no insistir en silencio.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setPermiso('denegado');
      setMode('joystick');
      return;
    }
    setPermiso('pendiente');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPermiso('ok');
        setReal({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        // Solo el bloqueo de permiso abandona el modo GPS.
        // TIMEOUT (3) o POSITION_UNAVAILABLE (2) son transitorios
        // (interior, primer fix lento): se sigue esperando el watch.
        const code = (err as GeolocationPositionError | undefined)?.code;
        if (code === 1) {
          setPermiso('denegado');
          setMode('joystick');
        } else {
          setPermiso('no-fijado');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [mode, setMode]);

  const efectiva: LatLng = mode === 'gps' && real ? real : mock;

  useEffect(() => {
    const key = cellKey(efectiva);
    if (key !== ultimaCelda.current) {
      ultimaCelda.current = key;
      reveal(efectiva);
    }
  }, [efectiva, reveal]);

  return { efectiva, real, mock, mode, permiso };
}
