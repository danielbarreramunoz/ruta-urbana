import { useEffect, useState } from 'react';
import DialogueBox from './DialogueBox';
import Hud from './Hud';
import { Sprite, uiSvg } from './sprites';
import { cosmeticById, itemById, preparaciones } from '../game/data';
import { publicarMision } from '../game/backend';
import { generarMisionSecundaria, type BriefMision } from '../game/generador';
import { sonar } from '../game/audio';
import BuscadorDireccion from './BuscadorDireccion';
import { formatoDistancia } from '../game/cercanas';
import { usePlayerPosition } from '../game/geo';
import { distanciaA } from '../game/proximity';
import { buscarDialogo, buscarQuest, listaMisiones, PROGRESO_VACIO, questConDestino, usePlayerStore, useQuestStore, useSettingsStore } from '../game/store';
import type { QuestCategory, QuestReward, QuestStep } from '../game/types';

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

/** Chips de recompensa: XP, paga en fichas, premio cosmético y atributos. */
function ChipsRecompensa({ recompensa }: { recompensa: QuestReward }) {
  const premio = recompensa.premio ? cosmeticById.get(recompensa.premio) : undefined;
  return (
    <>
      <span className="border border-ruta-gold px-1.5 py-0.5 font-pixel text-[9px] text-ruta-gold">+{recompensa.xp} XP</span>
      {!!recompensa.paga && (
        <span className="flex items-center gap-0.5 border border-ruta-line px-1.5 py-0.5 font-pixel text-[9px] text-ruta-gold">
          <Sprite svg={uiSvg('coins')} size={9} />+{recompensa.paga}
        </span>
      )}
      {premio && (
        <span className="border border-ruta-line px-1.5 py-0.5 font-pixel text-[9px] text-ruta-parchment">
          🎁 {premio.nombre}
        </span>
      )}
      {recompensa.atributos &&
        Object.entries(recompensa.atributos).map(([k, v]) => (
          <span key={k} className="border border-ruta-line px-1.5 py-0.5 font-pixel text-[9px] text-ruta-parchment">
            +{v} {k.slice(0, 3).toUpperCase()}
          </span>
        ))}
    </>
  );
}

export function MisionesTab({ onAbrir, crearAbierto, onCrearConsumido }: { onAbrir: (id: string) => void; crearAbierto?: boolean; onCrearConsumido?: () => void }) {
  const activar = useQuestStore((s) => s.activar);
  const progresos = useQuestStore((s) => s.progresos);
  const agregarCustom = useQuestStore((s) => s.agregarCustom);
  const misionActivaId = usePlayerStore((s) => s.jugador.misionActivaId);
  const secundariasActivas = usePlayerStore((s) => s.jugador.secundariasActivas);
  const activasIds = [...new Set([...(misionActivaId ? [misionActivaId] : []), ...secundariasActivas])];
  const sonido = useSettingsStore((s) => s.sonido);
  const { efectiva } = usePlayerPosition();
  const [creando, setCreando] = useState(!!crearAbierto);
  const [aviso, setAviso] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [lugar, setLugar] = useState('');
  const [categoria, setCategoria] = useState<QuestCategory>('secundaria');
  // Llegada desde el mapa ("Crear misión aquí"): abre el generador una vez.
  useEffect(() => {
    if (crearAbierto) {
      setCreando(true);
      onCrearConsumido?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crearAbierto]);
  const todas = listaMisiones();

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

  /** Activa y avisa si ya hay 2 secundarias en curso. */  const activarConAviso = (id: string) => {
    const r = activar(id);
    if (r === 'limite') {
      setAviso('Ya tienes 2 secundarias activas · termina o cancela una primero');
      sonar('blip', sonido);
    } else {
      setAviso(null);
    }
    return r;
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

      {aviso && (
        <div className="px-frame border-ruta-valentia px-2 py-1.5 font-pixel text-[10px] leading-4 text-ruta-valentia" role="status">
          {aviso}
        </div>
      )}

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
            Se ancla ~150 m de tu posición actual (caminata corta) y se valida igual que el catálogo oficial.
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

      {todas.length === 0 && (
        <div className="px-frame border-dashed p-3">
          <div className="font-pixel text-sm font-bold text-ruta-parchment">Sin misiones principales</div>
          <p className="mt-1 font-pixel text-[10px] leading-4 text-ruta-muted">
            Omitiste el cuestionario inicial, así que no se activan misiones automáticas.
            Entra al mapa y toca un pin para elegir una principal, o crea una secundaria aquí.
          </p>
          <button onClick={() => setCreando(true)} className="px-btn mt-2 w-full py-2 font-pixel text-[10px] font-bold text-ruta-burocracia">
            + CREAR MISIÓN SECUNDARIA
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
        const esActiva = activasIds.includes(q.id);
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

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <ChipsRecompensa recompensa={q.recompensa} />
                <span className="ml-auto font-pixel text-[9px] text-ruta-muted">
                  {pasosHechos}/{q.pasos.length} pasos
                </span>
              </div>

              {!hecha && !esActiva && (
                <button
                  onClick={() => {
                    sonar('blip', sonido);
                    // Dirección o preparación pendiente: primero se resuelve en el detalle.
                    const faltaPrep = !prog?.preparada && !!preparaciones[q.categoria];
                    if ((q.pideDireccion && !prog?.destinoCustom) || faltaPrep) onAbrir(q.id);
                    else {
                      activarConAviso(q.id);
                      onAbrir(q.id);
                    }
                  }}
                  className="px-btn px-btn--xp mt-2.5 w-full py-2 font-pixel text-[11px] font-bold"
                >
                  {q.pideDireccion && !prog?.destinoCustom
                    ? '📍 ELEGIR DIRECCIÓN'
                    : !prog?.preparada && preparaciones[q.categoria]
                      ? '🧭 PREPARARME'
                      : estado === 'reprogramada' ? '↻ REINTENTAR MISIÓN' : '▶ ACTIVAR MISIÓN'}
                </button>
              )}
              {!hecha && esActiva && (
                <div className="mt-2.5 flex gap-2">
                  <button onClick={() => onAbrir(q.id)} className="px-btn px-btn--on min-w-0 flex-1 py-2 font-pixel text-[11px] font-bold">
                    CONTINUAR →
                  </button>
                  <button
                    onClick={() => {
                      useQuestStore.getState().cancelarMision(q.id);
                      sonar('blip', sonido);
                    }}
                    title="Cancelar misión"
                    aria-label="Cancelar misión"
                    className="px-btn flex-none px-2.5 py-2 font-pixel text-[10px] text-ruta-muted"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function QuestDetail({ questId, onVolver }: { questId: string; onVolver: () => void }) {
  const questBase = buscarQuest(questId);
  const progresos = useQuestStore((s) => s.progresos);
  const progreso = progresos[questId] ?? PROGRESO_VACIO;
  // Destino del jugador aplicado: el paso `ir`, los pines y el radio usan esto.
  const quest = questBase ? questConDestino(questBase, progreso) : undefined;
  const activar = useQuestStore((s) => s.activar);
  const cancelarMision = useQuestStore((s) => s.cancelarMision);
  const fijarDestino = useQuestStore((s) => s.fijarDestino);
  const togglePreparacion = useQuestStore((s) => s.togglePreparacion);
  const marcarPreparada = useQuestStore((s) => s.marcarPreparada);
  const toggleCheck = useQuestStore((s) => s.toggleCheck);
  const completarPaso = useQuestStore((s) => s.completarPaso);
  const completarMision = useQuestStore((s) => s.completarMision);
  const registrarRescate = useQuestStore((s) => s.registrarRescate);
  const misionActivaId = usePlayerStore((s) => s.jugador.misionActivaId);
  const { efectiva } = usePlayerPosition();
  const [dialogoAbierto, setDialogoAbierto] = useState<string | null>(null);
  const [pubMsg, setPubMsg] = useState<string | null>(null);
  const [verGuia, setVerGuia] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [avisoActivacion, setAvisoActivacion] = useState<string | null>(null);
  const [mostrarBuscador, setMostrarBuscador] = useState(
    () => !!questBase?.pideDireccion && !progreso.destinoCustom,
  );
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

  /** Destino vigente (del catálogo o puesto por el jugador). */
  const pasoIr = quest.pasos.find((p) => p.tipo === 'ir' && p.destinoId);
  const destinoLoc = pasoIr?.destinoId
    ? quest.ubicaciones.find((u) => u.id === pasoIr.destinoId)
    : quest.ubicaciones[0];
  const distDestino = destinoLoc ? Math.round(distanciaA(efectiva, destinoLoc)) : null;
  const faltaDireccion = !!quest.pideDireccion && !progreso.destinoCustom;

  /** Guía de preparación por tipo de lugar o categoría + respuestas del jugador. */
  const plantilla = preparaciones[quest.preparacionClave ?? ''] ?? preparaciones[quest.categoria];
  const preparacion = progreso.preparacion ?? {};
  const preparada = !!progreso.preparada;
  const mostrarPreparacion = !hecha && !!plantilla && (!preparada || verGuia);
  /** Listo para activar: preparación cerrada (y dirección, si la misión la pide). */
  const puedeActivar = !faltaDireccion && (preparada || !plantilla || progreso.estado === 'activa');

  /** Botón del paso: "Ya llegué" solo se habilita dentro del radio del destino. */
  const botonPaso = (paso: QuestStep) => {
    const loc = paso.destinoId ? quest.ubicaciones.find((u) => u.id === paso.destinoId) : undefined;
    const dist = loc ? Math.round(distanciaA(efectiva, loc)) : null;
    const dentro = !loc || (dist ?? 0) <= loc.radioM;
    const bloqueado = paso.tipo === 'ir' && !dentro;
    return (
      <>
        <button
          onClick={() => {
            sonar('paso', sonido);
            completarPaso(quest.id, paso.id);
          }}
          disabled={bloqueado}
          className={`px-btn w-full py-2 font-pixel text-[11px] font-bold ${bloqueado ? 'text-ruta-muted opacity-45' : 'text-ruta-parchment'}`}
        >
          {paso.tipo !== 'ir' ? 'MARCAR PASO' : bloqueado ? `A ${dist} M · ACÉRCATE` : '📍 YA LLEGUÉ'}
        </button>
        {bloqueado && loc && (
          <p className="mt-1 text-center font-pixel text-[9px] leading-3 text-ruta-muted">
            Se activa dentro de {loc.nombre} ({loc.radioM} m).
          </p>
        )}
      </>
    );
  };

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
            <ChipsRecompensa recompensa={quest.recompensa} />
            <span className="border border-ruta-line px-1.5 py-0.5 font-pixel text-[9px] text-ruta-muted">
              Nv. {quest.nivelMinimo}+
            </span>
          </div>

          {!esActiva && !hecha && (
            puedeActivar ? (
              <button
                onClick={() => {
                  sonar('blip', sonido);
                  const r = activar(quest.id);
                  if (r === 'limite') setAvisoActivacion('Ya tienes 2 secundarias activas · termina o cancela una primero');
                  else setAvisoActivacion(null);
                }}
                className="px-btn px-btn--xp mt-2.5 w-full py-2.5 font-pixel text-xs font-bold"
              >
                {progreso.estado === 'reprogramada' ? '↻ REINTENTAR' : '▶ ACTIVAR MISIÓN'}
              </button>
            ) : (
              <p className="mt-2.5 border border-ruta-line px-2 py-1.5 text-center font-pixel text-[10px] leading-4 text-ruta-gold">
                {faltaDireccion ? 'Elige tu dirección para activar ↓' : 'Completa la preparación para activar ↓'}
              </p>
            )
          )}
          {avisoActivacion && (
            <div className="mt-2 border border-ruta-valentia px-2 py-1.5 font-pixel text-[10px] leading-4 text-ruta-valentia" role="status">
              {avisoActivacion}
            </div>
          )}
          {esActiva && !hecha && (
            <button
              onClick={() => {
                if (!confirmarCancelar) {
                  setConfirmarCancelar(true);
                  return;
                }
                cancelarMision(quest.id);
                setConfirmarCancelar(false);
                sonar('blip', sonido);
                onVolver();
              }}
              className={`px-btn mt-2 w-full py-2 font-pixel text-[10px] font-bold ${confirmarCancelar ? 'px-btn--danger' : 'text-ruta-muted'}`}
            >
              {confirmarCancelar ? '¿CANCELAR? TOCA OTRA VEZ' : '✕ CANCELAR MISIÓN'}
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

      {/* Preparación previa: ayuda a saber qué pedir sin ponerse nervioso/a */}
      {mostrarPreparacion && plantilla && (
        <div className="px-frame p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-pixel text-sm font-bold text-ruta-parchment">🧭 Prepárate</span>
            <span className="font-pixel text-[9px] text-ruta-muted">
              {plantilla.preguntas.filter((p) => preparacion[p.id]).length}/{plantilla.preguntas.length}
            </span>
          </div>
          <p className="mt-1 font-pixel text-[10px] leading-4 text-ruta-muted">{plantilla.intro}</p>

          <div className="mt-2 space-y-1">
            {plantilla.preguntas.map((p) => {
              const marcado = !!preparacion[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => { sonar('blip', sonido); togglePreparacion(quest.id, p.id); }}
                  aria-pressed={marcado}
                  className={`flex w-full items-start gap-2 border px-2 py-1.5 text-left font-pixel text-[10px] leading-4 ${
                    marcado ? 'border-ruta-xp text-ruta-parchment' : 'border-ruta-line text-ruta-muted'
                  }`}
                >
                  <span className={`mt-[1px] flex h-4 w-4 flex-none items-center justify-center border ${marcado ? 'border-ruta-xp bg-ruta-xp text-ruta-void' : 'border-ruta-line'}`}>
                    {marcado ? '✓' : ''}
                  </span>
                  <span>{p.texto}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-ruta-line pt-2">
            <div className="font-pixel text-[9px] tracking-widest text-ruta-gold">QUÉ DECIR</div>
            <ul className="mt-1 space-y-1">
              {plantilla.guion.map((g) => (
                <li key={g} className="font-pixel text-[10px] leading-4 text-ruta-parchment">
                  <span className="text-ruta-gold">›</span> {g}
                </li>
              ))}
            </ul>
          </div>

          {plantilla.consejo && (
            <p className="mt-2 border-l-2 border-ruta-burocracia pl-2 font-pixel text-[10px] leading-4 text-ruta-muted">
              {plantilla.consejo}
            </p>
          )}

          <button
            onClick={() => {
              marcarPreparada(quest.id);
              sonar('check', sonido);
              if (faltaDireccion) setMostrarBuscador(true);
            }}
            className="px-btn px-btn--xp mt-2.5 w-full py-2.5 font-pixel text-xs font-bold"
          >
            ✅ ESTOY LISTO/A
          </button>
          <p className="mt-1 text-center font-pixel text-[9px] leading-3 text-ruta-muted">
            Puedes volver a leer esto cuando quieras.
          </p>
        </div>
      )}
      {!mostrarPreparacion && !hecha && plantilla && preparada && (
        <button
          onClick={() => setVerGuia(true)}
          className="px-btn w-full py-2 font-pixel text-[10px] text-ruta-burocracia"
        >
          🧭 REVISAR GUÍA DE PREPARACIÓN
        </button>
      )}

      {/* Destino: se puede cambiar buscando una dirección en el mapa real */}
      <div className="px-frame p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-pixel text-sm font-bold text-ruta-parchment">📍 Destino</span>
          {distDestino != null && (
            <span className="font-pixel text-[10px] font-bold text-ruta-xp">{formatoDistancia(distDestino)}</span>
          )}
        </div>
        {destinoLoc ? (
          <p className="mt-1 break-words font-pixel text-[11px] leading-4 text-ruta-muted">
            {destinoLoc.nombre}
            {progreso.destinoCustom && <span className="text-ruta-gold"> · tu punto</span>}
            {` · radio ${destinoLoc.radioM} m`}
          </p>
        ) : faltaDireccion ? (
          <p className="mt-1 font-pixel text-[11px] leading-4 text-ruta-gold">
            Esta misión necesita tu dirección para activar.
          </p>
        ) : null}
        {!mostrarBuscador ? (
          <button
            onClick={() => { sonar('blip', sonido); setMostrarBuscador(true); }}
            className="px-btn mt-2 w-full py-2 font-pixel text-[10px] font-bold text-ruta-burocracia"
          >
            {destinoLoc ? 'CAMBIAR DIRECCIÓN' : 'BUSCAR DIRECCIÓN'}
          </button>
        ) : (
          <div className="mt-2">
            <BuscadorDireccion
              pos={efectiva}
              onElegir={(r) => {
                fijarDestino(quest.id, { nombre: r.nombre, latitud: r.lat, longitud: r.lng });
                setMostrarBuscador(false);
                sonar('check', sonido);
              }}
            />
            <button
              onClick={() => setMostrarBuscador(false)}
              className="px-btn mt-1.5 w-full py-1.5 font-pixel text-[10px] text-ruta-muted"
            >
              CANCELAR
            </button>
          </div>
        )}
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
                        botonPaso(paso)
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
              sonar('completar', sonido);
            }}
            disabled={!todosPasos}
            className={`px-btn w-full py-3 font-pixel text-xs font-bold ${todosPasos ? 'px-btn--on' : 'text-ruta-muted opacity-45'}`}
          >
            🏁 COMPLETAR (+{quest.recompensa.xp} XP
            {quest.recompensa.paga ? ` · +${quest.recompensa.paga} fichas` : ''})
          </button>
          {esActiva && (
            <>
              <button
                onClick={() => { sonar('rescate', sonido); registrarRescate(quest.id); }}
                className="px-btn px-btn--danger mt-2 w-full py-2.5 font-pixel text-[11px] font-bold"
              >
                🆘 FALLÓ POR CAUSA EXTERNA (+{quest.recompensaRescate?.xp ?? 0} XP
                {quest.recompensaRescate?.paga ? ` · +${quest.recompensaRescate.paga} fichas` : ''})
              </button>
              <p className="mt-1.5 text-center font-pixel text-[9px] leading-3 text-ruta-muted">
                “Se cayó el sistema”: cobra XP parcial y la misión queda reprogramada.
              </p>
            </>
          )}
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
