import { useEffect, useRef } from 'react';
import { JOYSTICK_STEP_M, JOYSTICK_TICK_MS, useExplorationStore } from '../game/store';
import { Sprite, uiSvg } from './sprites';

const S = JOYSTICK_STEP_M;

type Dir = { dx: number; dy: number };

const DIRECCIONES: Record<string, Dir> = {
  up: { dx: 0, dy: S },
  down: { dx: 0, dy: -S },
  left: { dx: -S, dy: 0 },
  right: { dx: S, dy: 0 },
  'up-left': { dx: -S, dy: S },
  'up-right': { dx: S, dy: S },
  'down-left': { dx: -S, dy: -S },
  'down-right': { dx: S, dy: -S },
};

/** Teclas soportadas: WASD, flechas y combinaciones para diagonales. */
const TECLAS: Record<string, string> = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
};

/**
 * Pad de movimiento (mock GPS) + teclado.
 * Mantener pulsado (o mantener la tecla) camina de forma continua; soltar detiene.
 */
export default function Joystick({ onCenter }: { onCenter: () => void }) {
  const moveMock = useExplorationStore((s) => s.moveMock);
  const intervalos = useRef(new Map<string, number>());
  const teclasAbajo = useRef(new Set<string>());

  const iniciar = (id: string, dx: number, dy: number) => {
    if (intervalos.current.has(id)) return;
    moveMock(dx, dy); // primer paso inmediato
    intervalos.current.set(id, window.setInterval(() => moveMock(dx, dy), JOYSTICK_TICK_MS));
  };

  const detener = (id: string) => {
    const t = intervalos.current.get(id);
    if (t !== undefined) {
      window.clearInterval(t);
      intervalos.current.delete(id);
    }
  };

  const detenerTodo = () => {
    for (const t of intervalos.current.values()) window.clearInterval(t);
    intervalos.current.clear();
    teclasAbajo.current.clear();
  };

  useEffect(() => detenerTodo, []);

  // Teclado: respeta campos de texto y evita el scroll de la página.
  useEffect(() => {
    const esCampo = (t: EventTarget | null) =>
      t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);

    const mover = () => {
      const set = teclasAbajo.current;
      const dx = (set.has('right') ? S : 0) - (set.has('left') ? S : 0);
      const dy = (set.has('up') ? S : 0) - (set.has('down') ? S : 0);
      detener('teclado');
      if (dx !== 0 || dy !== 0) iniciar('teclado', dx, dy);
    };

    const onDown = (e: KeyboardEvent) => {
      if (esCampo(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const dir = TECLAS[e.key.toLowerCase()];
      if (!dir) return;
      // Captura + corte: Leaflet también escucha flechas en el contenedor del
      // mapa y detiene la propagación; sin esto el mapa se panea y el pad no anda.
      e.preventDefault();
      e.stopPropagation();
      if (teclasAbajo.current.has(dir)) return; // auto-repeat del SO
      teclasAbajo.current.add(dir);
      mover();
    };

    const onUp = (e: KeyboardEvent) => {
      const dir = TECLAS[e.key.toLowerCase()];
      if (!dir) return;
      e.stopPropagation();
      teclasAbajo.current.delete(dir);
      mover();
    };

    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    window.addEventListener('blur', detenerTodo);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('blur', detenerTodo);
      detenerTodo();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const botones: { label: string; dir?: string; accion?: () => void }[] = [
    { label: '↖', dir: 'up-left' },
    { label: '↑', dir: 'up' },
    { label: '↗', dir: 'up-right' },
    { label: '←', dir: 'left' },
    { label: '', accion: onCenter },
    { label: '→', dir: 'right' },
    { label: '↙', dir: 'down-left' },
    { label: '↓', dir: 'down' },
    { label: '↘', dir: 'down-right' },
  ];

  return (
    <div className="px-frame px-frame--gold p-2">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span className="font-pixel text-[9px] tracking-widest text-ruta-gold">PAD</span>
        <span className="font-pixel text-[9px] text-ruta-muted">MANTÉN · WASD</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {botones.map((b, i) => {
          const dir = b.dir ? DIRECCIONES[b.dir] : undefined;
          const id = `btn:${i}`;
          return (
            <button
              key={i}
              aria-label={b.accion ? 'Centrar mapa' : `Caminar ${b.label}`}
              onPointerDown={(e) => {
                if (!dir) return;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                iniciar(id, dir.dx, dir.dy);
              }}
              onPointerUp={() => detener(id)}
              onPointerCancel={() => detener(id)}
              onPointerLeave={() => detener(id)}
              onKeyDown={(e) => {
                if (!dir || (e.key !== 'Enter' && e.key !== ' ')) return;
                e.preventDefault();
                iniciar(id, dir.dx, dir.dy);
              }}
              onKeyUp={(e) => {
                if (!dir || (e.key !== 'Enter' && e.key !== ' ')) return;
                detener(id);
              }}
              onClick={() => b.accion?.()}
              style={dir ? { touchAction: 'none' } : undefined}
              className={`px-btn flex h-11 w-11 items-center justify-center font-pixel text-base ${
                b.accion ? 'px-btn--on' : 'text-ruta-parchment'
              }`}
            >
              {b.accion ? <Sprite svg={uiSvg('target')} size={16} /> : b.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
