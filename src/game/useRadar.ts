import { useEffect, useRef } from 'react';
import { backend, bajarPerfil, hayBackend, identidadLocal, subirPerfil } from './backend';
import { usePlayerPosition } from './geo';
import { difuminar } from './social';
import { usePlayerStore, usePresenceStore } from './store';
import type { OtroJugador } from './store';

/**
 * Radar multijugador (Fase 5, PWA).
 * - Sin backend: modo solitario, todo lo demás funciona.
 * - Con backend: presence `radar` con posición DIFUMINADA (±200 m, nunca exacta),
 *   sincronización de perfil con last-write-wins (push con debounce + pull al abrir).
 */
export function useRadar() {
  const { efectiva } = usePlayerPosition();
  const jugador = usePlayerStore((s) => s.jugador);
  const trackRef = useRef<((pos: { lat: number; lng: number }) => void) | null>(null);

  // Unirse al canal una vez.
  useEffect(() => {
    if (!hayBackend()) return;
    const sb = backend();
    if (!sb) return;
    const yo = identidadLocal();
    let canal: ReturnType<typeof sb.channel> | null = null;
    try {
      canal = sb.channel('radar', { config: { presence: { key: yo } } });
      canal.on('presence', { event: 'sync' }, () => {
        if (!canal) return;
        const estado = canal.presenceState() as Record<string, { nombre?: string; nivel?: number; pos?: { lat: number; lng: number }; at?: number }[]>;
        const otros: OtroJugador[] = [];
        for (const [key, presencias] of Object.entries(estado)) {
          if (key === yo) continue;
          const p = presencias[0];
          if (!p?.pos || typeof p.pos.lat !== 'number') continue;
          otros.push({
            id: key,
            nombre: typeof p.nombre === 'string' ? p.nombre : 'Viajero',
            nivel: typeof p.nivel === 'number' ? p.nivel : 1,
            pos: p.pos,
            at: typeof p.at === 'number' ? p.at : Date.now(),
          });
        }
        usePresenceStore.setState({ otros });
      });
      canal.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          trackRef.current = (pos) => {
            void canal?.track({
              nombre: usePlayerStore.getState().jugador.nombre,
              nivel: usePlayerStore.getState().jugador.nivel,
              pos: difuminar(pos),
              at: Date.now(),
            });
          };
          trackRef.current(efectivaRef.current);
        }
      });
    } catch {
      canal = null;
    }
    return () => {
      trackRef.current = null;
      if (canal && sb) void sb.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const efectivaRef = useRef(efectiva);
  efectivaRef.current = efectiva;

  // Re-publicar posición (difuminada) al moverse de celda aprox.
  const firma = `${efectiva.lat.toFixed(4)},${efectiva.lng.toFixed(4)}`;
  useEffect(() => {
    trackRef.current?.(efectiva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  // Push con debounce del perfil.
  useEffect(() => {
    if (!hayBackend()) return;
    const t = setTimeout(() => {
      void subirPerfil(usePlayerStore.getState().jugador, identidadLocal());
    }, 8000);
    return () => clearTimeout(t);
  }, [jugador]);

  // Pull al abrir: si el remoto es más nuevo, adoptarlo.
  useEffect(() => {
    if (!hayBackend()) return;
    void (async () => {
      const remoto = await bajarPerfil(identidadLocal(), usePlayerStore.getState().jugador.updatedAt);
      if (remoto) usePlayerStore.getState().aplicarPerfilRemoto(remoto);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
