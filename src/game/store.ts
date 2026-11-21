import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { EQUIPADO_INICIAL, alternarPrenda, estaDesbloqueado, esPropio } from './cosmetics';
import { cosmeticById, questById } from './data';
import { cellsAround, xpPorCeldas } from './fog';
import type { Ambiente, TemaMapa } from './ambiente';
import type { Atributos, CosmeticSlot, DialogueNode, Jugador, Quest, QuestStatus, Sexo } from './types';

const XP_BASE = 100;
export const xpParaNivel = (nivel: number) => Math.round(XP_BASE * Math.pow(1.35, nivel - 1));

/**
 * localStorage con escritura diferida (~800 ms).
 * Caminar mantenido mueve el mock 10 veces por segundo; serializar el arreglo
 * `visited` (hasta 8000 celdas) en cada paso congelaba el mapa en móviles.
 * El volcado final se fuerza en `pagehide`/`visibilitychange`.
 */
function storageDiferido(ms = 800) {
  let timer: number | undefined;
  let pendiente: [string, string] | null = null;
  const volcar = () => {
    clearTimeout(timer);
    if (!pendiente) return;
    const [clave, valor] = pendiente;
    pendiente = null;
    try {
      localStorage.setItem(clave, valor);
    } catch {
      /* cuota llena: se pierde el último volcado, no la partida en curso */
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', volcar);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') volcar();
    });
  }
  return {
    getItem: (name: string) => localStorage.getItem(name),
    setItem: (name: string, value: string) => {
      pendiente = [name, value];
      clearTimeout(timer);
      timer = setTimeout(volcar, ms);
    },
    removeItem: (name: string) => localStorage.removeItem(name),
  };
}

const jugadorInicial = (nombre = 'Viajero'): Jugador => ({
  id: 'jugador-local',
  nombre,
  sexo: 'm',
  nivel: 1,
  xp: 0,
  xpParaSiguienteNivel: xpParaNivel(1),
  atributos: { carisma: 1, valentia: 1, burocracia: 1, supervivencia: 1 },
  fichas: 0,
  cosmeticos: [],
  equipado: { ...EQUIPADO_INICIAL },
  misionActivaId: null,
  misionesCompletadas: [],
  misionesFallidas: [],
  updatedAt: new Date().toISOString(),
});

/**
 * Rellena campos nuevos sobre datos persistidos viejos (localStorage).
 * Sin esto, `fichas`/`cosmeticos` llegarían `undefined` y romperían la UI.
 */
function normalizarJugador(guardado: (Partial<Jugador> & { monedas?: number }) | undefined): Jugador {
  const base = jugadorInicial(guardado?.nombre);
  return {
    ...base,
    ...guardado,
    atributos: { ...base.atributos, ...(guardado?.atributos ?? {}) },
    sexo: guardado?.sexo === 'f' ? 'f' : 'm',
    // Compatibilidad: la primera versión guardó la moneda como `monedas`.
    fichas: guardado?.fichas ?? guardado?.monedas ?? 0,
    cosmeticos: guardado?.cosmeticos ?? [],
    equipado: { ...EQUIPADO_INICIAL, ...(guardado?.equipado ?? {}) },
    misionesCompletadas: guardado?.misionesCompletadas ?? [],
    misionesFallidas: guardado?.misionesFallidas ?? [],
  };
}

function mezclar(base: Atributos, extra?: Partial<Atributos>): Atributos {
  if (!extra) return base;
  return {
    carisma: base.carisma + (extra.carisma ?? 0),
    valentia: base.valentia + (extra.valentia ?? 0),
    burocracia: base.burocracia + (extra.burocracia ?? 0),
    supervivencia: base.supervivencia + (extra.supervivencia ?? 0),
  };
}

/** Resultado de intentar comprar en la tienda. */
export type ResultadoCompra = 'ok' | 'ya-tienes' | 'sin-fichas' | 'bloqueado' | 'no-existe';

interface PlayerState {
  jugador: Jugador;
  ganarXP: (cantidad: number, atributos?: Partial<Atributos>) => void;
  /** Suma (o resta con signo negativo) fichas. Nunca baja de 0. */
  ganarFichas: (cantidad: number) => void;
  /** Entrega un cosmético sin cobrar (premio de misión). */
  otorgarCosmetico: (id: string) => void;
  comprarCosmetico: (id: string) => ResultadoCompra;
  /** Pone o quita la prenda (toggle) si es propia. */
  equiparCosmetico: (id: string) => void;
  desequiparSlot: (slot: CosmeticSlot) => void;
  /** Cambia el nombre del jugador (recorta a 24 caracteres). */
  renombrar: (nombre: string) => void;
  /** Cambia la silueta del avatar. */
  cambiarSexo: (sexo: Sexo) => void;
  /** Borra el progreso de misiones del jugador, sin tocar nivel/fichas/cosméticos. */
  limpiarMisiones: () => void;
  fijarMisionActiva: (questId: string | null) => void;
  registrarMision: (questId: string, exito: boolean) => void;
  /** Reemplaza el progreso local por uno remoto más nuevo (last-write-wins). */
  aplicarPerfilRemoto: (p: {
    nombre: string;
    nivel: number;
    xp: number;
    xpParaSiguienteNivel: number;
    atributos: Atributos;
    misionesCompletadas: string[];
    misionesFallidas: string[];
    updatedAt: string;
  }) => void;
  reiniciar: (nombre?: string) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      jugador: jugadorInicial(),
      ganarXP: (cantidad, atributos) => {
        const antes = get().jugador;
        let { xp, nivel, xpParaSiguienteNivel } = antes;
        xp += cantidad;
        while (xp >= xpParaSiguienteNivel) {
          xp -= xpParaSiguienteNivel;
          nivel += 1;
          xpParaSiguienteNivel = xpParaNivel(nivel);
        }
        set({
          jugador: {
            ...antes,
            xp,
            nivel,
            xpParaSiguienteNivel,
            atributos: { ...antes.atributos, ...mezclar(antes.atributos, atributos) },
            updatedAt: new Date().toISOString(),
          },
        });
        // Aviso efímero para la animación de XP / subida de nivel.
        useFxStore.getState().anunciarXp(cantidad, nivel > antes.nivel ? nivel : null);
      },
      ganarFichas: (cantidad) =>
        set((s) => ({
          jugador: {
            ...s.jugador,
            fichas: Math.max(0, s.jugador.fichas + cantidad),
            updatedAt: new Date().toISOString(),
          },
        })),
      otorgarCosmetico: (id) =>
        set((s) => {
          if (!cosmeticById.has(id) || s.jugador.cosmeticos.includes(id)) return s;
          return {
            jugador: {
              ...s.jugador,
              cosmeticos: [...s.jugador.cosmeticos, id],
              updatedAt: new Date().toISOString(),
            },
          };
        }),
      comprarCosmetico: (id) => {
        const item = cosmeticById.get(id);
        const { jugador } = get();
        if (!item) return 'no-existe';
        if (esPropio(jugador, item)) return 'ya-tienes';
        if (!estaDesbloqueado(jugador, item)) return 'bloqueado';
        if (jugador.fichas < item.precio) return 'sin-fichas';
        set({
          jugador: {
            ...jugador,
            fichas: jugador.fichas - item.precio,
            cosmeticos: [...jugador.cosmeticos, item.id],
            updatedAt: new Date().toISOString(),
          },
        });
        return 'ok';
      },
      equiparCosmetico: (id) => {
        const item = cosmeticById.get(id);
        if (!item) return;
        set((s) => ({
          jugador: {
            ...s.jugador,
            equipado: alternarPrenda(s.jugador, item),
            updatedAt: new Date().toISOString(),
          },
        }));
      },
      desequiparSlot: (slot) =>
        set((s) => {
          if (!s.jugador.equipado[slot]) return s;
          const equipado = { ...s.jugador.equipado };
          delete equipado[slot];
          return {
            jugador: { ...s.jugador, equipado, updatedAt: new Date().toISOString() },
          };
        }),
      renombrar: (nombre) =>
        set((s) => ({
          jugador: {
            ...s.jugador,
            nombre: nombre.trim().slice(0, 24) || 'Viajero',
            updatedAt: new Date().toISOString(),
          },
        })),
      cambiarSexo: (sexo) =>
        set((s) => ({
          jugador: { ...s.jugador, sexo, updatedAt: new Date().toISOString() },
        })),
      limpiarMisiones: () =>
        set((s) => ({
          jugador: {
            ...s.jugador,
            misionActivaId: null,
            misionesCompletadas: [],
            misionesFallidas: [],
            updatedAt: new Date().toISOString(),
          },
        })),
      fijarMisionActiva: (questId) =>
        set((s) => ({ jugador: { ...s.jugador, misionActivaId: questId, updatedAt: new Date().toISOString() } })),
      registrarMision: (questId, exito) =>
        set((s) => ({
          jugador: {
            ...s.jugador,
            misionActivaId: s.jugador.misionActivaId === questId ? null : s.jugador.misionActivaId,
            misionesCompletadas: exito ? [...new Set([...s.jugador.misionesCompletadas, questId])] : s.jugador.misionesCompletadas,
            misionesFallidas: !exito ? [...new Set([...s.jugador.misionesFallidas, questId])] : s.jugador.misionesFallidas,
            updatedAt: new Date().toISOString(),
          },
        })),
      aplicarPerfilRemoto: (p) =>
        set((s) => ({
          jugador: {
            ...s.jugador,
            nombre: p.nombre,
            nivel: p.nivel,
            xp: p.xp,
            xpParaSiguienteNivel: p.xpParaSiguienteNivel,
            atributos: { ...p.atributos },
            misionesCompletadas: [...p.misionesCompletadas],
            misionesFallidas: [...p.misionesFallidas],
            updatedAt: p.updatedAt,
          },
        })),
      reiniciar: (nombre) => set({ jugador: jugadorInicial(nombre) }),
    }),
    {
      name: 'ruta-urbana/jugador',
      version: 4,
      storage: createJSONStorage(() => localStorage),
      // v4: sexo del avatar. v3: fichas + cosméticos. Rellena datos viejos sin perder progreso.
      migrate: (persisted) => {
        const previo = (persisted ?? {}) as Partial<PlayerState>;
        return { ...previo, jugador: normalizarJugador(previo.jugador) } as PlayerState;
      },
    },
  ),
);

/* ── Efectos de XP y subida de nivel (efímeros, NO persistidos) ────────────── */

export interface AvisoXp {
  id: number;
  xp: number;
  /** Nivel alcanzado si esta ganancia subió de nivel. */
  subioANivel: number | null;
}

interface FxState {
  avisoXp: AvisoXp | null;
  /** Nivel que se está celebrando (overlay centrado), o null. */
  nivel: number | null;
  anunciarXp: (xp: number, subioANivel: number | null) => void;
  cerrarAvisoXp: () => void;
  cerrarNivel: () => void;
}

let fxSeq = 0;
let acumuladoXp = 0;
let ultimoAnuncioMs = 0;

export const useFxStore = create<FxState>()((set) => ({
  avisoXp: null,
  nivel: null,
  anunciarXp: (xp, subioANivel) => {
    // Agrupa ráfagas (pasos que revelan celdas) en un solo "+X XP".
    const ahora = Date.now();
    acumuladoXp = ahora - ultimoAnuncioMs < 1200 ? acumuladoXp + xp : xp;
    ultimoAnuncioMs = ahora;
    set((s) => ({
      avisoXp: { id: ++fxSeq, xp: acumuladoXp, subioANivel },
      nivel: subioANivel ?? s.nivel,
    }));
  },
  cerrarAvisoXp: () => set({ avisoXp: null }),
  cerrarNivel: () => {
    acumuladoXp = 0;
    ultimoAnuncioMs = 0;
    set({ nivel: null, avisoXp: null });
  },
}));

export interface QuestProgress {
  estado: QuestStatus;
  pasosCompletados: string[];
  checks: Record<string, boolean>;
  updatedAt: string;
}

export const PROGRESO_VACIO: QuestProgress = {
  estado: 'disponible',
  pasosCompletados: [],
  checks: {},
  updatedAt: '',
};

const nuevoProgreso = (): QuestProgress => ({
  estado: 'disponible',
  pasosCompletados: [],
  checks: {},
  updatedAt: new Date().toISOString(),
});

interface QuestState {
  progresos: Record<string, QuestProgress>;
  customs: { quest: Quest; dialogos: DialogueNode[] }[];
  progresoDe: (questId: string) => QuestProgress;
  activar: (questId: string) => void;
  agregarCustom: (quest: Quest, dialogos: DialogueNode[]) => void;
  toggleCheck: (questId: string, itemId: string) => void;
  completarPaso: (questId: string, stepId: string) => void;
  completarMision: (questId: string) => void;
  registrarRescate: (questId: string) => void;
  /** Borra el progreso de todas las misiones (para pruebas). */
  reiniciarMisiones: () => void;
  resetearTodo: () => void;
}

export const useQuestStore = create<QuestState>()(
  persist(
    (set, get) => ({
      progresos: {},
      customs: [],
      progresoDe: (questId) => get().progresos[questId] ?? nuevoProgreso(),
      agregarCustom: (quest, dialogos) =>
        set((s) => ({
          customs: [...s.customs.filter((c) => c.quest.id !== quest.id), { quest, dialogos }],
        })),
      activar: (questId) =>
        set((s) => {
          const anterior = usePlayerStore.getState().jugador.misionActivaId;
          const progresos = { ...s.progresos };
          if (anterior && anterior !== questId && progresos[anterior]?.estado === 'activa') {
            progresos[anterior] = { ...progresos[anterior], estado: 'disponible', updatedAt: new Date().toISOString() };
          }
          const actual = progresos[questId] ?? nuevoProgreso();
          progresos[questId] = { ...actual, estado: 'activa', updatedAt: new Date().toISOString() };
          usePlayerStore.getState().fijarMisionActiva(questId);
          return { progresos };
        }),
      toggleCheck: (questId, itemId) =>
        set((s) => {
          const actual = s.progresos[questId] ?? nuevoProgreso();
          return {
            progresos: {
              ...s.progresos,
              [questId]: {
                ...actual,
                checks: { ...actual.checks, [itemId]: !actual.checks[itemId] },
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),
      completarPaso: (questId, stepId) =>
        set((s) => {
          const actual = s.progresos[questId] ?? nuevoProgreso();
          if (actual.pasosCompletados.includes(stepId)) return s;
          return {
            progresos: {
              ...s.progresos,
              [questId]: {
                ...actual,
                pasosCompletados: [...actual.pasosCompletados, stepId],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),
      completarMision: (questId) =>
        set((s) => {
          const quest = questById.get(questId);
          const actual = s.progresos[questId] ?? nuevoProgreso();
          if (!quest) return s;
          if (!quest.pasos.every((p) => actual.pasosCompletados.includes(p.id))) return s;
          if (actual.estado === 'completada') return s;
          const r = quest.recompensa;
          usePlayerStore.getState().ganarXP(r.xp, r.atributos);
          if (r.paga) usePlayerStore.getState().ganarFichas(r.paga);
          if (r.premio) usePlayerStore.getState().otorgarCosmetico(r.premio);
          usePlayerStore.getState().registrarMision(questId, true);
          return {
            progresos: { ...s.progresos, [questId]: { ...actual, estado: 'completada', updatedAt: new Date().toISOString() } },
          };
        }),
      registrarRescate: (questId) =>
        set((s) => {
          const quest = questById.get(questId);
          const actual = s.progresos[questId] ?? nuevoProgreso();
          if (!quest?.recompensaRescate || actual.estado !== 'activa') return s;
          const r = quest.recompensaRescate;
          usePlayerStore.getState().ganarXP(r.xp, r.atributos);
          if (r.paga) usePlayerStore.getState().ganarFichas(r.paga);
          if (r.premio) usePlayerStore.getState().otorgarCosmetico(r.premio);
          usePlayerStore.getState().registrarMision(questId, false);
          return {
            progresos: { ...s.progresos, [questId]: { ...actual, estado: 'reprogramada', updatedAt: new Date().toISOString() } },
          };
        }),
      reiniciarMisiones: () => {
        set({ progresos: {}, customs: [] });
        usePlayerStore.getState().limpiarMisiones();
      },
      resetearTodo: () => set({ progresos: {}, customs: [] }),
    }),
    {
      name: 'ruta-urbana/misiones',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ progresos: s.progresos, customs: s.customs }) as QuestState,
    },
  ),
);

import { dialogueById, quests as questsStatic } from './data';

/** Catálogo completo: oficial + creadas localmente/comunitarias. */
export function listaMisiones(): Quest[] {
  const customs = useQuestStore.getState().customs.map((c) => c.quest);
  return [...questsStatic, ...customs];
}

/** Busca en oficial + customs (no usar questById directo en UI). */
export function buscarQuest(id: string): Quest | undefined {
  return useQuestStore.getState().customs.find((c) => c.quest.id === id)?.quest ?? questById.get(id);
}

export function buscarDialogo(id: string): DialogueNode | undefined {
  const customs = useQuestStore.getState().customs.flatMap((c) => c.dialogos);
  return customs.find((d) => d.id === id) ?? dialogueById.get(id);
}

/** Vecinos del radar (efímero, no se persiste). */
export interface OtroJugador {
  id: string;
  nombre: string;
  nivel: number;
  pos: { lat: number; lng: number };
  at: number;
}

interface PresenceState {
  otros: OtroJugador[];
  ver: (o: OtroJugador) => void;
  limpiar: () => void;
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  otros: [],
  ver: (o) =>
    set((s) => {
      const resto = s.otros.filter((x) => x.id !== o.id);
      return { otros: [...resto, o].slice(-20) };
    }),
  limpiar: () => set({ otros: [] }),
}));

/** Plaza de Armas, Santiago — origen del modo joystick. */
export const DEFAULT_ORIGIN = { lat: -33.4372, lng: -70.6506 };
/** Metros por paso del pad (se repite mientras se mantiene pulsado). */
export const JOYSTICK_STEP_M = 2;
/** Intervalo entre pasos del pad al mantener: ~20 m/s, ágil sin teletransportar. */
export const JOYSTICK_TICK_MS = 100;
const MAX_VISITED = 8000;

export interface AlertaProximidad {
  questId: string;
  locationId: string;
  nombre: string;
  sensible?: boolean;
  questTitulo: string;
  distanciaM: number;
  at: string;
}

interface AlertState {
  alerta: AlertaProximidad | null;
  /** Última alerta por ubicación (ms epoch) para cooldown anti-spam. */
  ultimasAlertas: Record<string, number>;
  /** El usuario activó los avisos del sistema (permiso Notification). */
  avisosActivados: boolean;
  dispararAlerta: (a: Omit<AlertaProximidad, 'at'>) => void;
  descartarAlerta: () => void;
  setAvisosActivados: (v: boolean) => void;
}

export const useAlertStore = create<AlertState>()(
  persist(
    (set) => ({
      alerta: null,
      ultimasAlertas: {},
      avisosActivados: false,
      dispararAlerta: (a) =>
        set((s) => ({
          alerta: { ...a, at: new Date().toISOString() },
          ultimasAlertas: { ...s.ultimasAlertas, [`${a.questId}:${a.locationId}`]: Date.now() },
        })),
      descartarAlerta: () => set({ alerta: null }),
      setAvisosActivados: (v) => set({ avisosActivados: v }),
    }),
    {
      name: 'ruta-urbana/alertas',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ ultimasAlertas: s.ultimasAlertas, avisosActivados: s.avisosActivados }) as AlertState,
    },
  ),
);

interface SettingsState {
  sonido: boolean;
  /** Tema visual del mapa: automático por hora o fijo. */
  temaMapa: TemaMapa;
  /** Ambiente estacional: automático por fecha o fijo. */
  ambiente: Ambiente;
  toggleSonido: () => void;
  setTemaMapa: (t: TemaMapa) => void;
  setAmbiente: (a: Ambiente) => void;
}

/** Preferencias UI (persistidas). */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sonido: true,
      temaMapa: 'auto',
      ambiente: 'auto',
      toggleSonido: () => set((s) => ({ sonido: !s.sonido })),
      setTemaMapa: (t) => set({ temaMapa: t }),
      setAmbiente: (a) => set({ ambiente: a }),
    }),
    {
      name: 'ruta-urbana/ajustes',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // v1 guardaba `mapaTema: 'noche' | 'dia'`: se conserva como tema fijo.
      migrate: (persistido, version) => {
        const prev = (persistido ?? {}) as Record<string, unknown>;
        if (version < 2 && typeof prev.mapaTema === 'string') {
          prev.temaMapa = prev.mapaTema === 'dia' ? 'dia' : 'noche';
        }
        delete prev.mapaTema;
        return prev as unknown as SettingsState;
      },
    },
  ),
);

export type PositionMode = 'gps' | 'joystick';

interface ExplorationState {
  mode: PositionMode;
  mock: { lat: number; lng: number };
  visited: string[];
  /** Total histórico de celdas reveladas (no se recorta): base de la XP. */
  celdasReveladas: number;
  lastRevealAt: string | null;
  setMode: (mode: PositionMode) => void;
  moveMock: (dxM: number, dyM: number) => void;
  centerMock: (p: { lat: number; lng: number }) => void;
  reveal: (p: { lat: number; lng: number }, radiusM?: number) => void;
  resetFog: () => void;
}

export const useExplorationStore = create<ExplorationState>()(
  persist(
    (set) => ({
      mode: 'joystick',
      mock: DEFAULT_ORIGIN,
      visited: [],
      celdasReveladas: 0,
      lastRevealAt: null,
      setMode: (mode) => set({ mode }),
      moveMock: (dxM, dyM) =>
        set((s) => ({
          mock: {
            lat: s.mock.lat + dyM / 111320,
            lng: s.mock.lng + dxM / (111320 * Math.cos((s.mock.lat * Math.PI) / 180)),
          },
        })),
      centerMock: (p) => set({ mock: p }),
      reveal: (p, radiusM = 100) =>
        set((s) => {
          const known = new Set(s.visited);
          const fresh = cellsAround(p, radiusM).filter((k) => !known.has(k));
          if (fresh.length === 0) return s;
          const visited = [...s.visited, ...fresh];
          const total = s.celdasReveladas + fresh.length;
          const xp = xpPorCeldas(fresh.length, s.celdasReveladas);
          if (xp > 0) usePlayerStore.getState().ganarXP(xp);
          return {
            visited: visited.length > MAX_VISITED ? visited.slice(visited.length - MAX_VISITED) : visited,
            celdasReveladas: total,
            lastRevealAt: new Date().toISOString(),
          };
        }),
      resetFog: () => set({ visited: [], celdasReveladas: 0, lastRevealAt: null }),
    }),
    {
      name: 'ruta-urbana/exploracion',
      version: 2,
      storage: createJSONStorage(storageDiferido),
      partialize: (s) => ({
        mode: s.mode,
        mock: s.mock,
        visited: s.visited,
        celdasReveladas: s.celdasReveladas,
        lastRevealAt: s.lastRevealAt,
      }),
      // v2: contador histórico de celdas (XP de exploración).
      migrate: (persisted) => {
        const previo = (persisted ?? {}) as Partial<ExplorationState> & { visited?: string[] };
        return {
          ...previo,
          celdasReveladas: previo.celdasReveladas ?? previo.visited?.length ?? 0,
        } as ExplorationState;
      },
    },
  ),
);
