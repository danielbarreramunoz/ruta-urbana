import { useExplorationStore, JOYSTICK_STEP_M } from '../game/store';

const S = JOYSTICK_STEP_M;

/** Joystick / Mock GPS para probar desde el escritorio. Cada toque mueve ~25 m. */
export default function Joystick({ onCenter }: { onCenter: () => void }) {
  const moveMock = useExplorationStore((s) => s.moveMock);
  const botones: { label: string; dx: number; dy: number; accion?: () => void }[] = [
    { label: '↖', dx: -S, dy: S },
    { label: '↑', dx: 0, dy: S },
    { label: '↗', dx: S, dy: S },
    { label: '←', dx: -S, dy: 0 },
    { label: '⊙', dx: 0, dy: 0, accion: onCenter },
    { label: '→', dx: S, dy: 0 },
    { label: '↙', dx: -S, dy: -S },
    { label: '↓', dx: 0, dy: -S },
    { label: '↘', dx: S, dy: -S },
  ];
  return (
    <div className="border-2 border-ruta-line bg-ruta-panel/95 p-2">
      <div className="mb-1 text-center font-pixel text-[10px] tracking-widest text-ruta-muted">
        MOCK GPS · PASO 25 M
      </div>
      <div className="mx-auto grid w-[156px] grid-cols-3 gap-1">
        {botones.map((b) => (
          <button
            key={b.label}
            onClick={() => (b.accion ? b.accion() : moveMock(b.dx, b.dy))}
            className="flex h-12 w-12 items-center justify-center border border-ruta-line bg-ruta-void font-pixel text-lg text-ruta-parchment active:bg-ruta-line"
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
