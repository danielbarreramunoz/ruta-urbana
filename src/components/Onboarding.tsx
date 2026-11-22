import { useState } from 'react';
import { sonar } from '../game/audio';
import {
  ETIQUETA_EDAD,
  ETIQUETA_INTERES,
  ETIQUETA_SITUACION,
  interesesSugeridos,
} from '../game/perfil';
import { usePerfilStore, useSettingsStore } from '../game/store';
import type { Interes, RangoEdad, Situacion } from '../game/types';
import { Sprite, uiSvg } from './sprites';

const EDADES: RangoEdad[] = ['menor', '18-24', '25-34', '35-49', '50+'];
const SITUACIONES: Situacion[] = ['estudiando', 'buscando-empleo', 'trabajando', 'cesante', 'jubilado'];
const INTERESES: Interes[] = ['salud', 'tramites', 'dinero', 'trabajo', 'hogar'];

/**
 * Inicio: preguntas mínimas que adaptan misiones y lugares de interés.
 * Se puede omitir; en ese caso no se agregan misiones principales automáticas.
 * No se piden diagnósticos médicos, solo categorías de lugares.
 */
export default function Onboarding({ onListo }: { onListo: () => void }) {
  const completar = usePerfilStore((s) => s.completar);
  const omitir = usePerfilStore((s) => s.omitir);
  const sonido = useSettingsStore((s) => s.sonido);
  const [edad, setEdad] = useState<RangoEdad | null>(null);
  const [situacion, setSituacion] = useState<Situacion | null>(null);
  const [intereses, setIntereses] = useState<Interes[]>([]);

  const alternarInteres = (i: Interes) =>
    setIntereses((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const empezar = () => {
    completar({
      edad,
      situacion,
      intereses: intereses.length ? intereses : interesesSugeridos(situacion),
    });
    sonar('completar', sonido);
    onListo();
  };

  const saltar = () => {
    omitir();
    onListo();
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-3 p-4">
      <div>
        <div className="font-pixel text-[10px] tracking-[0.2em] text-ruta-gold">RUTA URBANA</div>
        <h1 className="mt-1 font-pixel text-xl font-bold leading-6 text-ruta-parchment">
          Cuéntanos un poco y armamos tu ruta.
        </h1>
        <p className="mt-1.5 font-pixel text-[10px] leading-4 text-ruta-muted">
          3 preguntas rápidas. Todo queda en este navegador; no pedimos datos médicos.
        </p>
      </div>

      <section className="px-frame p-3">
        <div className="font-pixel text-[11px] font-bold tracking-wide text-ruta-parchment">1 · EDAD</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EDADES.map((e) => (
            <button
              key={e}
              onClick={() => { setEdad(e); sonar('blip', sonido); }}
              aria-pressed={edad === e}
              className={`px-btn px-2.5 py-1.5 font-pixel text-[10px] ${edad === e ? 'px-btn--on' : 'text-ruta-muted'}`}
            >
              {ETIQUETA_EDAD[e]}
            </button>
          ))}
        </div>
      </section>

      <section className="px-frame p-3">
        <div className="font-pixel text-[11px] font-bold tracking-wide text-ruta-parchment">2 · SITUACIÓN</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SITUACIONES.map((s) => (
            <button
              key={s}
              onClick={() => { setSituacion(s); sonar('blip', sonido); }}
              aria-pressed={situacion === s}
              className={`px-btn px-2.5 py-1.5 font-pixel text-[10px] ${situacion === s ? 'px-btn--on' : 'text-ruta-muted'}`}
            >
              {ETIQUETA_SITUACION[s]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 font-pixel text-[9px] leading-3 text-ruta-muted">
          Si ya trabajas, no te aparecerá la misión de primer día laboral.
        </p>
      </section>

      <section className="px-frame p-3">
        <div className="font-pixel text-[11px] font-bold tracking-wide text-ruta-parchment">3 · QUÉ TE INTERESA</div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {INTERESES.map((i) => (
            <button
              key={i}
              onClick={() => { alternarInteres(i); sonar('blip', sonido); }}
              aria-pressed={intereses.includes(i)}
              className={`px-btn px-2 py-2 text-left font-pixel text-[10px] leading-4 ${intereses.includes(i) ? 'px-btn--on' : 'text-ruta-muted'}`}
            >
              {ETIQUETA_INTERES[i]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 font-pixel text-[9px] leading-3 text-ruta-muted">
          Prioriza farmacias, centros de salud y oficinas cerca de ti.
        </p>
      </section>

      <button onClick={empezar} className="px-btn px-btn--xp w-full py-3 font-pixel text-xs font-bold">
        ▶ EMPEZAR
      </button>
      <button onClick={saltar} className="px-btn flex w-full items-center justify-center gap-2 py-2.5 font-pixel text-[10px] text-ruta-muted">
        <Sprite svg={uiSvg('joystick')} size={14} /> OMITIR · SOLO EXPLORAR
      </button>
      <p className="text-center font-pixel text-[9px] leading-3 text-ruta-muted">
        Si omites, no se activan misiones principales: las eliges en el mapa.
      </p>
    </div>
  );
}
