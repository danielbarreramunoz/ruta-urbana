/**
 * Tema visual del mapa: momento del día (hora local) + estación del año (fecha local).
 * Puro TS, sin DOM: se puede probar con node/esbuild.
 *
 * El mapa de baldosas se colorea con un `filter` CSS sobre el pane + dos capas de
 * tinte (momento y estación). Todo se resuelve aquí para que la UI solo aplique
 * variables CSS.
 */

export type MomentoDia = 'madrugada' | 'dia' | 'atardecer' | 'noche';
export type Estacion = 'primavera' | 'verano' | 'otonio' | 'invierno';

/** Preferencia del usuario: automático o fijo. */
export type TemaMapa = 'auto' | MomentoDia;
export type Ambiente = 'auto' | Estacion;

export const MOMENTOS: readonly MomentoDia[] = ['madrugada', 'dia', 'atardecer', 'noche'];
export const ESTACIONES: readonly Estacion[] = ['primavera', 'verano', 'otonio', 'invierno'];

export const ETIQUETA_MOMENTO: Record<MomentoDia, string> = {
  madrugada: 'Madrugada',
  dia: 'Día',
  atardecer: 'Atardecer',
  noche: 'Noche',
};

export const ETIQUETA_ESTACION: Record<Estacion, string> = {
  primavera: 'Primavera',
  verano: 'Verano',
  otonio: 'Otoño',
  invierno: 'Invierno',
};

/** Rangos horarios locales (inclusive). Madrugada 0–5, día 6–16, atardecer 17–19, noche 20–23. */
const RANGOS_HORA: ReadonlyArray<readonly [number, number, MomentoDia]> = [
  [0, 5, 'madrugada'],
  [6, 16, 'dia'],
  [17, 19, 'atardecer'],
  [20, 23, 'noche'],
];

export function momentoPorHora(hora: number): MomentoDia {
  const h = Math.floor(((hora % 24) + 24) % 24);
  for (const [desde, hasta, momento] of RANGOS_HORA) {
    if (h >= desde && h <= hasta) return momento;
  }
  return 'noche';
}

export function momentoDe(fecha: Date): MomentoDia {
  return momentoPorHora(fecha.getHours());
}

/** Origen usado cuando todavía no hay ubicación disponible (Santiago). */
export const POSICION_SOL_DEFAULT = { lat: -33.4372, lng: -70.6506 };

export interface HorasSolares {
  amanecerMin: number;
  atardecerMin: number;
}

/**
 * Calcula amanecer/atardecer aproximados para fecha y coordenadas.
 * Usa el huso horario local de `fecha`: el navegador aplica automáticamente
 * cambios de hora de Chile y las excepciones regionales configuradas en el SO.
 * Ecuaciones solares tipo NOAA, horizonte estándar de -0.833°.
 */
export function horasSolares(
  fecha: Date,
  posicion: { lat: number; lng: number } = POSICION_SOL_DEFAULT,
): HorasSolares | null {
  const { lat, lng } = posicion;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 66) return null;

  const inicio = Date.UTC(fecha.getFullYear(), 0, 0);
  const dia = Math.floor((Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) - inicio) / 86_400_000);
  const gamma = (2 * Math.PI / 365.2422) * (dia - 1);
  const eqMin = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(gamma) -
    0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) -
    0.040849 * Math.sin(2 * gamma)
  );
  const decl = 0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const latRad = (lat * Math.PI) / 180;
  const cosHora = (
    Math.cos((90.833 * Math.PI) / 180) -
    Math.sin(latRad) * Math.sin(decl)
  ) / (Math.cos(latRad) * Math.cos(decl));
  if (cosHora < -1 || cosHora > 1) return null;

  const anguloHora = (Math.acos(cosHora) * 180) / Math.PI;
  // getTimezoneOffset = UTC - hora local; así se respetan DST y husos regionales.
  const mediodiaLocal = 720 - 4 * lng - eqMin - fecha.getTimezoneOffset();
  return {
    amanecerMin: mediodiaLocal - 4 * anguloHora,
    atardecerMin: mediodiaLocal + 4 * anguloHora,
  };
}

/** Momento visual según salida/puesta de sol real aproximada en la ubicación. */
export function momentoSolar(
  fecha: Date,
  posicion: { lat: number; lng: number } = POSICION_SOL_DEFAULT,
): MomentoDia {
  const horas = horasSolares(fecha, posicion);
  if (!horas) return momentoDe(fecha);
  const minuto = fecha.getHours() * 60 + fecha.getMinutes();
  const antesAmanecer = horas.amanecerMin - 30;
  const inicioAtardecer = horas.atardecerMin - 30;
  const finAtardecer = horas.atardecerMin + 35;

  if (minuto < antesAmanecer) return 'madrugada';
  if (minuto >= finAtardecer) return 'noche';
  if (minuto >= inicioAtardecer) return 'atardecer';
  return 'dia';
}

/**
 * Estación por mes. Por defecto hemisferio sur (Santiago): verano dic–feb,
 * otoño mar–may, invierno jun–ago, primavera sep–nov.
 */
export function estacionPorMes(mes: number, hemisferio: 'sur' | 'norte' = 'sur'): Estacion {
  const m = (((Math.trunc(mes) - 1) % 12) + 12) % 12; // 0 = enero
  const sur: Estacion[] = [
    'verano', 'verano', 'otonio', 'otonio', 'otonio', 'invierno',
    'invierno', 'invierno', 'primavera', 'primavera', 'primavera', 'verano',
  ];
  const base = sur[m] ?? 'verano';
  if (hemisferio === 'sur') return base;
  const opuesto: Record<Estacion, Estacion> = {
    verano: 'invierno',
    otonio: 'primavera',
    invierno: 'verano',
    primavera: 'otonio',
  };
  return opuesto[base];
}

export function estacionDe(fecha: Date, hemisferio: 'sur' | 'norte' = 'sur'): Estacion {
  return estacionPorMes(fecha.getMonth() + 1, hemisferio);
}

export interface PaletaMapa {
  /** `filter` CSS para cada baldosa (momento + estación). */
  filtro: string;
  /** Tinte del momento del día (capa plana sobre el mapa). */
  tinte: string;
  /** Tinte de la estación. */
  tinteAmbiente: string;
  /** Fondo del contenedor (se ve entre baldosas y en los bordes). */
  fondo: string;
  /** Color exterior de la viñeta. */
  vineta: string;
  /** true = tema claro (fondo y atribución claros). */
  claro: boolean;
}

interface BaseMomento {
  filtro: string;
  tinte: string;
  fondo: string;
  vineta: string;
  claro: boolean;
}

const BASE_MOMENTO: Record<MomentoDia, BaseMomento> = {
  madrugada: {
    filtro: 'invert(100%) hue-rotate(180deg) brightness(0.72) contrast(1.06) saturate(0.4)',
    tinte: 'rgba(46, 74, 160, 0.2)',
    fondo: '#06060d',
    vineta: 'rgba(2, 3, 12, 0.78)',
    claro: false,
  },
  dia: {
    filtro: 'brightness(1.06) contrast(1.02) saturate(0.92)',
    tinte: 'rgba(255, 240, 205, 0.1)',
    fondo: '#e8e4d8',
    vineta: 'rgba(60, 55, 40, 0.2)',
    claro: true,
  },
  atardecer: {
    filtro: 'invert(100%) hue-rotate(180deg) brightness(0.82) contrast(1.02) saturate(0.6) sepia(0.45) hue-rotate(-20deg)',
    tinte: 'rgba(255, 120, 50, 0.16)',
    fondo: '#150d12',
    vineta: 'rgba(34, 12, 8, 0.6)',
    claro: false,
  },
  noche: {
    filtro: 'invert(100%) hue-rotate(180deg) brightness(0.9) contrast(0.95) saturate(0.55)',
    tinte: 'rgba(24, 44, 90, 0.14)',
    fondo: '#08080e',
    vineta: 'rgba(5, 5, 11, 0.55)',
    claro: false,
  },
};

const BASE_ESTACION: Record<Estacion, { extra: string; tinte: string }> = {
  primavera: {
    extra: 'saturate(1.06) hue-rotate(4deg) brightness(1.02)',
    tinte: 'rgba(120, 200, 120, 0.05)',
  },
  verano: {
    extra: 'saturate(1.12) sepia(0.08)',
    tinte: 'rgba(255, 200, 80, 0.07)',
  },
  otonio: {
    extra: 'sepia(0.18) saturate(1.04) hue-rotate(-8deg) brightness(0.98)',
    tinte: 'rgba(200, 110, 40, 0.08)',
  },
  invierno: {
    extra: 'saturate(0.84) hue-rotate(6deg) brightness(0.98)',
    tinte: 'rgba(110, 160, 230, 0.07)',
  },
};

export function paletaMapa(momento: MomentoDia, estacion: Estacion): PaletaMapa {
  const m = BASE_MOMENTO[momento];
  const e = BASE_ESTACION[estacion];
  return {
    filtro: `${m.filtro} ${e.extra}`,
    tinte: m.tinte,
    tinteAmbiente: e.tinte,
    fondo: m.fondo,
    vineta: m.vineta,
    claro: m.claro,
  };
}
