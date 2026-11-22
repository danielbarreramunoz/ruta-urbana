/**
 * Perfil inicial del jugador (puro TS, sin DOM).
 * Adapta qué misiones principales aparecen: la edad y la situación laboral
 * cambian el catálogo, y los intereses priorizan lugares de interés (POI).
 *
 * Privacidad: no se piden diagnósticos ni datos médicos; solo categorías de
 * lugares que la persona quiere encontrar. Todo queda en localStorage.
 */
import type { Interes, Perfil, Quest, RangoEdad, Situacion } from './types';

export type { Interes, Perfil, RangoEdad, Situacion } from './types';

export const PERFIL_VACIO: Perfil = {
  completado: false,
  omitido: false,
  edad: null,
  situacion: null,
  intereses: [],
  updatedAt: '',
};

export const ETIQUETA_EDAD: Record<RangoEdad, string> = {
  menor: 'Menos de 18',
  '18-24': '18 a 24',
  '25-34': '25 a 34',
  '35-49': '35 a 49',
  '50+': '50 o más',
};

export const ETIQUETA_SITUACION: Record<Situacion, string> = {
  estudiando: 'Estudiando',
  'buscando-empleo': 'Buscando empleo',
  trabajando: 'Ya trabajando',
  cesante: 'Sin trabajo ahora',
  jubilado: 'Jubilado/a',
};

export const ETIQUETA_INTERES: Record<Interes, string> = {
  salud: 'Farmacias y salud',
  tramites: 'Trámites y oficinas',
  dinero: 'Bancos y dinero',
  trabajo: 'Trabajo y empleo',
  hogar: 'Barrio y hogar',
};

/** Rango de edad en años usado para comparar con `Quest.edadMin`. */
export function edadAprox(edad: RangoEdad | null): number | null {
  if (!edad) return null;
  if (edad === 'menor') return 16;
  if (edad === '18-24') return 21;
  if (edad === '25-34') return 29;
  if (edad === '35-49') return 42;
  return 55;
}

/** Sin onboarding no hay catálogo principal: el jugador decide en el mapa. */
export function hayMisionesPrincipales(p: Perfil): boolean {
  return p.completado && !p.omitido;
}

/** ¿Esta misión principal aplica al perfil? Las `custom-` siempre aplican. */
export function questApta(q: Quest, p: Perfil): boolean {
  if (q.id.startsWith('custom-')) return true;
  if (!hayMisionesPrincipales(p)) return false;

  const edad = edadAprox(p.edad);
  if (q.edadMin != null && edad != null && edad < q.edadMin) return false;
  if (q.situaciones?.length && p.situacion && !q.situaciones.includes(p.situacion)) return false;
  if (q.intereses?.length && p.intereses.length && !q.intereses.some((i) => p.intereses.includes(i))) return false;
  return true;
}

/** Intereses sugeridos por defecto según situación (para no partir vacío). */
export function interesesSugeridos(situacion: Situacion | null): Interes[] {
  if (situacion === 'trabajando' || situacion === 'buscando-empleo') return ['trabajo', 'dinero', 'tramites'];
  if (situacion === 'jubilado') return ['salud', 'dinero', 'tramites'];
  if (situacion === 'estudiando') return ['tramites', 'dinero', 'hogar'];
  return ['salud', 'tramites', 'dinero'];
}
