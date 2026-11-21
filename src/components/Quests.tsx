import { useState } from 'react';
import DialogueBox from './DialogueBox';
import Hud from './Hud';
import { itemById, quests } from '../game/data';
import { publicarMision } from '../game/backend';
import { generarMisionSecundaria, type BriefMision } from '../game/generador';
import { sonar } from '../game/audio';
import { usePlayerPosition } from '../game/geo';
import { buscarDialogo, buscarQuest, PROGRESO_VACIO, usePlayerStore, useQuestStore, useSettingsStore } from '../game/store';
import type { QuestCategory, QuestStep } from '../game/types';

const CATEGORIA: Record<string, { icono: string; label: string }> = {
  tramite: { icono: '📋', label: 'TRÁMITE' },
  salud: { icono: '💊', label: 'SALUD' },
  trabajo: { icono: '💼', label: 'TRABAJO' },
  hogar: { icono: '🏠', label: 'HOGAR' },
  secundaria: { icono: '⭐', label: 'SECUNDARIA' },
};

const ESTADO: Record<string, { label: string; color: string; borde: string }> = {
  disponible: { label: 'DISPONIBLE', color: 'text-ruta-muted', borde: 'border-ruta-line' },
  activa: { label: '▶ ACTIVA', color: 'text-ruta-gold', borde: 'border-ruta-gold' },
  completada: { label: '✓ COMPLETADA', color: 'text-ruta-xp', borde: 'border-ruta-xp' },
  fallida: { label: '✗ FALLIDA', color: 'text-ruta-valentia', borde: 'border-ruta-valentia' },
  reprogramada: { label: '↻ REPROGRAMADA', color: 'text-ruta-burocracia', borde: 'border-ruta-burocracia' },
};

const TIPO_ICONO: Record<QuestStep['tipo'], string> = {
  preparacion: '🎒',
  ir: '📍',
  dialogo: '💬',
  accion: '✓',
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

  const hechas = todas.filter((q) => progresos[q.id]?.estado === 'completada').length;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-pixel text-[10px] tracking-[0.2em] text-ruta-muted">RUTA URBANA</div>
          <h1 className="font-pixel text-xl font-bold text-ruta-parchment">MISIONES</h1>
        </div>
        <div className="border border-ruta-line bg-ruta-panel px-2 py-1 font-pixel text-[10px] text-ruta-gold">
          {hechas}/{todas.length} ✓
        </div>
      </div>

      <Hud />

      <button
        onClick={() => setCreando((v) => !v)}
        className={`px-btn w-full py-2.5 font-pixel text-[11px] font-bold ${creando ? 'px-btn--on' : 'text-ruta-burocracia'}`}
        style={{ borderColor: creando ? undefined : '#3D6FC4' }}
      >
        {creando ? '✕ CERRAR GENERADOR' : '+ CREAR MISIÓN SECUNDARIA'}
      </button>

      {creando && (
        <div className="px-frame space-y-2 p-3">
          <div className="font-pixel text-[10px] leading-4 text-ruta-muted">
            Se ancla en tu posición actual y se valida igual que el catálogo oficial.
          </div>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (ej. Pagar la luz)"
            className="w-full border-2 border-ruta-line bg-ruta-void p-2 font-pixel text-sm text-ruta-parchment placeholder:text-ruta-muted focus:border-ruta-burocracia focus:outline-none"
          />
          <input
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            placeholder="Lugar (ej. Caja vecina)"
            className="w-full border-2 border-ruta-line bg-ruta-void p-2 font-pixel text-sm text-ruta-parchment placeholder:text-ruta-muted focus:border-ruta-burocracia focus:outline-none"
          />
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as QuestCategory)}
            className="w-full border-2 border-ruta-line bg-ruta-void p-2 font-pixel text-sm text-ruta-parchment focus:outline-none"
          >
            <option value="secundaria">⭐ Secundaria</option>
            <option value="tramite">📋 Trámite</option>
            <option value="salud">💊 Salud</option>
            <option value="trabajo">💼 Trabajo</option>
            <option value="hogar">🏠 Hogar</option>
          </select>
          <button
            onClick={crear}
            disabled={titulo.trim().length < 4 || lugar.trim().length < 3}
            className="px-btn px-btn--xp w-full py-2.5 font-pixel text-xs font-bold disabled:opacity-40"
          >
            GENERAR MISIÓN
          </button>
        </div>
      )}

      {todas.map((q) => {
        const prog = progresos[q.id];
        const estado = prog?.estado ?? q.estado;
        const meta = ESTADO[estado];
        const hecha = estado === 'completada';
        const pasosHechos = prog?.pasosCompletados.length ?? 0;
        const pct = Math.round((pasosHechos / q.pasos.length) * 100);
        const esActiva = misionActivaId === q.id;
        const cat = CATEGORIA[q.categoria];
        return (
          <div key={q.id} className={`px-frame ${esActiva ? 'px-frame--gold' : ''}`}>
            <div className={`h-1 w-full ${esActiva ? 'bg-ruta-gold' : hecha ? 'bg-ruta-xp' : 'bg-ruta-line'}`} />
            <div className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-pixel text-[9px] tracking-widest text-ruta-muted">
                  {cat.icono} {cat.label}
                </span>
                <span className={`font-pixel text-[9px] font-bold ${meta.color}`}>{meta.label}</span>
              </div>

              <button onClick={() => onAbrir(q.id)} className="mt-1 block w-full text-left">
                <span className="font-pixel text-[15px] font-bold leading-5 text-ruta-parchment">{q.titulo}</span>
              </button>
              <p className="mt-1 line-clamp-2 font-pixel text-[11px] leading-4 text-ruta-muted">{q.descripcion}</p>

              <div className="mt-2 flex items-center gap-2">
                <div className="flex flex-1 gap-[2px]">
                  {q.pasos.map((p) => (
                    <span
                      key={p.id}
                      className={`h-1.5 flex-1 ${prog?.pasosCompletados.includes(p.id) ? 'bg-ruta-xp' : 'bg-ruta-line'}`}
                    />
                  ))}
                </div>
                <span className="flex-none font-pixel text-[9px] text-ruta-muted">{pct}%</span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="border border-ruta-line px-1.5 py-0.5 font-pixel text-[9px] text-ruta-gold">+{q.recompensa.xp} XP</span>
                {q.recompensa.atributos &&
                  Object.entries(q.recompensa.atributos).map(([k, v]) => (
                    <span key={k} className="border border-ruta-line px-1.5 py-0.5 font-pixel text-[9px] text-ruta-parchment">
                      +{v} {k.slice(0, 3).toUpperCase()}
                    </span>
                  ))}
                <span className="ml-auto font-pixel text-[9px] text-ruta-muted">
                  {pasosHechos}/{q.pasos.length} pasos
                </span>
              </div>

              {!hecha && !esActiva && (
                <button
                  onClick={() => { sonar('blip', sonido); activar(q.id); onAbrir(q.id); }}
                  className="px-btn px-btn--xp mt-2.5 w-full py-2 font-pixel text-[11px] font-bold"
                >
                  {estado === 'reprogramada' ? '↻ REINTENTAR MISIÓN' : '▶ ACTIVAR MISIÓN'}
                </button>
              )}
              {!hecha && esActiva && (
                <button onClick={() => onAbrir(q.id)} className="px-btn px-btn--on mt-2.5 w-full py-2 font-pixel text-[11px] font-bold">
                  CONTINUAR →
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function QuestDetail({ questId, onVolver }: { questId: string; onVolver: () => void }) {
  const quest = buscarQuest(questId);
  const progresos = useQuestStore((s) => s.progresos);
  const progreso = progresos[questId] ?? PROGRESO_VACIO;
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
  const cat = CATEGORIA[quest.categoria];
  const checksListos = (quest.requisitos.items ?? []).every((i) => progreso.checks[i]);

  return (
    <div className="space-y-3">
      <button onClick={onVolver} className="px-btn px-2.5 py-1 font-pixel text-[10px] text-ruta-muted">
        ← MISIONES
      </button>

      <Hud />

      {/* Cabecera de misión */}
      <div className={`px-frame ${esActiva ? 'px-frame--gold' : ''}`}>
        <div className={`h-1 w-full ${esActiva ? 'bg-ruta-gold' : hecha ? 'bg-ruta-xp' : 'bg-ruta-line'}`} />
        <div className="p-3">
          <div className="flex items-center justify-between">
            <span className="font-pixel text-[9px] tracking-widest text-ruta-muted">
              {cat.icono} {cat.label}
            </span>
            <span className={`font-pixel text-[9px] font-bold ${ESTADO[progreso.estado].color}`}>
              {ESTADO[progreso.estado].label}
            </span>
          </div>
          <h1 className="mt-1 font-pixel text-xl font-bold leading-6 text-ruta-parchment">{quest.titulo}</h1>
          <p className="mt-1 font-pixel text-[12px] leading-5 text-ruta-muted">{quest.descripcion}</p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="border border-ruta-gold px-1.5 py-0.5 font-pixel text-[9px] text-ruta-gold">
              +{quest.recompensa.xp} XP
            </span>
            {quest.recompensa.atributos &&
              Object.entries(quest.recompensa.atributos).map(([k, v]) => (
                <span key={k} className="border border-ruta-line px-1.5 py-0.5 font-pixel text-[9px] text-ruta-parchment">
                  +{v} {k.slice(0, 3).toUpperCase()}
                </span>
              ))}
            <span className="border border-ruta-line px-1.5 py-0.5 font-pixel text-[9px] text-ruta-muted">
              Nv. {quest.nivelMinimo}+
            </span>
          </div>

          {!esActiva && !hecha && (
            <button
              onClick={() => { sonar('blip', sonido); activar(quest.id); }}
              className="px-btn px-btn--xp mt-2.5 w-full py-2.5 font-pixel text-xs font-bold"
            >
              {progreso.estado === 'reprogramada' ? '↻ REINTENTAR' : '▶ ACTIVAR MISIÓN'}
            </button>
          )}
          {esCustom && (
            <button onClick={publicar} className="px-btn mt-2 w-full py-2 font-pixel text-[10px] text-ruta-burocracia">
              ⬆ COMPARTIR AL CATÁLOGO
            </button>
          )}
          {pubMsg && <div className="mt-2 font-pixel text-[10px] text-ruta-muted">{pubMsg}</div>}
        </div>
      </div>

      {/* Checklist previo */}
      <div className="px-frame p-3">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-sm font-bold text-ruta-parchment">🎒 Inventario previo</span>
          <span className={`font-pixel text-[9px] ${checksListos ? 'text-ruta-xp' : 'text-ruta-muted'}`}>
            {checksListos ? 'LISTO' : 'PENDIENTE'}
          </span>
        </div>
        <p className="mt-1 font-pixel text-[10px] leading-4 text-ruta-muted">Márcalo antes de salir. En la calle no hay vuelta atrás.</p>
        {(quest.requisitos.items ?? []).map((itemId) => {
          const item = itemById.get(itemId);
          const marcado = !!progreso.checks[itemId];
          return (
            <button
              key={itemId}
              onClick={() => { sonar('blip', sonido); toggleCheck(quest.id, itemId); }}
              className={`px-btn mt-2 flex w-full items-center gap-2.5 p-2.5 text-left ${marcado ? 'px-btn--xp border-ruta-xp' : ''}`}
            >
              <span className={`flex h-5 w-5 flex-none items-center justify-center border-2 ${marcado ? 'border-ruta-xp bg-ruta-xp' : 'border-ruta-muted bg-[#08080e]'}`}>
                {marcado && <span className="font-pixel text-[11px] font-bold text-ruta-ink">✓</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-pixel text-[12px] font-bold ${marcado ? 'text-ruta-xp' : 'text-ruta-parchment'}`}>
                  {item?.nombre ?? itemId}
                </span>
                <span className="block font-pixel text-[10px] leading-4 text-ruta-muted">{item?.descripcion}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Pasos como línea de tiempo */}
      <div className="px-frame p-3">
        <span className="font-pixel text-sm font-bold text-ruta-parchment">Ruta de la misión</span>
        <div className="mt-2">
          {quest.pasos.map((paso, i) => {
            const hecho = progreso.pasosCompletados.includes(paso.id);
            const esTurno = paso.orden === ordenActual && !hecha;
            return (
              <div key={paso.id} className="relative flex gap-2.5 pb-3 last:pb-0">
                {i < quest.pasos.length - 1 && (
                  <span className={`absolute bottom-0 left-[13px] top-7 w-[2px] ${hecho ? 'bg-ruta-xp' : 'bg-ruta-line'}`} />
                )}
                <span
                  className={`relative z-10 flex h-7 w-7 flex-none items-center justify-center border-2 font-pixel text-[10px] font-bold ${
                    hecho
                      ? 'border-ruta-xp bg-ruta-xp text-ruta-ink'
                      : esTurno
                        ? 'border-ruta-gold bg-ruta-void text-ruta-gold'
                        : 'border-ruta-line bg-ruta-void text-ruta-muted'
                  }`}
                >
                  {hecho ? '✓' : paso.orden}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`font-pixel text-[12px] font-bold ${esTurno ? 'text-ruta-gold' : hecho ? 'text-ruta-xp' : 'text-ruta-parchment'}`}>
                    {TIPO_ICONO[paso.tipo]} {paso.titulo}
                  </div>
                  <p className="mt-0.5 font-pixel text-[10px] leading-4 text-ruta-muted">{paso.detalle}</p>
                  {!hecho && esTurno && (
                    <div className="mt-1.5">
                      {paso.tipo === 'dialogo' && paso.dialogoId && buscarDialogo(paso.dialogoId) ? (
                        <button
                          onClick={() => { sonar('blip', sonido); setDialogoAbierto(paso.dialogoId!); }}
                          className="px-btn px-btn--on w-full py-2 font-pixel text-[11px] font-bold"
                        >
                          💬 HABLAR
                        </button>
                      ) : (
                        <button
                          onClick={() => { sonar('paso', sonido); completarPaso(quest.id, paso.id); }}
                          className="px-btn w-full py-2 font-pixel text-[11px] font-bold text-ruta-parchment"
                        >
                          {paso.tipo === 'ir' ? '📍 YA LLEGUÉ' : 'MARCAR PASO'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cierre */}
      {!hecha && (
        <div className="px-frame p-3">
          <button
            onClick={() => {
              if (!todosPasos) return;
              completarMision(quest.id);
              const nivelAhora = usePlayerStore.getState().jugador.nivel;
              sonar(nivelAhora > nivelAntes ? 'nivel' : 'completar', sonido);
            }}
            disabled={!todosPasos}
            className={`px-btn w-full py-3 font-pixel text-xs font-bold ${todosPasos ? 'px-btn--on' : 'text-ruta-muted opacity-45'}`}
          >
            🏁 COMPLETAR (+{quest.recompensa.xp} XP)
          </button>
          <button
            onClick={() => { sonar('rescate', sonido); registrarRescate(quest.id); }}
            className="px-btn px-btn--danger mt-2 w-full py-2.5 font-pixel text-[11px] font-bold"
          >
            🆘 FALLÓ POR CAUSA EXTERNA (+{quest.recompensaRescate?.xp ?? 0} XP)
          </button>
          <p className="mt-1.5 text-center font-pixel text-[9px] leading-3 text-ruta-muted">
            “Se cayó el sistema”: cobra XP parcial y la misión queda reprogramada.
          </p>
        </div>
      )}

      {hecha && (
        <div className="px-frame px-frame--gold p-3 text-center font-pixel text-xs font-bold text-ruta-gold">
          ✓ MISIÓN COMPLETADA
        </div>
      )}

      {/* Modal diálogo */}
      {dialogoAbierto && buscarDialogo(dialogoAbierto) && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/75 p-3">
          <div className="w-full max-w-md">
            <DialogueBox
              nodoInicial={buscarDialogo(dialogoAbierto)!}
              onTerminar={() => {
                const paso = quest.pasos.find((p) => p.dialogoId === dialogoAbierto);
                if (paso) completarPaso(quest.id, paso.id);
                setDialogoAbierto(null);
              }}
            />
            <button onClick={() => setDialogoAbierto(null)} className="px-btn mt-2 w-full py-2 font-pixel text-[10px] text-ruta-muted">
              Cerrar sin terminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
