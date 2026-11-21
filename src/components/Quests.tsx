import { useState } from 'react';
import DialogueBox from './DialogueBox';
import Hud from './Hud';
import { itemById, quests } from '../game/data';
import { publicarMision } from '../game/backend';
import { generarMisionSecundaria, type BriefMision } from '../game/generador';
import { sonar } from '../game/audio';
import { usePlayerPosition } from '../game/geo';
import { buscarDialogo, buscarQuest, usePlayerStore, useQuestStore, useSettingsStore } from '../game/store';
import type { QuestCategory, QuestStep } from '../game/types';

const CATEGORIA: Record<string, string> = {
  tramite: '📋 TRÁMITE',
  salud: '💊 SALUD',
  trabajo: '💼 TRABAJO',
  hogar: '🏠 HOGAR',
  secundaria: '⭐ SECUNDARIA',
};

const ESTADO_COLOR: Record<string, string> = {
  disponible: 'text-ruta-muted',
  activa: 'text-ruta-xp',
  completada: 'text-ruta-gold',
  fallida: 'text-ruta-valentia',
  reprogramada: 'text-ruta-burocracia',
};

const TIPO_ICONO: Record<QuestStep['tipo'], string> = {
  preparacion: '🎒',
  ir: '📍',
  dialogo: '💬',
  accion: '✅',
  rescate: '🆘',
};

export function MisionesTab({ onAbrir }: { onAbrir: (id: string) => void }) {
  const activar = useQuestStore((s) => s.activar);
  const customs = useQuestStore((s) => s.customs);
  const progresos = useQuestStore((s) => s.progresos);
  const agregarCustom = useQuestStore((s) => s.agregarCustom);
  const misionActivaId = usePlayerStore((s) => s.jugador.misionActivaId);
  const sonido = useSettingsStore((s) => s.sonido);
  const { efectiva } = usePlayerPosition();
  const [creando, setCreando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [lugar, setLugar] = useState('');
  const [categoria, setCategoria] = useState<QuestCategory>('secundaria');
  const todas = [...quests, ...customs.map((c) => c.quest)];

  const crear = () => {
    if (titulo.trim().length < 4 || lugar.trim().length < 3) return;
    const brief: BriefMision = { titulo: titulo.trim(), lugar: lugar.trim(), categoria, lat: efectiva.lat, lng: efectiva.lng };
    const { quest, dialogos } = generarMisionSecundaria(brief);
    agregarCustom(quest, dialogos);
    sonar('completar', sonido);
    setTitulo('');
    setLugar('');
    setCreando(false);
    onAbrir(quest.id);
  };

  return (
    <div className="space-y-3">
      <div className="font-pixel text-xs tracking-widest text-ruta-muted">RUTA URBANA · MISIONES</div>
      <Hud />
      <button onClick={() => setCreando((v) => !v)} className="w-full border-2 border-dashed border-ruta-burocracia bg-ruta-panel p-3 font-pixel text-xs font-bold text-ruta-burocracia">
        {creando ? '✕ CERRAR GENERADOR' : '+ CREAR MISIÓN SECUNDARIA (aquí)'}
      </button>
      {creando && (
        <div className="border-2 border-ruta-burocracia bg-ruta-panel p-4">
          <div className="font-pixel text-xs text-ruta-muted">Se crea en tu posición actual · validada como el catálogo oficial</div>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ej. Pagar la luz)" className="mt-2 w-full border border-ruta-line bg-ruta-void p-2.5 font-pixel text-sm text-ruta-parchment placeholder:text-ruta-muted" />
          <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Lugar (ej. Caja vecina)" className="mt-2 w-full border border-ruta-line bg-ruta-void p-2.5 font-pixel text-sm text-ruta-parchment placeholder:text-ruta-muted" />
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as QuestCategory)} className="mt-2 w-full border border-ruta-line bg-ruta-void p-2.5 font-pixel text-sm text-ruta-parchment">
            <option value="secundaria">⭐ Secundaria</option>
            <option value="tramite">📋 Trámite</option>
            <option value="salud">💊 Salud</option>
            <option value="trabajo">💼 Trabajo</option>
            <option value="hogar">🏠 Hogar</option>
          </select>
          <button onClick={crear} disabled={titulo.trim().length < 4 || lugar.trim().length < 3} className="mt-2 w-full border border-ruta-xp bg-ruta-void p-3 font-pixel text-sm font-bold text-ruta-xp disabled:opacity-50">
            GENERAR MISIÓN
          </button>
        </div>
      )}
      {todas.map((q) => {
        const prog = progresos[q.id];
        const estado = prog?.estado ?? q.estado;
        const hecha = estado === 'completada';
        const pasosHechos = prog?.pasosCompletados.length ?? 0;
        const esActiva = misionActivaId === q.id;
        return (
          <div key={q.id} className={`border-2 bg-ruta-panel p-4 ${esActiva ? 'border-ruta-gold' : 'border-ruta-line'}`}>
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[11px] text-ruta-muted">{CATEGORIA[q.categoria]}</span>
              <span className={`font-pixel text-[11px] font-bold ${ESTADO_COLOR[estado]}`}>{estado.toUpperCase()}</span>
            </div>
            <button onClick={() => onAbrir(q.id)} className="mt-1 block text-left font-pixel text-lg font-bold text-ruta-parchment">
              {q.titulo}
            </button>
            <p className="mt-1 font-pixel text-xs leading-5 text-ruta-muted">{q.descripcion}</p>
            <div className="mt-2 font-pixel text-xs text-ruta-muted">
              {pasosHechos}/{q.pasos.length} pasos · +{q.recompensa.xp} XP · Nv. {q.nivelMinimo}+
            </div>
            {!hecha && !esActiva && (
              <button
                onClick={() => { sonar('blip', sonido); activar(q.id); onAbrir(q.id); }}
                className="mt-3 w-full border border-ruta-xp bg-ruta-void p-2.5 font-pixel text-xs font-bold text-ruta-xp"
              >
                {estado === 'reprogramada' ? '↻ REINTENTAR MISIÓN' : '▶ ACTIVAR MISIÓN'}
              </button>
            )}
            {!hecha && esActiva && (
              <button
                onClick={() => onAbrir(q.id)}
                className="mt-3 w-full border border-ruta-gold bg-ruta-void p-2.5 font-pixel text-xs font-bold text-ruta-gold"
              >
                CONTINUAR →
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function QuestDetail({ questId, onVolver }: { questId: string; onVolver: () => void }) {
  const quest = buscarQuest(questId);
  const progreso = useQuestStore((s) => s.progresoDe(questId));
  const activar = useQuestStore((s) => s.activar);
  const toggleCheck = useQuestStore((s) => s.toggleCheck);
  const completarPaso = useQuestStore((s) => s.completarPaso);
  const completarMision = useQuestStore((s) => s.completarMision);
  const registrarRescate = useQuestStore((s) => s.registrarRescate);
  const misionActivaId = usePlayerStore((s) => s.jugador.misionActivaId);
  const nivelAntes = usePlayerStore((s) => s.jugador.nivel);
  const [dialogoAbierto, setDialogoAbierto] = useState<string | null>(null);
  const [pubMsg, setPubMsg] = useState<string | null>(null);
  const sonido = useSettingsStore((s) => s.sonido);
  const customs = useQuestStore((s) => s.customs);

  if (!quest) return <div className="font-pixel text-sm text-ruta-muted">Misión no encontrada.</div>;

  const esCustom = quest.id.startsWith('custom-');
  const publicar = async () => {
    const custom = customs.find((c) => c.quest.id === quest.id);
    if (!custom) return;
    const ok = await publicarMision(custom.quest, custom.dialogos, 'local');
    setPubMsg(ok ? '✓ Publicada en el catálogo comunitario.' : '○ Sin backend: queda solo en tu juego.');
  };

  const esActiva = misionActivaId === quest.id;
  const hecha = progreso.estado === 'completada';
  const ordenActual = quest.pasos.find((p) => !progreso.pasosCompletados.includes(p.id))?.orden;
  const todosPasos = quest.pasos.every((p) => progreso.pasosCompletados.includes(p.id));

  return (
    <div className="space-y-3">
      <button onClick={onVolver} className="font-pixel text-xs text-ruta-muted">← MISIONES</button>
      <Hud />
      <div className="border-2 border-ruta-line bg-ruta-panel p-4">
        <div className="font-pixel text-[11px] text-ruta-muted">{quest.categoria.toUpperCase()} · {progreso.estado.toUpperCase()}</div>
        <h1 className="mt-1 font-pixel text-2xl font-bold text-ruta-parchment">{quest.titulo}</h1>
        <p className="mt-1 font-pixel text-sm leading-6 text-ruta-muted">{quest.descripcion}</p>
        <div className="mt-2 font-pixel text-xs text-ruta-gold">
          Recompensa: +{quest.recompensa.xp} XP
          {quest.recompensa.atributos ? ` (${Object.entries(quest.recompensa.atributos).map(([k, v]) => `+${v} ${k.slice(0, 3).toUpperCase()}`).join(', ')})` : ''}
        </div>
        {!esActiva && !hecha && (
          <button onClick={() => { sonar('blip', sonido); activar(quest.id); }} className="mt-3 w-full border border-ruta-xp bg-ruta-void p-3 font-pixel text-sm font-bold text-ruta-xp">
            {progreso.estado === 'reprogramada' ? '↻ REINTENTAR' : '▶ ACTIVAR MISIÓN'}
          </button>
        )}
        {esCustom && (
          <button onClick={publicar} className="mt-2 w-full border border-ruta-burocracia bg-ruta-void p-2.5 font-pixel text-xs text-ruta-burocracia">
            ⬆ COMPARTIR AL CATÁLOGO COMUNITARIO
          </button>
        )}
        {pubMsg && <div className="mt-2 font-pixel text-[11px] text-ruta-muted">{pubMsg}</div>}
      </div>

      <div className="border-2 border-ruta-line bg-ruta-panel p-4">
        <div className="font-pixel text-sm font-bold text-ruta-parchment">🎒 Inventario previo</div>
        <p className="mt-1 font-pixel text-[11px] leading-4 text-ruta-muted">No salgas sin marcar todo. En la calle ya no hay vuelta atrás.</p>
        {(quest.requisitos.items ?? []).map((itemId) => {
          const item = itemById.get(itemId);
          const marcado = !!progreso.checks[itemId];
          return (
            <button
              key={itemId}
              onClick={() => { sonar('blip', sonido); toggleCheck(quest.id, itemId); }}
              className={`mt-2 flex w-full items-center border p-3 text-left ${marcado ? 'border-ruta-xp bg-ruta-void' : 'border-ruta-line'}`}
            >
              <span className={`mr-3 flex h-5 w-5 items-center justify-center border ${marcado ? 'border-ruta-xp bg-ruta-xp' : 'border-ruta-muted'}`}>
                {marcado && <span className="font-pixel text-xs font-bold text-ruta-ink">✓</span>}
              </span>
              <span className="flex-1">
                <span className={`block font-pixel text-[13px] font-bold ${marcado ? 'text-ruta-xp' : 'text-ruta-parchment'}`}>{item?.nombre ?? itemId}</span>
                <span className="block font-pixel text-[11px] text-ruta-muted">{item?.descripcion}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-2 border-ruta-line bg-ruta-panel p-4">
        <div className="font-pixel text-sm font-bold text-ruta-parchment">Pasos de la misión</div>
        {quest.pasos.map((paso) => {
          const hecho = progreso.pasosCompletados.includes(paso.id);
          const esTurno = paso.orden === ordenActual && !hecha;
          return (
            <div key={paso.id} className={`mt-2 border p-3 ${hecho ? 'border-ruta-xp' : esTurno ? 'border-ruta-gold' : 'border-ruta-line'}`}>
              <div className="font-pixel text-[13px] font-bold text-ruta-parchment">
                {TIPO_ICONO[paso.tipo]} {paso.orden}. {paso.titulo} {hecho ? '✓' : ''}
              </div>
              <p className="mt-1 font-pixel text-xs leading-5 text-ruta-muted">{paso.detalle}</p>
              {!hecho && esTurno && (
                <div className="mt-2">
                  {paso.tipo === 'dialogo' && paso.dialogoId && buscarDialogo(paso.dialogoId) ? (
                    <button onClick={() => { sonar('blip', sonido); setDialogoAbierto(paso.dialogoId!); }} className="w-full border border-ruta-gold bg-ruta-void p-2.5 font-pixel text-xs font-bold text-ruta-gold">
                      💬 HABLAR
                    </button>
                  ) : (
                    <button onClick={() => { sonar('paso', sonido); completarPaso(quest.id, paso.id); }} className="w-full border border-ruta-line bg-ruta-void p-2.5 font-pixel text-xs font-bold text-ruta-parchment">
                      {paso.tipo === 'ir' ? '📍 YA LLEGUÉ' : '✓ MARCAR PASO'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!hecha && (
        <div className="border-2 border-ruta-line bg-ruta-panel p-4">
          <button
            onClick={() => { if (!todosPasos) return; completarMision(quest.id); const nivelAhora = usePlayerStore.getState().jugador.nivel; sonar(nivelAhora > nivelAntes ? 'nivel' : 'completar', sonido); }}
            disabled={!todosPasos}
            className={`w-full border p-3 font-pixel text-sm font-bold ${todosPasos ? 'border-ruta-gold bg-ruta-void text-ruta-gold' : 'border-ruta-line text-ruta-muted opacity-50'}`}
          >
            🏁 COMPLETAR MISIÓN (+{quest.recompensa.xp} XP)
          </button>
          <button onClick={() => { sonar('rescate', sonido); registrarRescate(quest.id); }} className="mt-3 w-full border border-ruta-valentia p-3 font-pixel text-xs font-bold text-ruta-valentia">
            🆘 FALLÓ POR CAUSA EXTERNA (+{quest.recompensaRescate?.xp ?? 0} XP parcial)
          </button>
          <p className="mt-2 text-center font-pixel text-[11px] leading-4 text-ruta-muted">
            Ej. “se cayó el sistema”. Registra el intento, cobra XP parcial y la misión se reprograma.
          </p>
        </div>
      )}
      {hecha && (
        <div className="border-2 border-ruta-gold bg-ruta-panel p-4 text-center font-pixel text-sm font-bold text-ruta-gold">
          ✓ MISIÓN COMPLETADA — revisa tu XP y atributos
        </div>
      )}

      {dialogoAbierto && buscarDialogo(dialogoAbierto) && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/70 p-4">
          <div className="w-full max-w-md">
            <DialogueBox
              nodoInicial={buscarDialogo(dialogoAbierto)!}
              onTerminar={() => {
                const paso = quest.pasos.find((p) => p.dialogoId === dialogoAbierto);
                if (paso) completarPaso(quest.id, paso.id);
                setDialogoAbierto(null);
              }}
            />
            <button onClick={() => setDialogoAbierto(null)} className="mt-2 w-full border border-ruta-line bg-ruta-panel p-3 font-pixel text-xs text-ruta-muted">
              Cerrar sin terminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
