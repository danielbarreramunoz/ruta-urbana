/** Sprites pixel-art dibujados a mano (SVG 16x16, crispEdges).
 *  Sin assets externos: nítidos a cualquier escala y funcionan offline.
 *  Se exportan como strings para usar en Leaflet divIcon y como componentes React.
 */

// Utilidad: envuelve un contenido 16x16 en svg.
const svg = (inner: string, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges" ${extra}>${inner}</svg>`;

const PIEL = '#F2C9A0';
const TINTA = '#1A1A24';

/** Joven con capucha y mochila (vista frontal). */
export const AVATAR_SVG = svg(`
  <rect x="4" y="1" width="8" height="7" fill="#FFD23F"/>
  <rect x="5" y="3" width="6" height="4" fill="${PIEL}"/>
  <rect x="6" y="4" width="1" height="1" fill="${TINTA}"/>
  <rect x="9" y="4" width="1" height="1" fill="${TINTA}"/>
  <rect x="3" y="8" width="10" height="7" fill="#6AA8FF"/>
  <rect x="7" y="8" width="2" height="7" fill="#4A6FD4"/>
  <rect x="1" y="9" width="2" height="5" fill="#FF5D5D"/>
  <rect x="13" y="9" width="2" height="5" fill="#FF5D5D"/>
`);

/** Marco RPG para retratos. */
const marco = (inner: string) => svg(`
  <rect width="16" height="16" fill="#1A1A24"/>
  <rect x="1" y="1" width="14" height="14" fill="#F2E8C9"/>
  ${inner}
  <rect x="0" y="0" width="16" height="1" fill="#2E2E3E"/>
  <rect x="0" y="15" width="16" height="1" fill="#2E2E3E"/>
  <rect x="0" y="0" width="1" height="16" fill="#2E2E3E"/>
  <rect x="15" y="0" width="1" height="16" fill="#2E2E3E"/>
`);

const RETRATOS: Record<string, string> = {
  'don-tito': marco(`
    <rect x="4" y="4" width="8" height="8" fill="${PIEL}"/>
    <rect x="3" y="3" width="10" height="2" fill="#C9C9C9"/>
    <rect x="3" y="3" width="2" height="6" fill="#C9C9C9"/>
    <rect x="11" y="3" width="2" height="6" fill="#C9C9C9"/>
    <rect x="5" y="6" width="1" height="1" fill="${TINTA}"/>
    <rect x="10" y="6" width="1" height="1" fill="${TINTA}"/>
    <rect x="6" y="9" width="4" height="1" fill="#5A5A5A"/>
    <rect x="4" y="12" width="8" height="3" fill="#3A5A8C"/>
  `),
  'ana-tens': marco(`
    <rect x="4" y="4" width="8" height="8" fill="${PIEL}"/>
    <rect x="3" y="2" width="10" height="4" fill="#3A2E2E"/>
    <rect x="11" y="4" width="2" height="6" fill="#3A2E2E"/>
    <rect x="6" y="2" width="4" height="2" fill="#FFFFFF"/>
    <rect x="7" y="1" width="2" height="4" fill="#FF5D5D"/>
    <rect x="6" y="2" width="4" height="2" fill="#FF5D5D"/>
    <rect x="5" y="6" width="1" height="1" fill="${TINTA}"/>
    <rect x="10" y="6" width="1" height="1" fill="${TINTA}"/>
    <rect x="7" y="9" width="2" height="1" fill="#B46A6A"/>
    <rect x="4" y="12" width="8" height="3" fill="#2E8C6A"/>
  `),
  seba: marco(`
    <rect x="4" y="5" width="8" height="7" fill="${PIEL}"/>
    <rect x="3" y="2" width="10" height="3" fill="#FFD23F"/>
    <rect x="11" y="3" width="3" height="1" fill="#FFD23F"/>
    <rect x="3" y="5" width="1" height="4" fill="#3A3A3A"/>
    <rect x="12" y="5" width="1" height="4" fill="#3A3A3A"/>
    <rect x="5" y="7" width="1" height="1" fill="${TINTA}"/>
    <rect x="10" y="7" width="1" height="1" fill="${TINTA}"/>
    <rect x="6" y="10" width="4" height="1" fill="${TINTA}"/>
    <rect x="4" y="12" width="8" height="3" fill="#6A6AD4"/>
  `),
};

export const retratoSvg = (id: string): string =>
  RETRATOS[id] ??
  marco(`<rect x="4" y="4" width="8" height="8" fill="${PIEL}"/>`);

/** Pin de mapa estilo RPG (! activa, · discreta). */
export const pinSvg = (activo: boolean, sensible?: boolean): string =>
  svg(`
  <path d="M8 0 C4 0 2 3 2 6 C2 10 8 16 8 16 C8 16 14 10 14 6 C14 3 12 0 8 0 Z"
    fill="${activo ? '#1A1A24' : 'rgba(26,26,36,0.9)'}"
    stroke="${activo ? '#FFD23F' : '#2E2E3E'}" stroke-width="1"/>
  <rect x="7" y="4" width="2" height="2" fill="${activo ? '#FFD23F' : '#9AA0B2'}"/>
  ${sensible ? '' : `<rect x="7" y="7" width="2" height="1" fill="${activo ? '#FFD23F' : '#9AA0B2'}"/>`}
`, 'width="30" height="30"');

const ICONOS_ATR: Record<string, string> = {
  carisma: `<rect x="3" y="6" width="10" height="6" fill="#FFB347"/><rect x="5" y="8" width="6" height="1" fill="${TINTA}"/><rect x="5" y="10" width="4" height="1" fill="${TINTA}"/><rect x="6" y="12" width="2" height="2" fill="#FFB347"/>`,
  valentia: `<rect x="7" y="2" width="2" height="3" fill="#FF5D5D"/><rect x="5" y="5" width="6" height="8" fill="#FF5D5D"/><rect x="7" y="7" width="2" height="4" fill="#FFD23F"/>`,
  burocracia: `<rect x="4" y="2" width="8" height="12" fill="#6AA8FF"/><rect x="6" y="4" width="4" height="1" fill="#FFFFFF"/><rect x="6" y="6" width="4" height="1" fill="#FFFFFF"/><rect x="6" y="8" width="4" height="1" fill="#FFFFFF"/><rect x="6" y="10" width="2" height="1" fill="#FFFFFF"/>`,
  supervivencia: `<rect x="3" y="5" width="10" height="8" fill="#7CFC5A"/><rect x="3" y="5" width="10" height="2" fill="#2E8C4A"/><rect x="7" y="3" width="2" height="2" fill="#2E8C4A"/>`,
};

export const attrSvg = (key: string): string =>
  svg(ICONOS_ATR[key] ?? `<rect x="4" y="4" width="8" height="8" fill="#9AA0B2"/>`, 'width="14" height="14"');

/** Wrapper React para los SVG string (dangerouslySetInnerHTML controlado: solo sprites propios). */
export function Sprite({ svg: html, size = 14, titulo }: { svg: string; size?: number; titulo?: string }) {
  return (
    <span
      title={titulo}
      style={{ display: 'inline-flex', width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: html.replace('<svg ', `<svg width="${size}" height="${size}" `) }}
    />
  );
}
