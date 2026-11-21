import { useState } from 'react';
import { buscarDialogo } from '../game/store';
import { sonar } from '../game/audio';
import { usePlayerStore, useSettingsStore } from '../game/store';
import type { DialogueNode } from '../game/types';
import { Sprite, retratoSvg } from './sprites';

/** Caja de diálogo estilo RPG 16-bit: retrato enmarcado, guion y opciones numeradas. */
export default function DialogueBox({
  nodoInicial,
  onTerminar,
}: {
  nodoInicial: DialogueNode;
  onTerminar: (ultimoNodo: DialogueNode) => void;
}) {
  const [actualId, setActualId] = useState(nodoInicial.id);
  const ganarXP = usePlayerStore((s) => s.ganarXP);
  const sonido = useSettingsStore((s) => s.sonido);
  const nodo = buscarDialogo(actualId) ?? nodoInicial;

  const elegir = (opcionId: string) => {
    const opcion = nodo.opciones.find((o) => o.id === opcionId);
    if (!opcion) return;
    if (opcion.efecto?.xp) ganarXP(opcion.efecto.xp, opcion.efecto.atributos);
    sonar('check', sonido);
    if (opcion.siguienteId && buscarDialogo(opcion.siguienteId)) {
      setActualId(opcion.siguienteId);
    } else {
      onTerminar(nodo);
    }
  };

  return (
    <div className="px-frame px-frame--gold p-3">
      {/* Cabecera: retrato + placa de nombre */}
      <div className="flex items-end gap-2.5">
        <div className="relative flex-none">
          <Sprite svg={retratoSvg(nodo.npcId)} size={64} titulo={nodo.npcNombre} />
          <span className="absolute -bottom-1 -right-1 border border-ruta-void bg-ruta-gold px-1 font-pixel text-[8px] font-bold text-ruta-ink">
            NPC
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="border-2 border-ruta-line bg-ruta-void px-2 py-1">
            <span className="font-pixel text-sm font-bold tracking-wide text-ruta-parchment">{nodo.npcNombre}</span>
          </div>
          {nodo.esRescate ? (
            <div className="mt-1 inline-block border border-ruta-valentia px-1.5 py-0.5 font-pixel text-[9px] tracking-widest text-ruta-valentia">
              ⚠ IMPREVISTO EXTERNO
            </div>
          ) : (
            <div className="mt-1 font-pixel text-[9px] tracking-widest text-ruta-muted">DIÁLOGO</div>
          )}
        </div>
      </div>

      {/* Guion */}
      <div className="relative mt-2.5 border-2 border-ruta-line bg-ruta-void p-3">
        <span className="absolute -top-2 left-2 bg-ruta-void px-1 font-pixel text-[9px] text-ruta-gold">▸ GUION</span>
        <p className="font-pixel text-[13px] leading-6 text-ruta-parchment">{nodo.texto}</p>
      </div>

      {/* Opciones */}
      <div className="mt-2.5 space-y-1.5">
        {nodo.opciones.map((o, i) => (
          <button
            key={o.id}
            onClick={() => elegir(o.id)}
            className="px-btn flex w-full items-start gap-2 p-2.5 text-left"
          >
            <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center border border-ruta-line bg-ruta-void font-pixel text-[9px] text-ruta-gold">
              {i + 1}
            </span>
            <span className="flex-1 font-pixel text-[12px] leading-5 text-ruta-parchment">{o.texto}</span>
            {o.efecto?.xp ? (
              <span className="mt-0.5 flex-none font-pixel text-[9px] text-ruta-xp">+{o.efecto.xp}XP</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
