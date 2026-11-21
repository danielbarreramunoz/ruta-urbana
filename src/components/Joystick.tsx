import { JOYSTICK_STEP_M, useExplorationStore } from '../game/store';
import { Sprite, uiSvg } from './sprites';

const S = JOYSTICK_STEP_M;

/** Pad de movimiento (mock GPS). Cada toque avanza ~25 m en esa dirección. */
export default function Joystick({ onCenter }: { onCenter: () => void }) {
  const moveMock = useExplorationStore((s) => s.moveMock);
  const botones: { label: string; dx: number; dy: number; accion?: () => void }[] = [
    { label: '↖', dx: -S, dy: S },
    { label: '↑', dx: 0, dy: S },
    { label: '↗', dx: S, dy: S },
    { label: '←', dx: -S, dy: 0 },
    { label: '', dx: 0, dy: 0, accion: onCenter },
    { label: '→', dx: S, dy: 0 },
    { label: '↙', dx: -S, dy: -S },
    { label: '↓', dx: 0, dy: -S },
    { label: '↘', dx: S, dy: -S },
  ];
  return (
    <div className="px-frame px-frame--gold p-2">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span className="font-pixel text-[9px] tracking-widest text-ruta-gold">PAD</span>
        <span className="font-pixel text-[9px] text-ruta-muted">25 M</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {botones.map((b, i) => (
          <button
            key={i}
            aria-label={b.accion ? 'Centrar mapa' : `Mover ${b.label}`}
            onClick={() => (b.accion ? b.accion() : moveMock(b.dx, b.dy))}
            className={`px-btn flex h-11 w-11 items-center justify-center font-pixel text-base ${
              b.accion ? 'px-btn--on' : 'text-ruta-parchment'
            }`}
          >
            {b.accion ? <Sprite svg={uiSvg('target')} size={16} /> : b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
