/**
 * Reglas puras de cosméticos (sin React ni DOM).
 * Las usa la tienda/editor y el store; así la economía es testeable en Node.
 */
import { cosmeticos } from './data';
import type { CosmeticItem, CosmeticSlot, Equipamiento, Jugador } from './types';

/** Look inicial: vacío. El jugador nuevo parte sin prendas y todo se compra. */
export const EQUIPADO_INICIAL: Equipamiento = {};

/** Orden de las pestañas del editor. */
export const SLOT_ORDEN: { id: CosmeticSlot; label: string }[] = [
  { id: 'pelo', label: 'PELO' },
  { id: 'gorro', label: 'GORRO' },
  { id: 'lentes', label: 'LENTES' },
  { id: 'barba', label: 'BARBA' },
  { id: 'aros', label: 'AROS' },
  { id: 'ropa', label: 'ROPA' },
  { id: 'pantalon', label: 'PANTALÓN' },
  { id: 'zapatos', label: 'ZAPATOS' },
  { id: 'tatuaje', label: 'TATUAJE' },
  { id: 'mochila', label: 'MOCHILA' },
];

/** Prendas de una ranura, de más barata a más cara. */
export function porSlot(slot: CosmeticSlot): CosmeticItem[] {
  return cosmeticos.filter((c) => c.slot === slot).sort((a, b) => a.precio - b.precio || a.nombre.localeCompare(b.nombre));
}

/** Solo es propia si se compró o se ganó (premio). Sin prendas gratis iniciales. */
export function esPropio(jugador: Jugador, item: CosmeticItem): boolean {
  return jugador.cosmeticos.includes(item.id);
}

/** Cumple el requisito de nivel o de misión para poder comprarla. */
export function estaDesbloqueado(jugador: Jugador, item: CosmeticItem): boolean {
  const d = item.desbloqueo;
  if (d.tipo === 'libre') return true;
  if (d.tipo === 'nivel') return jugador.nivel >= d.nivel;
  return jugador.misionesCompletadas.includes(d.questId);
}

/** Texto corto del candado, o `null` si ya está desbloqueada. */
export function motivoBloqueo(jugador: Jugador, item: CosmeticItem): string | null {
  if (estaDesbloqueado(jugador, item)) return null;
  const d = item.desbloqueo;
  if (d.tipo === 'nivel') return `Nv. ${d.nivel}`;
  if (d.tipo === 'mision') return 'Premio de misión';
  return null;
}

/**
 * Pone o quita la prenda de su ranura (toggle).
 * Si no es propia, devuelve el equipamiento intacto.
 */
export function alternarPrenda(jugador: Jugador, item: CosmeticItem): Equipamiento {
  const equipado: Equipamiento = { ...jugador.equipado };
  if (equipado[item.slot] === item.id) {
    delete equipado[item.slot];
    return equipado;
  }
  if (!esPropio(jugador, item)) return equipado;
  equipado[item.slot] = item.id;
  return equipado;
}
