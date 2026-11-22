/** Iconos pixel-art de POI (SVG propio, offline y sin dependencias). */
const TINTA = '#12121A';
const ORO = '#FFD23F';
const ORO_OSCURO = '#C99A16';
const HUESO = '#F2E8C9';

const svg = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${inner}</svg>`;

const px = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

const ICONO_POI: Record<string, { fondo: string; borde: string }> = {
  farmacia: { fondo: '#1E7A4F', borde: '#0B3D26' },
  salud: { fondo: '#B3323B', borde: '#5E161C' },
  banco: { fondo: '#1B5E20', borde: '#0C2F10' },
  'registro-civil': { fondo: '#2E5AA8', borde: '#142C58' },
  municipalidad: { fondo: '#8A5A1E', borde: '#4A2E0C' },
  oficina: { fondo: '#5A4A8A', borde: '#2C2350' },
};

/** Icono de lugar con su tipo visible (farmacia, salud, trámites…). */
export function poiSvg(categoria: string): string {
  const c = ICONO_POI[categoria] ?? ICONO_POI.oficina;
  const base = [
    px(0, 0, 16, 16, TINTA),
    px(1, 1, 14, 14, c.fondo),
    px(1, 1, 14, 1, c.borde),
    px(1, 14, 14, 1, c.borde),
  ];
  let glifo: string[] = [];
  if (categoria === 'farmacia') {
    glifo = [px(6, 3, 4, 10, HUESO), px(3, 6, 10, 4, HUESO)];
  } else if (categoria === 'salud') {
    glifo = [
      px(4, 3, 3, 2, HUESO), px(9, 3, 3, 2, HUESO),
      px(3, 5, 10, 3, HUESO), px(5, 8, 6, 2, HUESO), px(7, 10, 2, 2, HUESO),
      px(7, 5, 2, 4, c.fondo), px(6, 6, 4, 2, c.fondo),
    ];
  } else if (categoria === 'banco') {
    glifo = [
      px(2, 5, 12, 7, HUESO),
      px(2, 5, 12, 1, c.borde),
      px(2, 11, 12, 1, c.borde),
      px(3, 7, 1, 1, c.borde), px(12, 9, 1, 1, c.borde),
      px(6, 6, 4, 1, ORO), px(5, 7, 6, 3, ORO),
      px(6, 10, 4, 1, ORO), px(7, 8, 2, 1, ORO_OSCURO),
    ];
  } else if (categoria === 'registro-civil') {
    glifo = [
      px(3, 2, 10, 12, HUESO),
      px(4, 3, 3, 4, c.borde), px(8, 4, 4, 1, c.borde), px(8, 6, 4, 1, c.borde),
      px(4, 9, 8, 1, c.borde), px(4, 11, 6, 1, c.borde),
    ];
  } else if (categoria === 'municipalidad') {
    glifo = [
      px(4, 1, 8, 2, HUESO), px(2, 3, 12, 2, HUESO),
      px(3, 5, 10, 8, HUESO),
      px(4, 6, 2, 6, c.borde), px(7, 6, 2, 6, c.borde), px(10, 6, 2, 6, c.borde),
      px(2, 13, 12, 2, HUESO),
    ];
  } else {
    glifo = [
      px(6, 2, 4, 2, HUESO), px(2, 5, 12, 2, HUESO),
      px(3, 7, 10, 6, HUESO), px(7, 8, 2, 2, c.fondo), px(7, 9, 2, 1, HUESO),
    ];
  }
  return svg([...base, ...glifo].join(''));
}
