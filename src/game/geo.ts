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
    if (mode !== 'gps' || !('geolocation' in navigator)) {
      if (mode === 'gps' && !('geolocation' in navigator)) {
        setPermiso('denegado');
        setMode('joystick');
      }
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPermiso('ok');
        setReal({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setPermiso('denegado');
        setMode('joystick');
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
    );
    // Fix inicial rápido (el watch puede tardar).
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPermiso('ok');
        setReal({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setPermiso('no-fijado');
        setMode('joystick');
      },
      { enableHighAccuracy: true, timeout: 15000 },
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
