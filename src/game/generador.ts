import type { DialogueNode, Quest, QuestCategory } from './types';
import type { Poi } from './pois';

export interface BriefMision {
  titulo: string;
  lugar: string;
  categoria: QuestCategory;
  lat: number;
  lng: number;
  /** Si true, el punto es exacto (POI de OSM) y no se desplaza. */
  exacto?: boolean;
}

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'mision';

const INTRO_NPC: Record<QuestCategory, { npcId: string; npcNombre: string; retrato: string }> = {
  tramite: { npcId: 'don-tito', npcNombre: 'Don Tito', retrato: 'don-tito' },
  salud: { npcId: 'ana-tens', npcNombre: 'Ana la Tens', retrato: 'ana-tens' },
  trabajo: { npcId: 'seba', npcNombre: 'Seba', retrato: 'seba' },
  hogar: { npcId: 'vecino', npcNombre: 'Vecino', retrato: 'vecino' },
  secundaria: { npcId: 'vecino', npcNombre: 'Vecino', retrato: 'vecino' },
};

/**
 * Generador local de misiones secundarias ($0, offline, sin IA externa).
 * Rellena la plantilla canónica: preparación → ir → diálogo → acción.
 * El resultado pasa las mismas validaciones que el catálogo oficial.
 *
 * El punto queda a ~150 m al noreste de la posición dada: caminata corta
 * real en vez de "llegada instantánea" sobre el propio jugador.
 */
export function generarMisionSecundaria(b: BriefMision, autor = 'yo'): { quest: Quest; dialogos: DialogueNode[] } {
  const id = `custom-${slug(b.titulo)}-${Date.now().toString(36)}`;
  const npc = INTRO_NPC[b.categoria];
  const locId = `${id}-lugar`;
  const lat = b.exacto ? b.lat : b.lat + 0.0012;
  const lng = b.exacto ? b.lng : b.lng + 0.0009;

  const quest: Quest = {
    id,
    titulo: b.titulo,
    descripcion: `${b.lugar}: misión secundaria creada por ${autor}. Sigue los pasos y cobra tu recompensa.`,
    categoria: b.categoria,
    estado: 'disponible',
    nivelMinimo: 1,
    requisitos: { items: ['dinero-tarjeta'] },
    pasos: [
      {
        id: `${id}-prep`,
        orden: 1,
        tipo: 'preparacion',
        titulo: 'Revisa tu mochila',
        detalle: 'Lleva medio de pago y algo para anotar. Revisa el checklist antes de salir.',
        requiereItems: ['dinero-tarjeta'],
        completado: false,
      },
      {
        id: `${id}-ir`,
        orden: 2,
        tipo: 'ir',
        titulo: `Llega a ${b.lugar}`,
        detalle: 'Ubica el lugar, respira y entra con el guion en mente.',
        destinoId: locId,
        completado: false,
      },
      {
        id: `${id}-dialogo`,
        orden: 3,
        tipo: 'dialogo',
        titulo: 'Habla en el mesón',
        detalle: `Te atiende ${npc.npcNombre}. Sigue el guion.`,
        dialogoId: `${id}-d1`,
        completado: false,
      },
      {
        id: `${id}-cierre`,
        orden: 4,
        tipo: 'accion',
        titulo: 'Cierra el trámite',
        detalle: 'Pide comprobante o boleta de todo. Sin papel no hay prueba.',
        completado: false,
      },
    ],
    recompensa: { xp: 60, paga: 80, atributos: { supervivencia: 1 } },
    recompensaRescate: { xp: 25, paga: 30 },
    ubicaciones: [{ id: locId, nombre: b.lugar, latitud: lat, longitud: lng, radioM: 60, sensible: b.categoria === 'salud' }],
  };

  const dialogos: DialogueNode[] = [
    {
      id: `${id}-d1`,
      npcId: npc.npcId,
      npcNombre: npc.npcNombre,
      retrato: npc.retrato,
      texto: `Hola, ¿en qué te ayudo? (Estás en ${b.lugar} por: ${b.titulo}.)`,
      opciones: [
        { id: `${id}-d1a`, texto: '«Hola, vengo por este trámite. ¿Qué necesito?» (preguntar con calma)', siguienteId: `${id}-d2`, efecto: { xp: 5, atributos: { carisma: 1 } } },
        { id: `${id}-d1b`, texto: '«Hola, ¿me atiende por favor?» (directo)', siguienteId: `${id}-d2` },
      ],
    },
    {
      id: `${id}-d2`,
      npcId: npc.npcId,
      npcNombre: npc.npcNombre,
      retrato: npc.retrato,
      texto: 'Perfecto, con eso basta. Te lo dejo listo: guarda el comprobante y revisa que tus datos estén bien antes de irte.',
      opciones: [{ id: `${id}-d2a`, texto: '(Volver a la misión con el guion aprendido)' }],
    },
  ];

  return { quest, dialogos };
}

/** Categoría de misión según el tipo de lugar de OSM. */
const CATEGORIA_POI: Record<Poi['categoria'], QuestCategory> = {
  farmacia: 'salud',
  salud: 'salud',
  banco: 'tramite',
  'registro-civil': 'tramite',
  municipalidad: 'tramite',
  oficina: 'tramite',
};

/** Misión desde un lugar de interés: el pin queda exactamente donde está el POI. */
export function generarMisionDesdePoi(poi: Poi): { quest: Quest; dialogos: DialogueNode[] } {
  const categoria = CATEGORIA_POI[poi.categoria];
  const r = generarMisionSecundaria({
    titulo: `${poi.nombre}`,
    lugar: poi.nombre,
    categoria,
    lat: poi.lat,
    lng: poi.lng,
    exacto: true,
  });
  // Vincula la misión al lugar para el badge de estado en el mapa.
  r.quest.poiId = poi.id;
  r.quest.preparacionClave = poi.categoria;
  return r;
}
