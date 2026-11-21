/**
 * RUTA URBANA — Esquemas de datos base (Fase 0).
 *
 * Regla de arquitectura: estos tipos son la única fuente de verdad para la
 * lógica de misiones. Los componentes visuales (`app/`, `components/`) los
 * consumen, pero NUNCA los redefinen ni les agregan campos de UI.
 * El catálogo jugable vive en `src/data/quests.json` (Fase 2) y debe
 * validarse contra estas interfaces.
 */

/** Los 4 atributos del jugador. Nombres en español según diseño del juego. */
export type Atributos = {
  /** Carisma: trato social, pedir ayuda, resolver en mesón. */
  carisma: number;
  /** Valentía: salir a zonas nuevas, misiones nocturnas, imprevistos. */
  valentia: number;
  /** Burocracia: papeles, filas, formularios, sistema. */
  burocracia: number;
  /** Supervivencia: moverse con poco dinero/batería, farmacia, clima. */
  supervivencia: number;
};

/** Clave de atributo, útil para HUD y recompensas genéricas. */
export type AtributoKey = keyof Atributos;

/** Alias en inglés para código compartido (mismo objeto, otro nombre). */
export type PlayerStats = Atributos;

/** Estado global de progresión del jugador. */
export interface Jugador {
  id: string;
  nombre: string;
  nivel: number;
  /** XP acumulada en el nivel actual. */
  xp: number;
  /** XP necesaria para subir de nivel (curva definida en store, no en JSON). */
  xpParaSiguienteNivel: number;
  atributos: Atributos;
  /** IDs de misiones (ver `Quest.id`). */
  misionActivaId: string | null;
  misionesCompletadas: string[];
  misionesFallidas: string[];
  updatedAt: string;
}

/** Estado de una misión en el bucle principal. */
export type QuestStatus = 'disponible' | 'activa' | 'completada' | 'fallida' | 'reprogramada';

/** Categorías jugables del MVP (Fase 2). */
export type QuestCategory = 'tramite' | 'salud' | 'trabajo' | 'hogar' | 'secundaria';

/** Tipos de paso dentro de una misión. */
export type QuestStepType = 'preparacion' | 'ir' | 'dialogo' | 'accion' | 'rescate';

/** Un paso individual de una misión. */
export interface QuestStep {
  id: string;
  orden: number;
  tipo: QuestStepType;
  /** Instrucción corta para la tarjeta ("Llega al mesón 3"). */
  titulo: string;
  /** Detalle largo / guion de qué hacer. */
  detalle: string;
  /** Si es `dialogo`, nodo inicial en `DialogueNode.id`. */
  dialogoId?: string;
  /** Si es `ir`, destino asociado. */
  destinoId?: string;
  /** Items de inventario que este paso exige (ver `InventoryItem.id`). */
  requiereItems?: string[];
  completado: boolean;
}

/** Recompensa al completar misión o paso. */
export interface QuestReward {
  xp: number;
  atributos?: Partial<Atributos>;
}

/** Punto de interés físico de una misión (Fase 1 geofencing, Fase 3). */
export interface QuestLocation {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  /** Radio de geocerca en metros (50-80 por defecto, Fase 3). */
  radioM: number;
  /** Si true, las notificaciones usan texto neutro en pantalla bloqueada. */
  sensible?: boolean;
}

/** Misión completa (entrada del catálogo `src/data/quests.json`). */
export interface Quest {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: QuestCategory;
  estado: QuestStatus;
  nivelMinimo: number;
  /** Requisitos previos: items y/o misiones. */
  requisitos: {
    items?: string[];
    misionesPrevia?: string[];
  };
  pasos: QuestStep[];
  recompensa: QuestReward;
  /** Recompensa parcial si el trámite falla por causa externa (modo rescate). */
  recompensaRescate?: QuestReward;
  ubicaciones: QuestLocation[];
}

/** Alias en español pedido en Fase 0. */
export type Mision = Quest;
export type PasoMision = QuestStep;

/** Objeto llevable / requisito previo (ej. "carnet vencido", "dinero/tarjeta"). */
export interface InventoryItem {
  id: string;
  nombre: string;
  descripcion: string;
  /** Nombre del icono pixel-art (Fase 4), ej. "id-card", "coins". */
  icono: string;
  cantidad: number;
  /** Si true, aparece en la vista de preparación pre-ruta (Fase 2). */
  esRequisitoPrevio?: boolean;
}

export type Inventario = InventoryItem[];

/** Opción de respuesta del jugador ante un NPC. */
export interface DialogueOption {
  id: string;
  texto: string;
  /** Nodo al que salta. Si se omite, el diálogo termina. */
  siguienteId?: string;
  /** Efecto opcional (ej. +1 carisma si eliges tono amable). */
  efecto?: {
    xp?: number;
    atributos?: Partial<Atributos>;
  };
}

/** Nodo de diálogo estilo caja RPG con retrato pixel-art. */
export interface DialogueNode {
  id: string;
  npcId: string;
  npcNombre: string;
  /** Retrato pixel-art (Fase 4), ej. "don-tito", "ana-tens", "seba". */
  retrato: string;
  /** Guion exacto de qué decir en el mesón. */
  texto: string;
  opciones: DialogueOption[];
  /** Si true, es salida de emergencia ante imprevisto ("se cayó el sistema"). */
  esRescate?: boolean;
}

export type NodoDialogo = DialogueNode;

/** Punto GPS ya descubierto por el jugador (motor de niebla, Fase 1). */
export interface ExploredPoint {
  latitud: number;
  longitud: number;
  visitadoEn: string;
}

/** Zona explorada agregada (celda o cluster de puntos). */
export interface ExploredZone {
  id: string;
  /** Centro de la zona. */
  latitud: number;
  longitud: number;
  /** Radio disipado en metros (100 m por defecto). */
  radioM: number;
  puntos: ExploredPoint[];
  updatedAt: string;
}

export type ZonaExplorada = ExploredZone;

/** NPC del mundo (retratos en Fase 4, guiones en Fase 2). */
export interface Npc {
  id: string;
  nombre: string;
  rol: string;
  retrato: string;
  ubicacionId?: string;
}
