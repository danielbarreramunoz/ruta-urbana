import { useEffect, useRef } from 'react';
import { Avatar, Sprite, uiSvg } from './sprites';
import { sonar } from '../game/audio';
import { useFxStore, usePlayerStore, useSettingsStore } from '../game/store';

/**
 * Overlay de feedback: "+X XP" flotante y celebración de subida de nivel
 * con el avatar al centro. Se alimenta de `useFxStore` (efímero).
 */
export default function FxOverlay() {
  const avisoXp = useFxStore((s) => s.avisoXp);
  const nivel = useFxStore((s) => s.nivel);
  const cerrarAvisoXp = useFxStore((s) => s.cerrarAvisoXp);
  const cerrarNivel = useFxStore((s) => s.cerrarNivel);
  const jugador = usePlayerStore((s) => s.jugador);
  const sonido = useSettingsStore((s) => s.sonido);
  const nivelActual = usePlayerStore((s) => s.jugador.nivel);
  const nivelPrevio = useRef(nivelActual);

  // Red de seguridad: si el nivel sube por una ruta que no anunció, celebramos igual.
  useEffect(() => {
    if (nivelActual > nivelPrevio.current && useFxStore.getState().nivel !== nivelActual) {
      useFxStore.getState().anunciarXp(0, nivelActual);
    }
    nivelPrevio.current = nivelActual;
  }, [nivelActual]);

  useEffect(() => {
    if (!avisoXp) return;
    const t = setTimeout(() => cerrarAvisoXp(), 1400);
    return () => clearTimeout(t);
  }, [avisoXp, cerrarAvisoXp]);

  useEffect(() => {
    if (nivel) sonar('nivel', sonido);
  }, [nivel, sonido]);

  if (!avisoXp && !nivel) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[1300] flex items-center justify-center">
      {avisoXp && !nivel && (
        <div
          key={avisoXp.id}
          className="ru-xp-toast absolute top-[36%] flex items-center gap-1.5 border-2 border-ruta-xp bg-ruta-void/90 px-3 py-1.5"
        >
          <Sprite svg={uiSvg('xp')} size={12} />
          <span className="font-pixel text-lg font-bold text-ruta-xp">+{avisoXp.xp} XP</span>
        </div>
      )}

      {nivel && (
        <button
          onClick={cerrarNivel}
          className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/75 p-4"
          aria-label="Cerrar subida de nivel"
        >
          <span className="ru-level-flash pointer-events-none" aria-hidden />
          <div className="ru-level-pop px-frame px-frame--gold relative w-full max-w-xs p-4 text-center">
            <div className="font-pixel text-[10px] tracking-[0.3em] text-ruta-gold">SUBISTE DE NIVEL</div>
            <div className="relative mt-2 flex justify-center">
              <span className="ru-level-halo" />
              <span className="ru-level-avatar inline-flex">
                <Avatar equipado={jugador.equipado} sexo={jugador.sexo} alto={104} titulo={`Nivel ${nivel}`} />
              </span>
            </div>
            <div className="mt-1 font-pixel text-[9px] tracking-[0.35em] text-ruta-muted">NIVEL</div>
            <div className="font-pixel text-5xl font-bold leading-none text-ruta-gold">{nivel}</div>
            <div className="mt-1.5 font-pixel text-[11px] text-ruta-parchment">{jugador.nombre}</div>
            <div className="mt-2 font-pixel text-[9px] leading-4 text-ruta-muted">
              Sigue caminando: cada celda nueva y cada misión suman.
            </div>
            <div className="mt-2 font-pixel text-[9px] text-ruta-gold">TOCA PARA SEGUIR</div>
          </div>
        </button>
      )}
    </div>
  );
}
