import { usePlayerStore } from '../game/store';
import { Sprite, attrSvg, uiSvg } from './sprites';

const ATRIBUTOS = [
  { key: 'carisma', label: 'CAR' },
  { key: 'valentia', label: 'VAL' },
  { key: 'burocracia', label: 'BUR' },
  { key: 'supervivencia', label: 'SUP' },
] as const;

const SEGMENTOS = 10;

/** HUD principal: nivel, XP segmentada y los 4 atributos. */
export default function Hud() {
  const jugador = usePlayerStore((s) => s.jugador);
  const progreso = Math.min(1, jugador.xp / jugador.xpParaSiguienteNivel);
  const llenos = Math.round(progreso * SEGMENTOS);

  return (
    <div className="px-frame px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-none flex-col items-center justify-center border-2 border-ruta-gold bg-ruta-void">
          <span className="font-pixel text-[8px] leading-none text-ruta-muted">NV</span>
          <span className="font-pixel text-lg font-bold leading-none text-ruta-gold">{jugador.nivel}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-pixel text-xs font-bold text-ruta-parchment">{jugador.nombre}</span>
            <span className="flex-none font-pixel text-[10px] text-ruta-gold">
              {jugador.xp}<span className="text-ruta-muted">/{jugador.xpParaSiguienteNivel} XP</span>
            </span>
          </div>
          <div className="mt-1.5 flex gap-[2px]">
            {Array.from({ length: SEGMENTOS }).map((_, i) => (
              <span
                key={i}
                className={`h-2.5 flex-1 border ${i < llenos ? 'border-ruta-xp bg-ruta-xp' : 'border-ruta-line bg-ruta-void'}`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Sprite svg={uiSvg('coins')} size={11} />
            <span className="font-pixel text-[10px] font-bold text-ruta-gold">{jugador.fichas}</span>
            <span className="font-pixel text-[9px] text-ruta-muted">fichas</span>
            <span className="ml-auto font-pixel text-[9px] text-ruta-muted">{jugador.cosmeticos.length} cosméticos</span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        {ATRIBUTOS.map((a) => (
          <div key={a.key} className="flex items-center justify-center gap-1 border border-ruta-line bg-ruta-void px-1 py-1.5">
            <Sprite svg={attrSvg(a.key)} size={16} />
            <span className="font-pixel text-[9px] text-ruta-muted">{a.label}</span>
            <span className="font-pixel text-xs font-bold text-ruta-parchment">{jugador.atributos[a.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
