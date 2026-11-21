/**
 * Sprites pixel-art dibujados a mano (SVG con crispEdges).
 * Sin assets externos: nítidos a cualquier escala, offline, licencia propia.
 * Paleta alineada a src/index.css (ruta.*).
 */
import { avatarSvg } from './avatar';
import type { Equipamiento, Sexo } from '../game/types';

const PIEL = '#F2C9A0';
const PIEL_SOMBRA = '#D9A87C';
const TINTA = '#12121A';
const ORO = '#FFD23F';
const ORO_OSCURO = '#C99A16';
const ROJO = '#FF5D5D';
const VERDE = '#7CFC5A';
const HUESO = '#F2E8C9';
const GRIS = '#9AA0B2';
const LINEA = '#2E2E3E';

const svg = (inner: string, viewBox = '0 0 16 16', extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" shape-rendering="crispEdges" ${extra}>${inner}</svg>`;

const px = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

/* ────────────────────────────── AVATAR (20×24) ────────────────────────────── */

// El avatar ahora es paramétrico según lo equipado: ver `src/components/avatar.ts`.
// `avatarSvg(equipado)` compone pelo, gorro, lentes, barba, ropa, pantalón,
// zapatos, aros, tatuajes y mochila con los colores de `cosmetics.json`.

/* ────────────────────────────── RETRATOS NPC (16×16) ────────────────────────────── */

/** Marco RPG de 16 bits: doble borde con esquinas recortadas. */
const marco = (inner: string, acento = ORO) => svg(
  [
    px(0, 0, 16, 16, TINTA),
    px(1, 1, 14, 14, acento === ORO ? '#2A2416' : LINEA),
    px(2, 2, 12, 12, '#171720'),
    inner,
    // borde interior luminoso
    px(2, 2, 12, 1, acento),
    px(2, 13, 12, 1, acento),
    px(2, 2, 1, 12, acento),
    px(13, 2, 1, 12, acento),
    // remaches de esquina
    px(0, 0, 1, 1, HUESO),
    px(15, 0, 1, 1, HUESO),
    px(0, 15, 1, 1, HUESO),
    px(15, 15, 1, 1, HUESO),
  ].join(''),
);

const RETRATOS: Record<string, string> = {
  // Don Tito: canoso, lentes, camisa institucional.
  'don-tito': marco(
    [
      px(4, 4, 8, 9, PIEL),
      px(4, 12, 8, 1, PIEL_SOMBRA),
      // pelo canoso con entradas
      px(3, 2, 10, 3, '#D8D8D8'),
      px(3, 4, 1, 4, '#D8D8D8'),
      px(12, 4, 1, 4, '#D8D8D8'),
      px(5, 2, 2, 1, '#AFAFAF'),
      // lentes
      px(5, 6, 3, 2, '#0B0B12'),
      px(9, 6, 3, 2, '#0B0B12'),
      px(8, 6, 1, 2, '#5A5A66'),
      px(6, 6, 1, 1, '#8CC0FF'),
      px(10, 6, 1, 1, '#8CC0FF'),
      // bigote y boca
      px(6, 9, 4, 1, '#8A8A8A'),
      px(7, 11, 2, 1, '#8A5A4A'),
      // camisa + corbata
      px(3, 13, 10, 3, '#3A5A8C'),
      px(7, 13, 2, 3, '#7A2A2A'),
      px(3, 13, 10, 1, '#4E76B0'),
    ].join(''),
  ),
  // Ana la Tens: pelo con volumen, delantal de farmacia.
  'ana-tens': marco(
    [
      px(4, 4, 8, 9, PIEL),
      px(4, 12, 8, 1, PIEL_SOMBRA),
      // cabello castaño
      px(2, 3, 12, 6, '#3A2A22'),
      px(2, 9, 2, 4, '#3A2A22'),
      px(12, 9, 2, 4, '#3A2A22'),
      px(4, 3, 8, 2, '#5A4034'),
      // flequillo
      px(4, 5, 8, 1, '#3A2A22'),
      // ojos
      px(5, 7, 1, 1, TINTA),
      px(10, 7, 1, 1, TINTA),
      px(12, 7, 1, 1, '#FFFFFF'),
      // mejillas y boca
      px(5, 9, 1, 1, '#E89A8A'),
      px(10, 9, 1, 1, '#E89A8A'),
      px(7, 10, 2, 1, '#B4635A'),
      // delantal verde farmacia
      px(3, 13, 10, 3, '#2E8C6A'),
      px(3, 13, 10, 1, '#3FB98C'),
      px(7, 13, 2, 2, HUESO),
    ].join(''),
  ),
  // Seba: gorro, sonrisa, polera de trabajo.
  seba: marco(
    [
      px(4, 4, 8, 9, PIEL),
      px(4, 12, 8, 1, PIEL_SOMBRA),
      // gorro
      px(2, 2, 12, 3, ORO),
      px(2, 5, 12, 1, ORO_OSCURO),
      px(12, 5, 5, 1, ORO),
      px(4, 2, 8, 1, '#FFE887'),
      // pelo lateral
      px(3, 5, 1, 4, '#3A3A3A'),
      px(12, 5, 1, 4, '#3A3A3A'),
      // ojos
      px(5, 7, 1, 1, TINTA),
      px(10, 7, 1, 1, TINTA),
      // sonrisa
      px(7, 10, 2, 1, TINTA),
      px(6, 9, 1, 1, TINTA),
      px(9, 9, 1, 1, TINTA),
      // polera
      px(3, 13, 10, 3, '#6A6AD4'),
      px(3, 13, 10, 1, '#8A8AE8'),
    ].join(''),
  ),
  // Vecino genérico (misiones comunitarias).
  vecino: marco(
    [
      px(4, 4, 8, 9, PIEL),
      px(4, 12, 8, 1, PIEL_SOMBRA),
      px(3, 3, 10, 3, '#6B4A3A'),
      px(5, 6, 1, 1, TINTA),
      px(10, 6, 1, 1, TINTA),
      px(7, 9, 2, 1, '#8A5A4A'),
      px(3, 13, 10, 3, '#4A6A4A'),
    ].join(''),
    GRIS,
  ),
};

export const retratoSvg = (id: string): string =>
  RETRATOS[id] ?? RETRATOS.vecino;

/* ────────────────────────────── PINES DE MAPA ────────────────────────────── */

export type PinEstado = 'activa' | 'disponible' | 'completada' | 'sensible';

/**
 * Pin tipo gota con glifo. La activa pulsa (CSS .ru-pin--activa).
 * Sensible usa un rombo violeta con "?" para no delatar el lugar.
 */
export function pinSvg(estado: PinEstado): string {
  const activa = estado === 'activa';
  const hecha = estado === 'completada';
  const sensible = estado === 'sensible';
  const borde = activa ? ORO : hecha ? VERDE : sensible ? '#B07CFF' : GRIS;
  const relleno = activa ? '#241E10' : hecha ? '#12210F' : sensible ? '#1E1630' : '#1A1A24';
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" shape-rendering="crispEdges" width="24" height="32">
  <rect x="9" y="29" width="6" height="3" fill="rgba(0,0,0,0.45)"/>
  <path d="M12 1 C6.5 1 3 5 3 10.5 C3 16 8 21 12 30 C16 21 21 16 21 10.5 C21 5 17.5 1 12 1 Z" fill="${TINTA}"/>
  <path d="M12 3 C7.6 3 5 6.2 5 10.4 C5 15 9 19.6 12 26.6 C15 19.6 19 15 19 10.4 C19 6.2 16.4 3 12 3 Z" fill="${borde}"/>
  <path d="M12 5 C8.8 5 7 7.4 7 10.4 C7 14 10 17.8 12 22.4 C14 17.8 17 14 17 10.4 C17 7.4 15.2 5 12 5 Z" fill="${relleno}"/>
  <rect x="9" y="6" width="6" height="1" fill="${borde}" opacity="0.55"/>
</svg>`;
}

/** Glifo del pin como texto SVG aparte (para nitidez del carácter). */
export function pinGlifo(estado: PinEstado): string {
  return estado === 'completada' ? '✓' : estado === 'sensible' ? '?' : '!';
}

/* ────────────────────────────── ICONOS DE ATRIBUTO ────────────────────────────── */

const ICONOS_ATR: Record<string, string> = {
  // Carisma: máscara/boca sonriente
  carisma: [
    px(3, 5, 10, 7, '#FFB347'),
    px(4, 6, 8, 2, '#7A4A10'),
    px(5, 9, 6, 1, '#7A4A10'),
    px(3, 12, 2, 1, '#FFB347'),
    px(11, 12, 2, 1, '#FFB347'),
  ].join(''),
  // Valentía: llama
  valentia: [
    px(7, 1, 2, 3, '#FF5D5D'),
    px(5, 4, 6, 3, '#FF5D5D'),
    px(4, 7, 8, 5, '#FF5D5D'),
    px(6, 6, 4, 4, '#FFB347'),
    px(7, 8, 2, 3, ORO),
  ].join(''),
  // Burocracia: documento con líneas
  burocracia: [
    px(4, 1, 8, 14, '#6AA8FF'),
    px(4, 1, 8, 1, '#9CC6FF'),
    px(6, 4, 4, 1, '#FFFFFF'),
    px(6, 6, 4, 1, '#FFFFFF'),
    px(6, 8, 4, 1, '#FFFFFF'),
    px(6, 10, 2, 1, '#FFFFFF'),
    px(4, 13, 8, 2, '#3D6FC4'),
  ].join(''),
  // Supervivencia: mochila
  supervivencia: [
    px(7, 2, 2, 2, '#2E8C4A'),
    px(4, 4, 8, 9, '#7CFC5A'),
    px(4, 6, 8, 2, '#2E8C4A'),
    px(6, 9, 4, 3, '#1E6A34'),
    px(4, 13, 3, 2, '#2E8C4A'),
    px(9, 13, 3, 2, '#2E8C4A'),
  ].join(''),
};

export const attrSvg = (key: string): string =>
  svg(ICONOS_ATR[key] ?? px(4, 4, 8, 8, GRIS), '0 0 16 16');

/** Iconos de UI (16×16) para chips y botones. */
const UI: Record<string, string> = {
  gps: [
    px(1, 7, 14, 2, VERDE),
    px(7, 1, 2, 14, VERDE),
    px(5, 5, 6, 6, '#0D0D14'),
    px(6, 6, 4, 4, VERDE),
  ].join(''),
  joystick: [
    px(6, 1, 4, 2, GRIS),
    px(7, 3, 2, 5, GRIS),
    px(3, 8, 10, 6, '#3A3A4D'),
    px(6, 10, 4, 2, ORO),
  ].join(''),
  fog: [
    px(1, 6, 14, 6, '#6E6E8C'),
    px(3, 4, 4, 2, '#8A8AA8'),
    px(9, 8, 4, 2, '#8A8AA8'),
  ].join(''),
  coins: [
    px(3, 3, 10, 10, '#8A6510'),
    px(4, 4, 8, 8, ORO),
    px(5, 5, 2, 2, '#FFE887'),
    px(9, 9, 2, 2, ORO_OSCURO),
  ].join(''),
  xp: [
    px(7, 0, 2, 6, ORO),
    px(7, 10, 2, 6, ORO),
    px(0, 7, 6, 2, ORO),
    px(10, 7, 6, 2, ORO),
    px(6, 6, 4, 4, '#FFE887'),
  ].join(''),
  soundOn: [
    px(2, 6, 3, 4, HUESO),
    px(5, 4, 2, 8, HUESO),
    px(9, 5, 1, 6, GRIS),
    px(11, 3, 1, 10, GRIS),
  ].join(''),
  soundOff: [
    px(2, 6, 3, 4, HUESO),
    px(5, 4, 2, 8, HUESO),
    px(9, 5, 6, 1, ROJO),
    px(9, 10, 6, 1, ROJO),
  ].join(''),
  bell: [
    px(6, 2, 4, 1, ORO),
    px(4, 3, 8, 7, ORO),
    px(3, 10, 10, 2, ORO_OSCURO),
    px(7, 13, 2, 1, ORO),
  ].join(''),
  sol: [
    px(6, 6, 4, 4, ORO),
    px(7, 1, 2, 2, ORO),
    px(7, 13, 2, 2, ORO),
    px(1, 7, 2, 2, ORO),
    px(13, 7, 2, 2, ORO),
    px(3, 3, 2, 2, ORO),
    px(11, 3, 2, 2, ORO),
    px(3, 11, 2, 2, ORO),
    px(11, 11, 2, 2, ORO),
  ].join(''),
  luna: [
    px(9, 1, 4, 2, HUESO),
    px(11, 3, 4, 10, HUESO),
    px(9, 13, 4, 2, HUESO),
    px(7, 3, 3, 10, '#3A3A4D'),
    px(9, 5, 2, 6, HUESO),
  ].join(''),
  atardecer: [
    px(6, 2, 4, 1, '#FF8A3D'),
    px(5, 4, 6, 2, '#FF8A3D'),
    px(4, 6, 8, 2, '#FFB347'),
    px(1, 9, 14, 1, ORO_OSCURO),
    px(2, 11, 3, 1, '#6E6E8C'),
    px(7, 11, 3, 1, '#6E6E8C'),
    px(11, 11, 2, 1, '#6E6E8C'),
  ].join(''),
  madrugada: [
    px(8, 1, 5, 2, '#9CC6FF'),
    px(10, 3, 4, 8, '#9CC6FF'),
    px(8, 11, 5, 2, '#9CC6FF'),
    px(6, 3, 3, 8, '#0D0D14'),
    px(2, 3, 1, 1, HUESO),
    px(3, 6, 1, 1, HUESO),
    px(1, 9, 1, 1, HUESO),
  ].join(''),
  target: [
    px(6, 1, 4, 1, ORO),
    px(6, 14, 4, 1, ORO),
    px(1, 6, 1, 4, ORO),
    px(14, 6, 1, 4, ORO),
    px(7, 7, 2, 2, ORO),
  ].join(''),
};

export const uiSvg = (key: string): string => svg(UI[key] ?? px(6, 6, 4, 4, GRIS));

/** Wrapper React para los SVG string (solo sprites propios). */
export function Sprite({ svg: html, size = 14, titulo }: { svg: string; size?: number; titulo?: string }) {
  return (
    <span
      title={titulo}
      aria-hidden={titulo ? undefined : true}
      style={{ display: 'inline-flex', width: size, height: size, flex: 'none' }}
      dangerouslySetInnerHTML={{ __html: html.replace('<svg ', `<svg width="${size}" height="${size}" `) }}
    />
  );
}

/** Avatar con el equipamiento puesto, respetando la proporción 20:24. */
export function Avatar({
  equipado,
  sexo = 'm',
  alto = 96,
  titulo,
}: {
  equipado: Equipamiento;
  sexo?: Sexo;
  alto?: number;
  titulo?: string;
}) {
  const ancho = Math.round((alto * 20) / 24);
  return (
    <span
      title={titulo}
      style={{ display: 'inline-flex', width: ancho, height: alto, flex: 'none' }}
      dangerouslySetInnerHTML={{ __html: avatarSvg(equipado, sexo, ancho, alto) }}
    />
  );
}
