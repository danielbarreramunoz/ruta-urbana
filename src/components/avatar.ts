/**
 * Avatar pixel-art paramétrico (20×24).
 * Sin contornos negros: cada borde usa un tono oscurecido de la propia prenda.
 * La silueta cambia con `sexo` (hombros, cintura y caderas) sin bloquear prendas.
 */
import { cosmeticById } from '../game/data';
import type { CosmeticItem, CosmeticSlot, Equipamiento, Sexo } from '../game/types';

const PIEL = '#F2C9A0';
const PIEL_SOMBRA = '#D9A87C';
const OJO = '#3E2A26';
const CEJA = '#8A5A45';
const BOCA = '#B4635A';

const px = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

/** Aclara u oscurece un color hex multiplicando sus canales. */
function tono(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const canal = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const r = canal((n >> 16) & 255);
  const g = canal((n >> 8) & 255);
  const b = canal(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const aclarar = (hex: string, f = 1.2) => tono(hex, f);
const oscurecer = (hex: string, f = 0.7) => tono(hex, f);

const prenda = (equipado: Equipamiento, slot: CosmeticSlot): CosmeticItem | undefined => {
  const id = equipado[slot];
  return id ? cosmeticById.get(id) : undefined;
};

/* ── Capas de atrás hacia adelante ─────────────────────────────────────────── */

function mochila(it?: CosmeticItem): string {
  if (!it) return '';
  const c = it.color ?? '#C23B3B';
  return [
    px(2, 12, 2, 7, oscurecer(c, 0.55)),
    px(16, 12, 2, 7, oscurecer(c, 0.55)),
    px(2, 13, 1, 5, c),
    px(17, 13, 1, 5, oscurecer(c, 0.8)),
    px(2, 13, 1, 1, aclarar(c, 1.15)),
  ].join('');
}

function peloTrasero(it?: CosmeticItem): string {
  if (!it) return '';
  const c = it.color ?? '#3A2A22';
  if (it.estilo === 'largo') return px(4, 2, 1, 8, oscurecer(c, 0.85)) + px(15, 2, 1, 8, oscurecer(c, 0.85));
  return '';
}

function piernas(it?: CosmeticItem): string {
  const c = it?.color ?? '#2B3450';
  const estilo = it?.estilo ?? 'jeans';
  const sombra = oscurecer(c, 0.72);
  if (estilo === 'falda') {
    return [
      px(7, 20, 2, 2, PIEL),
      px(11, 20, 2, 2, PIEL),
      px(6, 17, 8, 1, aclarar(c, 1.1)),
      px(5, 18, 10, 2, c),
      px(5, 20, 10, 1, sombra),
      px(5, 18, 1, 3, sombra),
      px(14, 18, 1, 3, sombra),
    ].join('');
  }
  const out = [
    px(6, 18, 3, 4, c),
    px(11, 18, 3, 4, c),
    px(6, 18, 3, 1, aclarar(c, 1.12)),
    px(11, 18, 3, 1, aclarar(c, 1.12)),
    px(8, 19, 1, 3, sombra),
    px(11, 19, 1, 3, sombra),
  ];
  if (estilo === 'cargo') out.push(px(6, 20, 1, 1, sombra), px(12, 20, 1, 1, sombra));
  if (estilo === 'buzo') out.push(px(6, 21, 2, 1, aclarar(c, 1.3)), px(11, 21, 2, 1, aclarar(c, 1.3)));
  return out.join('');
}

function zapatos(it?: CosmeticItem): string {
  const c = it?.color ?? '#7A5230';
  const estilo = it?.estilo ?? 'botas';
  const suela =
    estilo === 'zapatillas' ? oscurecer(c, 0.5) : estilo === 'formales' ? aclarar(c, 1.6) : oscurecer(c, 0.55);
  const out: string[] = [];
  if (estilo === 'altas') {
    out.push(
      px(6, 19, 3, 3, c),
      px(11, 19, 3, 3, c),
      px(6, 19, 1, 3, aclarar(c, 1.15)),
      px(11, 19, 1, 3, aclarar(c, 1.15)),
      px(6, 21, 3, 1, oscurecer(c, 0.75)),
      px(11, 21, 3, 1, oscurecer(c, 0.75)),
    );
  }
  out.push(
    px(5, 21, 4, 1, oscurecer(c, 0.75)),
    px(11, 21, 4, 1, oscurecer(c, 0.75)),
    px(5, 22, 4, 1, c),
    px(11, 22, 4, 1, c),
    px(4, 23, 5, 1, suela),
    px(11, 23, 5, 1, suela),
  );
  return out.join('');
}

/** Filas del torso: hombros/cintura/caderas cambian según el cuerpo. */
function filasTorso(sexo: Sexo): { y: number; x: number; w: number }[] {
  if (sexo === 'f') {
    return [
      { y: 9, x: 6, w: 8 },
      { y: 10, x: 6, w: 8 },
      { y: 11, x: 6, w: 8 },
      { y: 12, x: 6, w: 8 },
      { y: 13, x: 7, w: 6 },
      { y: 14, x: 7, w: 6 },
      { y: 15, x: 6, w: 8 },
      { y: 16, x: 6, w: 8 },
      { y: 17, x: 6, w: 8 },
    ];
  }
  return [
    { y: 9, x: 5, w: 10 },
    { y: 10, x: 5, w: 10 },
    { y: 11, x: 6, w: 8 },
    { y: 12, x: 6, w: 8 },
    { y: 13, x: 6, w: 8 },
    { y: 14, x: 6, w: 8 },
    { y: 15, x: 6, w: 8 },
    { y: 16, x: 6, w: 8 },
    { y: 17, x: 6, w: 8 },
  ];
}

function torso(it: CosmeticItem | undefined, sexo: Sexo): string {
  const c = it?.color ?? '#6A6AD4';
  const estilo = it?.estilo ?? 'polera';
  const luz = aclarar(c, 1.16);
  const sombra = oscurecer(c, 0.72);
  const out = filasTorso(sexo).map(
    (f, i) => px(f.x, f.y, f.w, 1, i === 0 ? luz : c) + px(f.x + f.w - 1, f.y, 1, 1, sombra),
  );

  if (estilo === 'camisa') {
    out.push(px(8, 9, 4, 1, '#F2E8C9'), px(10, 10, 1, 7, aclarar(c, 1.1)), px(10, 12, 1, 1, '#F2E8C9'));
  } else if (estilo === 'blusa') {
    out.push(px(8, 9, 4, 1, '#F2E8C9'), px(9, 9, 2, 1, PIEL), px(9, 10, 2, 1, aclarar(c, 1.3)));
  } else if (estilo === 'cuero') {
    out.push(px(8, 9, 4, 1, sombra), px(10, 10, 1, 7, '#B8BCC8'));
  } else if (estilo === 'parka') {
    out.push(px(6, 9, 8, 1, '#F2E8C9'), px(7, 13, 2, 1, sombra), px(11, 13, 2, 1, sombra));
  } else if (estilo === 'vestido') {
    out.push(
      px(7, 15, 6, 1, oscurecer(c, 0.82)),
      px(5, 18, 10, 1, c),
      px(4, 19, 12, 2, c),
      px(4, 21, 12, 1, oscurecer(c, 0.78)),
      px(4, 19, 1, 2, aclarar(c, 1.1)),
      px(15, 19, 1, 2, sombra),
    );
  } else if (estilo === 'entallada') {
    out.push(px(7, 15, 6, 1, oscurecer(c, 0.85)));
  }
  return out.join('');
}

function brazos(it: CosmeticItem | undefined, conMochila: boolean): string {
  const c = it?.color ?? '#6A6AD4';
  const estilo = it?.estilo ?? 'polera';
  const osc = oscurecer(c, 0.62);
  const largo = !['polera', 'entallada', 'vestido'].includes(estilo);
  const out = [px(4, 10, 2, 8, PIEL), px(14, 10, 2, 8, PIEL)];
  if (estilo === 'vestido') {
    out.push(px(4, 9, 2, 1, aclarar(c, 1.1)), px(14, 9, 2, 1, aclarar(c, 1.1)));
  } else if (largo) {
    out.push(px(4, 10, 2, 7, osc), px(14, 10, 2, 7, osc));
    out.push(px(4, 10, 1, 7, oscurecer(c, 0.55)), px(15, 10, 1, 7, oscurecer(c, 0.55)));
    out.push(px(4, 16, 2, 1, aclarar(c, 1.1)), px(14, 16, 2, 1, aclarar(c, 1.1)));
  } else {
    out.push(px(4, 10, 2, 3, osc), px(14, 10, 2, 3, osc));
    out.push(px(4, 10, 1, 3, oscurecer(c, 0.55)), px(15, 10, 1, 3, oscurecer(c, 0.55)));
  }
  out.push(px(4, 17, 2, 1, PIEL_SOMBRA), px(14, 17, 2, 1, PIEL_SOMBRA));
  if (conMochila) out.push(px(8, 10, 1, 7, '#2E2630'), px(11, 10, 1, 7, '#2E2630'));
  return out.join('');
}

function tatuaje(it?: CosmeticItem): string {
  if (!it) return '';
  const c = it.color ?? '#3D6FC4';
  if (it.estilo === 'brazo') return px(4, 13, 1, 1, c) + px(5, 14, 1, 1, c) + px(14, 13, 1, 1, c);
  return px(7, 8, 1, 1, c) + px(12, 8, 1, 1, c);
}

function cabeza(sexo: Sexo): string {
  const out = [
    px(6, 2, 8, 6, PIEL),
    px(6, 7, sexo === 'f' ? 6 : 8, 1, PIEL_SOMBRA),
    px(5, 4, 1, 2, PIEL),
    px(14, 4, 1, 2, PIEL),
    px(7, 3, 2, 1, CEJA),
    px(11, 3, 2, 1, CEJA),
    px(7, 4, 1, 1, OJO),
    px(11, 4, 1, 1, OJO),
    px(9, 5, 2, 1, PIEL_SOMBRA),
    px(9, 6, 2, 1, BOCA),
    px(9, 8, 2, 1, PIEL_SOMBRA),
  ];
  if (sexo === 'f') out.push(px(6, 4, 1, 1, OJO), px(13, 4, 1, 1, OJO));
  return out.join('');
}

function barba(it?: CosmeticItem): string {
  if (!it) return '';
  const c = it.color ?? '#3A2A22';
  const osc = oscurecer(c, 0.8);
  if (it.estilo === 'bigote') return px(8, 5, 4, 1, c) + px(7, 5, 1, 1, osc) + px(12, 5, 1, 1, osc);
  if (it.estilo === 'corta') {
    return px(6, 6, 1, 3, c) + px(13, 6, 1, 3, c) + px(7, 7, 6, 1, c);
  }
  if (it.estilo === 'larga') {
    return px(6, 6, 1, 3, c) + px(13, 6, 1, 3, c) + px(7, 7, 6, 1, c) + px(7, 8, 6, 1, c) + px(8, 8, 4, 1, aclarar(c, 1.2));
  }
  return '';
}

function peloFrente(it?: CosmeticItem): string {
  if (!it) return '';
  const c = it.color ?? '#3A2A22';
  const luz = aclarar(c, 1.22);
  const osc = oscurecer(c, 0.82);
  const corto = px(5, 0, 10, 2, c) + px(5, 3, 1, 2, osc) + px(14, 3, 1, 2, osc) + px(7, 0, 5, 1, luz);
  if (it.estilo === 'rapado') return px(6, 1, 8, 1, c) + px(6, 2, 8, 1, osc);
  if (it.estilo === 'afro') {
    return px(4, 0, 12, 2, c) + px(4, 1, 2, 4, c) + px(14, 1, 2, 4, c) + px(6, 0, 6, 1, luz) + px(4, 1, 1, 3, osc);
  }
  if (it.estilo === 'largo') return corto + px(5, 3, 1, 6, c) + px(14, 3, 1, 6, c);
  if (it.estilo === 'colita') {
    return corto + px(15, 1, 2, 1, c) + px(16, 2, 1, 3, c) + px(15, 5, 1, 2, osc) + px(16, 1, 1, 1, luz);
  }
  if (it.estilo === 'flequillo') {
    return px(5, 0, 10, 2, c) + px(5, 2, 5, 1, c) + px(11, 2, 4, 1, c) + px(5, 3, 1, 3, osc) + px(14, 3, 1, 3, osc) + px(7, 0, 4, 1, luz);
  }
  return corto;
}

function lentes(it?: CosmeticItem): string {
  if (!it) return '';
  const c = it.color ?? '#C99A16';
  if (it.estilo === 'sol') {
    return px(6, 3, 3, 2, '#26232C') + px(11, 3, 3, 2, '#26232C') + px(9, 4, 2, 1, c) + px(6, 3, 1, 1, '#4A4A5A');
  }
  if (it.estilo === 'redondos') {
    return (
      px(6, 3, 3, 1, c) +
      px(11, 3, 3, 1, c) +
      px(6, 4, 3, 2, '#8CC0FF') +
      px(11, 4, 3, 2, '#8CC0FF') +
      px(9, 4, 2, 1, c) +
      px(7, 4, 1, 1, OJO) +
      px(11, 4, 1, 1, OJO)
    );
  }
  return px(6, 3, 3, 2, '#8CC0FF') + px(11, 3, 3, 2, '#8CC0FF') + px(9, 4, 2, 1, c) + px(7, 4, 1, 1, OJO) + px(11, 4, 1, 1, OJO);
}

function aros(it?: CosmeticItem): string {
  if (!it) return '';
  const c = it.color ?? '#C0C0C8';
  if (it.estilo === 'perla') return px(4, 4, 1, 1, c) + px(15, 4, 1, 1, c) + px(4, 5, 1, 1, oscurecer(c, 0.75)) + px(15, 5, 1, 1, oscurecer(c, 0.75));
  return px(4, 5, 1, 2, c) + px(15, 5, 1, 2, c) + px(4, 5, 1, 1, aclarar(c, 1.4));
}

function gorro(it?: CosmeticItem): string {
  if (!it) return '';
  const c = it.color ?? '#FFD23F';
  const osc = oscurecer(c, 0.7);
  const luz = aclarar(c, 1.3);
  if (it.estilo === 'capucha') {
    return [
      px(4, 9, 12, 2, c),
      px(4, 11, 12, 1, osc),
      px(3, 0, 3, 3, c),
      px(14, 0, 3, 3, c),
      px(4, 0, 12, 2, c),
      px(2, 2, 2, 5, c),
      px(16, 2, 2, 5, c),
      px(4, 2, 2, 5, osc),
      px(14, 2, 2, 5, osc),
      px(6, 2, 8, 1, osc),
      px(3, 0, 1, 1, luz),
      px(16, 0, 1, 1, luz),
    ].join('');
  }
  if (it.estilo === 'lana') {
    return px(5, 0, 10, 2, c) + px(4, 2, 12, 1, osc) + px(6, 0, 2, 1, luz) + px(7, 2, 1, 1, aclarar(c, 1.1)) + px(10, 2, 1, 1, aclarar(c, 1.1)) + px(13, 2, 1, 1, aclarar(c, 1.1));
  }
  if (it.estilo === 'jockey') {
    return px(5, 0, 10, 2, c) + px(4, 2, 12, 1, osc) + px(12, 2, 5, 1, osc) + px(6, 0, 4, 1, luz);
  }
  return px(5, 0, 10, 2, c) + px(4, 2, 12, 1, osc) + px(8, 0, 4, 1, aclarar(c, 1.35)) + px(9, 0, 2, 1, '#FFFFFF');
}

/** Avatar completo. Devuelve string SVG. */
export function avatarSvg(equipado: Equipamiento, sexo: Sexo = 'm', ancho = 40, alto = 48): string {
  const moch = prenda(equipado, 'mochila');
  const capa = [
    mochila(moch),
    peloTrasero(prenda(equipado, 'pelo')),
    piernas(prenda(equipado, 'pantalon')),
    zapatos(prenda(equipado, 'zapatos')),
    torso(prenda(equipado, 'ropa'), sexo),
    brazos(prenda(equipado, 'ropa'), !!moch),
    tatuaje(prenda(equipado, 'tatuaje')),
    cabeza(sexo),
    barba(prenda(equipado, 'barba')),
    peloFrente(prenda(equipado, 'pelo')),
    lentes(prenda(equipado, 'lentes')),
    aros(prenda(equipado, 'aros')),
    gorro(prenda(equipado, 'gorro')),
  ].join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 24" width="${ancho}" height="${alto}" shape-rendering="crispEdges">${capa}</svg>`;
}
