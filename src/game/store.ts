import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { questById } from './data';
import { cellsAround } from './fog';
import type { Atributos, Jugador, QuestStatus } from './types';

const XP_BASE = 100;
export const xpParaNivel = (nivel: number) => Math.round(XP_BASE * Math.pow(1.35, nivel - 1));

const jugadorInicial = (nombre = 'Viajero'): Jugador => ({
  id: 'jugador-local',
  nombre,
  nivel: 1,
  xp: 0,
  xpParaSiguienteNivel: xpParaNivel(1),
  atributos: { carisma: 1, valentia: 1, burocracia: 1, supervivencia: 1 },
  misionActivaId: null,
  misionesCompletadas: [],
  misionesFallidas: [],
  updatedAt: new Date().toISOString(),
});

function mezclar(base: Atributos, extra?: Partial<Atributos>): Atributos {
  if (!extra) return base;
  return {
    carisma: base.carisma + (extra.carisma ?? 0),
    valentia: base.valentia + (extra.valentia ?? 0),
    burocracia: base.burocracia + (extra.burocracia ?? 0),
    supervivencia: base.supervivencia + (extra.supervivencia ?? 0),
  };
}

interface PlayerState {
  jugador: Jugador;
  ganarXP: (cantidad: number, atributos?: Partial<Atributos>) => void;
  fijarMisionActiva: (questId: string | null) => void;
  registrarMision: (questId: string, exito: boolean) => void;
  reiniciar: (nombre?: string) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      jugador: jugadorInicial(),
      ganarXP: (cantidad, atributos) =>
        set((s) => {
          let { xp, nivel, xpParaSiguienteNivel } = s.jugador;
          xp += cantidad;
          while (xp >= xpParaSiguienteNivel) {
            xp -= xpParaSiguienteNivel;
            nivel += 1;
            xpParaSiguienteNivel = xpParaNivel(nivel);
          }
          return {
            jugador: {
              ...s.jugador,
              xp,
              nivel,
              xpParaSiguienteNivel,
              atributos: { ...s.jugador.atributos, ...mezclar(s.jugador.atributos, atributos) },
              updatedAt: new Date().toISOString(),
            },
          };
        }),
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
      reiniciar: (nombre) => set({ jugador: jugadorInicial(nombre) }),
    }),
    { name: 'ruta-urbana/jugador', storage: createJSONStorage(() => localStorage) },
  ),
);

export interface QuestProgress {
  estado: QuestStatus;
  pasosCompletados: string[];
  checks: Record<string, boolean>;
  updatedAt: string;
}

const nuevoProgreso = (): QuestProgress => ({
  estado: 'disponible',
  pasosCompletados: [],
  checks: {},
  updatedAt: new Date().toISOString(),
});

interface QuestState {
  progresos: Record<string, QuestProgress>;
  progresoDe: (questId: string) => QuestProgress;
  activar: (questId: string) => void;
  toggleCheck: (questId: string, itemId: string) => void;
  completarPaso: (questId: string, stepId: string) => void;
  completarMision: (questId: string) => void;
  registrarRescate: (questId: string) => void;
  resetearTodo: () => void;
}

export const useQuestStore = create<QuestState>()(
  persist(
    (set, get) => ({
      progresos: {},
      progresoDe: (questId) => get().progresos[questId] ?? nuevoProgreso(),
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
          usePlayerStore.getState().ganarXP(quest.recompensa.xp, quest.recompensa.atributos);
          usePlayerStore.getState().registrarMision(questId, true);
          return {
            progresos: { ...s.progresos, [questId]: { ...actual, estado: 'completada', updatedAt: new Date().toISOString() } },
          };
        }),
      registrarRescate: (questId) =>
        set((s) => {
          const quest = questById.get(questId);
          const actual = s.progresos[questId] ?? nuevoProgreso();
          if (!quest?.recompensaRescate || actual.estado === 'completada') return s;
          usePlayerStore.getState().ganarXP(quest.recompensaRescate.xp, quest.recompensaRescate.atributos);
          usePlayerStore.getState().registrarMision(questId, false);
          return {
            progresos: { ...s.progresos, [questId]: { ...actual, estado: 'reprogramada', updatedAt: new Date().toISOString() } },
          };
        }),
      resetearTodo: () => set({ progresos: {} }),
    }),
    {
      name: 'ruta-urbana/misiones',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ progresos: s.progresos }) as QuestState,
    },
  ),
);

/** Plaza de Armas, Santiago — origen del modo joystick. */
export const DEFAULT_ORIGIN = { lat: -33.4372, lng: -70.6506 };
export const JOYSTICK_STEP_M = 25;
const MAX_VISITED = 8000;

export type PositionMode = 'gps' | 'joystick';

interface ExplorationState {
  mode: PositionMode;
  mock: { lat: number; lng: number };
  visited: string[];
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
          return {
            visited: visited.length > MAX_VISITED ? visited.slice(visited.length - MAX_VISITED) : visited,
            lastRevealAt: new Date().toISOString(),
          };
        }),
      resetFog: () => set({ visited: [], lastRevealAt: null }),
    }),
    {
      name: 'ruta-urbana/exploracion',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ mode: s.mode, mock: s.mock, visited: s.visited, lastRevealAt: s.lastRevealAt }),
    },
  ),
);
