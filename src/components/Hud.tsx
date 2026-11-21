import { usePlayerStore } from '../game/store';
import { Sprite, attrSvg } from './sprites';

const ATRIBUTOS = [
  { key: 'carisma', label: 'CAR' },
  { key: 'valentia', label: 'VAL' },
  { key: 'burocracia', label: 'BUR' },
  { key: 'supervivencia', label: 'SUP' },
] as const;

/** HUD principal: nivel, barra XP y los 4 atributos. */
export default function Hud() {
  const jugador = usePlayerStore((s) => s.jugador);
  const progreso = Math.min(1, jugador.xp / jugador.xpParaSiguienteNivel);

  return (
    <div className="border-2 border-ruta-line bg-ruta-panel p-3">
      <div className="flex items-center justify-between">
        <span className="font-pixel text-sm font-bold text-ruta-parchment">
          Nv. {jugador.nivel} · {jugador.nombre}
        </span>
        <span className="font-pixel text-xs text-ruta-gold">
          {jugador.xp}/{jugador.xpParaSiguienteNivel} XP
        </span>
      </div>
      <div className="mt-2 h-2.5 w-full border border-ruta-line bg-ruta-void">
        <div className="h-full bg-ruta-xp" style={{ width: `${Math.round(progreso * 100)}%` }} />
      </div>
      <div className="mt-2 flex justify-between">
        {ATRIBUTOS.map((a) => (
          <span key={a.key} className="flex items-center px-1 font-pixel text-[11px] text-ruta-muted">
            <span className="mr-1 inline-flex"><Sprite svg={attrSvg(a.key)} size={14} titulo={a.label} /></span>
            {a.label} <b className="ml-1 text-ruta-parchment">{jugador.atributos[a.key]}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
