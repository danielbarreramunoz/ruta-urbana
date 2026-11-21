import { useState } from 'react';
import { dialogueById } from '../game/data';
import { sonar } from '../game/audio';
import { usePlayerStore, useSettingsStore } from '../game/store';
import type { DialogueNode } from '../game/types';
import { Sprite, retratoSvg } from './sprites';

/** Caja de diálogo estilo RPG con retrato pixel-art definitivo. */
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
  const nodo = dialogueById.get(actualId) ?? nodoInicial;

  const elegir = (opcionId: string) => {
    const opcion = nodo.opciones.find((o) => o.id === opcionId);
    if (!opcion) return;
    if (opcion.efecto?.xp) ganarXP(opcion.efecto.xp, opcion.efecto.atributos);
    sonar('check', sonido);
    if (opcion.siguienteId && dialogueById.has(opcion.siguienteId)) {
      setActualId(opcion.siguienteId);
    } else {
      onTerminar(nodo);
    }
  };

  return (
    <div className="border-2 border-ruta-gold bg-ruta-panel p-4">
      <div className="flex items-center">
        <Sprite svg={retratoSvg(nodo.npcId)} size={56} titulo={nodo.npcNombre} />
        <div className="ml-3 flex-1">
          <div className="font-pixel text-sm font-bold text-ruta-parchment">{nodo.npcNombre}</div>
          {nodo.esRescate && <div className="font-pixel text-[11px] text-ruta-valentia">⚠ IMPREVISTO EXTERNO</div>}
        </div>
      </div>
      <div className="mt-3 border border-ruta-line bg-ruta-void p-3">
        <p className="font-pixel text-sm leading-6 text-ruta-parchment">“{nodo.texto}”</p>
      </div>
      <div className="mt-3 space-y-2">
        {nodo.opciones.map((o) => (
          <button
            key={o.id}
            onClick={() => elegir(o.id)}
            className="w-full border border-ruta-line bg-ruta-void p-3 text-left font-pixel text-[13px] leading-5 text-ruta-parchment active:border-ruta-gold"
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}
