import { useEffect, useState } from 'react';
import { Avatar, Sprite, uiSvg } from './sprites';
import { sonar } from '../game/audio';
import { SLOT_ORDEN, esPropio, estaDesbloqueado, motivoBloqueo, porSlot } from '../game/cosmetics';
import { usePlayerStore, useSettingsStore, type ResultadoCompra } from '../game/store';
import type { CosmeticItem, CosmeticSlot, Equipamiento, Sexo } from '../game/types';

const RESULTADO: Record<ResultadoCompra, string> = {
  ok: 'Comprado',
  'ya-tienes': 'Ya lo tienes',
  'sin-fichas': 'Te faltan fichas',
  bloqueado: 'Aún bloqueado',
  'no-existe': 'No existe',
};

/** Vestuario: avatar grande al centro, ranuras y tienda con fichas. */
export default function AvatarEditor() {
  const jugador = usePlayerStore((s) => s.jugador);
  const comprar = usePlayerStore((s) => s.comprarCosmetico);
  const equipar = usePlayerStore((s) => s.equiparCosmetico);
  const desequipar = usePlayerStore((s) => s.desequiparSlot);
  const renombrar = usePlayerStore((s) => s.renombrar);
  const sonido = useSettingsStore((s) => s.sonido);

  /**
   * Cambia la silueta. Lee la acción en el momento del clic y, si el módulo
   * quedó desfasado (HMR o service worker viejo), escribe el estado directo.
   */
  const elegirSexo = (sexo: Sexo) => {
    const store = usePlayerStore.getState();
    if (typeof store.cambiarSexo === 'function') {
      store.cambiarSexo(sexo);
    } else {
      usePlayerStore.setState((s) => ({
        jugador: { ...s.jugador, sexo, updatedAt: new Date().toISOString() },
      }));
    }
    sonar('blip', sonido);
  };

  const [slot, setSlot] = useState<CosmeticSlot>('pelo');
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2600);
    return () => clearTimeout(t);
  }, [aviso]);

  const items = porSlot(slot);
  const labelSlot = SLOT_ORDEN.find((s) => s.id === slot)?.label ?? slot;

  /** Mismo equipamiento, con la prenda candidata puesta (o sin la ranura). */
  const vista = (item?: CosmeticItem): Equipamiento => {
    const e = { ...jugador.equipado };
    if (item) e[item.slot] = item.id;
    else delete e[slot];
    return e;
  };

  const accion = (item: CosmeticItem) => {
    if (!estaDesbloqueado(jugador, item)) {
      setAviso(`🔒 ${item.nombre}: ${motivoBloqueo(jugador, item) ?? 'bloqueado'}`);
      sonar('blip', sonido);
      return;
    }
    if (jugador.equipado[item.slot] === item.id) {
      desequipar(item.slot);
      sonar('blip', sonido);
      setAviso(`${item.nombre} guardado`);
      return;
    }
    if (!esPropio(jugador, item)) {
      const r = comprar(item.id);
      sonar(r === 'ok' ? 'check' : 'blip', sonido);
      setAviso(r === 'ok' ? `✓ ${item.nombre} comprado` : `${item.nombre}: ${RESULTADO[r]}`);
      return;
    }
    equipar(item.id);
    sonar('blip', sonido);
    setAviso(`Puesto: ${item.nombre}`);
  };

  const estado = (item: CosmeticItem) => {
    if (jugador.equipado[item.slot] === item.id) return { txt: 'QUITAR', activo: true, off: false };
    if (!estaDesbloqueado(jugador, item)) {
      return { txt: `🔒 ${motivoBloqueo(jugador, item) ?? ''}`, activo: false, off: true };
    }
    if (esPropio(jugador, item)) return { txt: 'EQUIPAR', activo: false, off: false };
    return { txt: `COMPRAR · ${item.precio}`, activo: false, off: jugador.fichas < item.precio };
  };

  return (
    <div className="px-frame p-3">
      <div className="flex items-center justify-between">
        <span className="font-pixel text-sm font-bold text-ruta-parchment">VESTUARIO</span>
        <span className="flex items-center gap-1 font-pixel text-[10px] font-bold text-ruta-gold">
          <Sprite svg={uiSvg('coins')} size={11} /> {jugador.fichas} fichas
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div
          className="flex h-[126px] w-[112px] flex-none items-end justify-center border-2 border-ruta-gold bg-[radial-gradient(circle_at_50%_38%,#e9e4d4_0%,#c3bcab_100%)] pb-2"
          style={{ clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))' }}
        >
          <Avatar equipado={jugador.equipado} sexo={jugador.sexo} alto={100} titulo="Tu avatar" />
        </div>

        <div className="min-w-0 flex-1">
          <label className="font-pixel text-[9px] tracking-widest text-ruta-muted">NOMBRE</label>
          <input
            key={jugador.nombre}
            defaultValue={jugador.nombre}
            onBlur={(e) => renombrar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            maxLength={24}
            className="mt-1 w-full border-2 border-ruta-line bg-ruta-void px-2 py-1.5 font-pixel text-[12px] text-ruta-parchment focus:border-ruta-gold focus:outline-none"
          />
          <div className="mt-1.5 flex items-center gap-1">
            <span className="font-pixel text-[9px] tracking-widest text-ruta-muted">SEXO</span>
            {(['f', 'm'] as Sexo[]).map((s) => (
              <button
                key={s}
                onClick={() => elegirSexo(s)}
                className={`px-btn flex-1 py-1 font-pixel text-[9px] ${jugador.sexo === s ? 'px-btn--on' : 'text-ruta-muted'}`}
              >
                {s === 'f' ? 'MUJER' : 'HOMBRE'}
              </button>
            ))}
          </div>
          <div className="mt-2 font-pixel text-[9px] leading-4 text-ruta-muted">
            Nv. {jugador.nivel} · {jugador.cosmeticos.length} cosméticos
          </div>
          {aviso && <div className="mt-1 font-pixel text-[9px] leading-3 text-ruta-xp">{aviso}</div>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {SLOT_ORDEN.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setSlot(s.id);
              setAviso(null);
            }}
            className={`px-btn px-2 py-1 font-pixel text-[9px] ${slot === s.id ? 'px-btn--on' : 'text-ruta-muted'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            desequipar(slot);
            sonar('blip', sonido);
            setAviso(`${labelSlot}: sin prenda`);
          }}
          className={`px-btn flex items-center gap-2 p-1.5 text-left ${jugador.equipado[slot] ? '' : 'px-btn--on'}`}
        >
          <Avatar equipado={vista()} sexo={jugador.sexo} alto={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-pixel text-[10px] font-bold text-ruta-parchment">Sin prenda</span>
            <span className="block font-pixel text-[9px] text-ruta-muted">
              {jugador.equipado[slot] ? 'QUITAR' : 'PUESTO'}
            </span>
          </span>
        </button>

        {items.map((item) => {
          const est = estado(item);
          return (
            <button
              key={item.id}
              onClick={() => accion(item)}
              className={`px-btn flex items-center gap-2 p-1.5 text-left ${est.activo ? 'px-btn--on' : ''} ${est.off ? 'opacity-55' : ''}`}
            >
              <Avatar equipado={vista(item)} sexo={jugador.sexo} alto={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-pixel text-[10px] font-bold text-ruta-parchment">
                  {item.genero === 'f' ? '♀ ' : item.genero === 'm' ? '♂ ' : ''}
                  {item.nombre}
                </span>
                <span className={`block font-pixel text-[9px] ${est.activo ? 'text-ruta-gold' : 'text-ruta-muted'}`}>
                  {est.txt}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 font-pixel text-[9px] leading-4 text-ruta-muted">
        Gana fichas con misiones y desbloquea prendas por nivel. Los premios de misión también se pueden comprar.
      </p>
    </div>
  );
}
