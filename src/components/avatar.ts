/**
 * Avatar pixel-art paramétrico (20×24).
 * Sin contornos negros: cada borde usa un tono oscurecido de la propia prenda.
 * La silueta cambia con `sexo` (hombros, cintura y caderas) sin bloquear prendas.
 */
import { cosmeticById } from '../game/data';
import type { CosmeticItem, CosmeticSlot, Equipamiento, Sexo } from '../game/types';

export type RumboAvatar = 'n' | 'e' | 's' | 'w';

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
  const osc = oscurecer(c, 0.55);
  const contorno = oscurecer(c, 0.35);
  const luz = aclarar(c, 1.2);
  return [
    // Mochila compacta, detrás del hombro izquierdo; silueta escalonada,
    // no sobresale por ambos lados como un objeto horizontal.
    px(4, 8, 3, 1, contorno),
    px(3, 9, 5, 1, contorno),
    px(2, 10, 6, 1, contorno),
    px(2, 11, 6, 4, contorno),
    px(3, 15, 5, 1, contorno),
    px(4, 16, 3, 1, contorno),
    px(4, 9, 3, 1, osc),
    px(3, 10, 4, 1, c),
    px(3, 11, 4, 3, c),
    px(4, 14, 3, 1, osc),
    px(3, 10, 1, 4, luz),
    // Bolsillo pequeño visible en el costado.
    px(3, 13, 2, 1, contorno),
    px(3, 14, 2, 1, osc),
  ].join('');
}

function peloTrasero(it?: CosmeticItem): string {
  if (!it) return '';
  const c = it.color ?? '#3A2A22';
  if (it.estilo === 'largo') return px(4, 2, 1, 8, oscurecer(c, 0.85)) + px(15, 2, 1, 8, oscurecer(c, 0.85));
  return '';
}

function piernas(it?: CosmeticItem, paso = 0): string {
  const c = it?.color ?? '#2B3450';
  const estilo = it?.estilo ?? 'jeans';
  const sombra = oscurecer(c, 0.72);
  if (estilo === 'falda' || estilo === 'falda-plisada' || estilo === 'falda-cuadros') {
    const plisado = estilo === 'falda-plisada' || estilo === 'falda-cuadros';
    const cuadros = estilo === 'falda-cuadros';
    const yIzq = 20 + paso;
    const yDer = 21 - paso;
    return [
      px(7, yIzq, 2, 22 - yIzq, PIEL),
      px(11, yDer, 2, 22 - yDer, PIEL),
      px(6, 17, 8, 1, aclarar(c, 1.1)),
      px(5, 18, 10, 2, c),
      px(5, 20, 10, 1, sombra),
      px(5, 18, 1, 3, sombra),
      px(14, 18, 1, 3, sombra),
      ...(plisado ? [px(7, 18, 1, 2, aclarar(c, 1.2)), px(10, 18, 1, 2, aclarar(c, 1.2)), px(13, 18, 1, 2, aclarar(c, 1.2))] : []),
      ...(cuadros ? [px(6, 19, 2, 1, '#E0B56B'), px(10, 18, 2, 1, '#E0B56B'), px(12, 19, 2, 1, '#E0B56B')] : []),
    ].join('');
  }
  if (estilo === 'shorts') {
    const yIzq = 18 + paso;
    const yDer = 19 - paso;
    return [
      px(6, yIzq, 3, 20 - yIzq, c), px(11, yDer, 3, 20 - yDer, c),
      px(6, yIzq, 3, 1, aclarar(c, 1.12)), px(11, yDer, 3, 1, aclarar(c, 1.12)),
      px(8, yIzq + 1, 1, 1, sombra), px(11, yDer + 1, 1, 1, sombra),
      px(6, 20, 3, 2, PIEL), px(11, 20, 3, 2, PIEL),
    ].join('');
  }
  const yIzq = 18 + paso;
  const yDer = 19 - paso;
  const out = [
    px(6, yIzq, 3, 22 - yIzq, c),
    px(11, yDer, 3, 22 - yDer, c),
    px(6, yIzq, 3, 1, aclarar(c, 1.12)),
    px(11, yDer, 3, 1, aclarar(c, 1.12)),
    px(8, yIzq + 1, 1, 22 - yIzq, sombra),
    px(11, yDer + 1, 1, 22 - yDer, sombra),
    // Dobladillo claro + borde exterior oscuro: recorta contra baldosas.
    px(6, 21, 3, 1, aclarar(c, 1.3)),
    px(11, 21, 3, 1, aclarar(c, 1.3)),
    px(6, yIzq, 1, 22 - yIzq, sombra),
    px(13, yDer, 1, 22 - yDer, sombra),
  ];
  if (estilo === 'cargo') out.push(px(6, yIzq + 2, 1, 1, sombra), px(12, yDer + 2, 1, 1, sombra));
  if (estilo === 'buzo') out.push(px(6, 21, 2, 1, aclarar(c, 1.3)), px(11, 21, 2, 1, aclarar(c, 1.3)));
  return out.join('');
}

function zapatos(it?: CosmeticItem, paso = 0): string {
  const c = it?.color ?? '#7A5230';
  const estilo = it?.estilo ?? 'botas';
  const suela =
    estilo === 'zapatillas' ? oscurecer(c, 0.5) : estilo === 'formales' ? aclarar(c, 1.6) : oscurecer(c, 0.55);
  const out: string[] = [];
  const dyIzq = paso === 0 ? -1 : 0;
  const dyDer = paso === 0 ? 0 : -1;
  const p = (x: number, y: number, w: number, h: number, fill: string, dy: number) =>
    px(x, y + dy, w, h, fill);
  if (estilo === 'altas') {
    out.push(
      p(6, 19, 3, 3, c, dyIzq),
      p(11, 19, 3, 3, c, dyDer),
      p(6, 19, 1, 3, aclarar(c, 1.15), dyIzq),
      p(11, 19, 1, 3, aclarar(c, 1.15), dyDer),
      p(6, 21, 3, 1, oscurecer(c, 0.75), dyIzq),
      p(11, 21, 3, 1, oscurecer(c, 0.75), dyDer),
    );
  }
  out.push(
    p(5, 21, 4, 1, oscurecer(c, 0.75), dyIzq),
    p(11, 21, 4, 1, oscurecer(c, 0.75), dyDer),
    p(5, 22, 4, 1, c, dyIzq),
    p(11, 22, 4, 1, c, dyDer),
    // Cordones claros: 2 bits que se leen a distancia.
    p(6, 22, 1, 1, aclarar(c, 1.5), dyIzq),
    p(12, 22, 1, 1, aclarar(c, 1.5), dyDer),
    p(4, 23, 5, 1, suela, dyIzq),
    p(11, 23, 5, 1, suela, dyDer),
    p(4, 23, 5, 1, oscurecer(c, 0.35), dyIzq),
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
  } else if (estilo === 'vestido' || estilo === 'vestido-floral') {
    out.push(
      px(7, 15, 6, 1, oscurecer(c, 0.82)),
      px(5, 18, 10, 1, c),
      px(4, 19, 12, 2, c),
      px(4, 21, 12, 1, oscurecer(c, 0.78)),
      px(4, 19, 1, 2, aclarar(c, 1.1)),
      px(15, 19, 1, 2, sombra),
    );
    if (estilo === 'vestido-floral') {
      out.push(
        px(6, 18, 1, 1, '#F2D58A'), px(12, 19, 1, 1, '#F2D58A'),
        px(8, 20, 1, 1, '#F2D58A'), px(14, 20, 1, 1, '#F2D58A'),
        px(9, 16, 2, 1, '#6E9B58'),
      );
    }
  } else if (estilo === 'entallada') {
    out.push(px(7, 15, 6, 1, oscurecer(c, 0.85)));
  } else if (estilo === 'poleron') {
    out.push(
      px(7, 9, 6, 2, oscurecer(c, 0.82)),
      px(8, 10, 4, 1, aclarar(c, 1.15)),
      px(8, 14, 4, 1, sombra),
      px(8, 15, 4, 2, sombra),
      // Bolsillo canguro + cordones: más bits, estilo referencia.
      px(8, 15, 4, 2, oscurecer(c, 0.88)),
      px(8, 15, 1, 2, aclarar(c, 1.12)),
      px(11, 15, 1, 2, aclarar(c, 1.12)),
      px(9, 11, 1, 2, '#F2E8C9'),
      px(11, 11, 1, 2, '#F2E8C9'),
      px(9, 13, 1, 1, oscurecer(c, 0.6)),
      px(11, 13, 1, 1, oscurecer(c, 0.6)),
    );
  } else if (estilo === 'cuadros') {
    out.push(
      px(6, 10, 2, 1, aclarar(c, 1.3)), px(10, 10, 2, 1, aclarar(c, 1.3)),
      px(8, 12, 2, 1, aclarar(c, 1.3)), px(12, 12, 2, 1, aclarar(c, 1.3)),
      px(6, 14, 2, 1, aclarar(c, 1.3)), px(10, 14, 2, 1, aclarar(c, 1.3)),
      px(8, 16, 2, 1, aclarar(c, 1.3)), px(12, 16, 2, 1, aclarar(c, 1.3)),
      px(9, 9, 2, 8, '#F2E8C9'),
    );
  } else if (estilo === 'chaleco') {
    out.push(
      px(6, 9, 2, 8, sombra), px(12, 9, 2, 8, sombra),
      px(8, 10, 4, 1, aclarar(c, 1.35)),
      px(8, 12, 1, 1, '#F2E8C9'), px(8, 14, 1, 1, '#F2E8C9'), px(8, 16, 1, 1, '#F2E8C9'),
      px(11, 12, 1, 1, '#F2E8C9'), px(11, 14, 1, 1, '#F2E8C9'), px(11, 16, 1, 1, '#F2E8C9'),
    );
  } else if (estilo === 'rayas') {
    out.push(
      px(6, 11, 8, 1, '#F2E8C9'), px(6, 14, 8, 1, '#F2E8C9'), px(6, 17, 8, 1, '#F2E8C9'),
      px(9, 9, 2, 2, oscurecer(c, 0.85)),
    );
  } else if (estilo === 'traje') {
    out.push(
      px(6, 9, 2, 8, sombra), px(12, 9, 2, 8, sombra),
      px(8, 9, 4, 2, '#F2E8C9'), px(9, 10, 2, 4, '#F2E8C9'),
      px(9, 10, 2, 3, '#B74E42'), px(10, 13, 1, 4, '#B74E42'),
      px(8, 15, 1, 1, '#D6B96D'), px(11, 15, 1, 1, '#D6B96D'),
    );
  } else if (estilo === 'bomber') {
    out.push(
      px(5, 9, 2, 8, sombra), px(13, 9, 2, 8, sombra),
      px(6, 9, 1, 1, aclarar(c, 1.3)), px(13, 9, 1, 1, aclarar(c, 1.3)),
      px(8, 10, 4, 1, '#F2E8C9'), px(10, 11, 1, 6, '#D6B96D'),
      px(6, 16, 2, 1, aclarar(c, 1.25)), px(12, 16, 2, 1, aclarar(c, 1.25)),
      px(7, 10, 1, 2, aclarar(c, 1.15)), px(12, 10, 1, 2, aclarar(c, 1.15)),
    );
  }
  return out.join('');
}

function brazos(it?: CosmeticItem, paso = 0): string {
  const c = it?.color ?? '#6A6AD4';
  const estilo = it?.estilo ?? 'polera';
  const osc = oscurecer(c, 0.62);
  const largo = !['polera', 'entallada', 'vestido', 'vestido-floral', 'rayas'].includes(estilo);
  const xIzq = paso === 0 ? 3 : 4;
  const xDer = paso === 0 ? 14 : 15;
  const out = [px(xIzq, 10, 2, 8, PIEL), px(xDer, 10, 2, 8, PIEL)];
  if (estilo === 'vestido' || estilo === 'vestido-floral') {
    out.push(px(xIzq, 9, 2, 1, aclarar(c, 1.1)), px(xDer, 9, 2, 1, aclarar(c, 1.1)));
  } else if (largo) {
    out.push(px(xIzq, 10, 2, 7, osc), px(xDer, 10, 2, 7, osc));
    out.push(px(xIzq, 10, 1, 7, oscurecer(c, 0.55)), px(xDer + 1, 10, 1, 7, oscurecer(c, 0.55)));
    out.push(px(xIzq, 16, 2, 1, aclarar(c, 1.1)), px(xDer, 16, 2, 1, aclarar(c, 1.1)));
  } else {
    out.push(px(xIzq, 10, 2, 3, osc), px(xDer, 10, 2, 3, osc));
    out.push(px(xIzq, 10, 1, 3, oscurecer(c, 0.55)), px(xDer + 1, 10, 1, 3, oscurecer(c, 0.55)));
  }
  out.push(px(xIzq, 17, 2, 1, PIEL_SOMBRA), px(xDer, 17, 2, 1, PIEL_SOMBRA));
  return out.join('');
}

/** Tirante único en diagonal, como mochila de hombro; va sobre la ropa. */
function tiranteMochila(it?: CosmeticItem): string {
  if (!it) return '';
  const cuero = '#A87952';
  const borde = '#503729';
  const luz = '#D4A16F';
  return [
    // De hombro derecho a cadera izquierda (dos píxeles de ancho).
    px(12, 9, 2, 1, borde),
    px(11, 10, 2, 1, borde),
    px(10, 11, 2, 1, borde),
    px(9, 12, 2, 1, borde),
    px(8, 13, 2, 1, borde),
    px(7, 14, 2, 1, borde),
    px(6, 15, 2, 1, borde),
    px(12, 9, 1, 1, luz),
    px(11, 10, 1, 1, cuero),
    px(10, 11, 1, 1, cuero),
    px(9, 12, 1, 1, cuero),
    px(8, 13, 1, 1, cuero),
    px(7, 14, 1, 1, cuero),
    px(6, 15, 1, 1, cuero),
  ].join('');
}

function tatuaje(it?: CosmeticItem): string {
  if (!it) return '';
  const c = it.color ?? '#3D6FC4';
  if (it.estilo === 'brazo') return px(4, 13, 1, 1, c) + px(5, 14, 1, 1, c) + px(14, 13, 1, 1, c);
  return px(7, 8, 1, 1, c) + px(12, 8, 1, 1, c);
}

function cabeza(sexo: Sexo): string {
  const contorno = oscurecer(PIEL, 0.55);
  const out = [
    // Silueta: 1 px oscurecido detrás para recortar del mapa claro.
    px(5, 1, 10, 8, contorno),
    px(6, 2, 8, 6, PIEL),
    px(6, 7, sexo === 'f' ? 6 : 8, 1, PIEL_SOMBRA),
    px(5, 4, 1, 2, PIEL),
    px(14, 4, 1, 2, PIEL),
    // Mejilla con luz: más volumen con 2 bits.
    px(5, 6, 1, 1, aclarar(PIEL, 1.08)),
    px(14, 6, 1, 1, PIEL_SOMBRA),
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
  if (it.estilo === 'rizado') {
    return (
      px(5, 0, 3, 2, c) + px(9, 0, 3, 2, c) + px(13, 0, 2, 2, c) +
      px(4, 1, 2, 3, c) + px(7, 1, 3, 2, c) + px(11, 1, 4, 2, c) +
      px(5, 3, 1, 3, osc) + px(14, 3, 1, 3, osc) + px(7, 0, 3, 1, luz)
    );
  }
  if (it.estilo === 'mono') {
    return corto + px(12, 0, 4, 1, c) + px(14, 0, 3, 2, osc) + px(15, 1, 2, 3, c) + px(14, 4, 2, 2, c);
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
  if (it.estilo === 'color') {
    return px(6, 3, 3, 2, c) + px(11, 3, 3, 2, c) + px(9, 4, 2, 1, oscurecer(c, 0.7)) + px(7, 3, 1, 1, aclarar(c, 1.4));
  }
  return px(6, 3, 3, 2, '#8CC0FF') + px(11, 3, 3, 2, '#8CC0FF') + px(9, 4, 2, 1, c) + px(7, 4, 1, 1, OJO) + px(11, 4, 1, 1, OJO);
}

function aros(it?: CosmeticItem): string {
  if (!it) return '';
  const c = it.color ?? '#C0C0C8';
  if (it.estilo === 'perla') return px(4, 4, 1, 1, c) + px(15, 4, 1, 1, c) + px(4, 5, 1, 1, oscurecer(c, 0.75)) + px(15, 5, 1, 1, oscurecer(c, 0.75));
  if (it.estilo === 'estrella') {
    return px(4, 4, 1, 1, c) + px(15, 4, 1, 1, c) + px(3, 5, 3, 1, aclarar(c, 1.2)) + px(14, 5, 3, 1, aclarar(c, 1.2));
  }
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
  if (it.estilo === 'bucket') {
    return px(5, 0, 10, 2, c) + px(4, 2, 12, 1, aclarar(c, 1.12)) + px(3, 3, 14, 1, osc) + px(6, 0, 4, 1, luz);
  }
  return px(5, 0, 10, 2, c) + px(4, 2, 12, 1, osc) + px(8, 0, 4, 1, aclarar(c, 1.35)) + px(9, 0, 2, 1, '#FFFFFF');
}

function svgAvatar(capa: string, ancho: number, alto: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 24" width="${ancho}" height="${alto}" shape-rendering="crispEdges">${capa}</svg>`;
}

function avatarSvgFrente(
  equipado: Equipamiento,
  sexo: Sexo,
  ancho: number,
  alto: number,
  paso: number,
): string {
  const moch = prenda(equipado, 'mochila');
  const capa = [
    mochila(moch),
    peloTrasero(prenda(equipado, 'pelo')),
    piernas(prenda(equipado, 'pantalon'), paso),
    zapatos(prenda(equipado, 'zapatos'), paso),
    torso(prenda(equipado, 'ropa'), sexo),
    brazos(prenda(equipado, 'ropa'), paso),
    tiranteMochila(moch),
    tatuaje(prenda(equipado, 'tatuaje')),
    cabeza(sexo),
    barba(prenda(equipado, 'barba')),
    peloFrente(prenda(equipado, 'pelo')),
    lentes(prenda(equipado, 'lentes')),
    aros(prenda(equipado, 'aros')),
    gorro(prenda(equipado, 'gorro')),
  ].join('');
  return svgAvatar(capa, ancho, alto);
}

function torsoEspalda(it: CosmeticItem | undefined, sexo: Sexo): string {
  const c = it?.color ?? '#6A6AD4';
  const rows = filasTorso(sexo).map(
    (f, i) => px(f.x, f.y, f.w, 1, i === 0 ? aclarar(c, 1.08) : c) + px(f.x + f.w - 1, f.y, 1, 1, oscurecer(c, 0.72)),
  );
  rows.push(px(9, 11, 2, 5, oscurecer(c, 0.84)));
  rows.push(px(8, 16, 4, 1, aclarar(c, 1.08)));
  return rows.join('');
}

/** Cabeza vista desde atrás; la capucha tapa nuca/cabello cuando está equipada. */
function cabezaEspalda(pelo?: CosmeticItem, gorroIt?: CosmeticItem): string {
  const hood = gorroIt?.estilo === 'capucha' ? gorroIt : undefined;
  if (hood) {
    const c = hood.color ?? '#FFD23F';
    return [
      px(7, 0, 6, 1, oscurecer(c, 0.42)),
      px(5, 1, 10, 1, oscurecer(c, 0.5)),
      px(4, 2, 12, 4, oscurecer(c, 0.5)),
      px(5, 6, 10, 2, oscurecer(c, 0.5)),
      px(7, 1, 6, 1, c),
      px(5, 2, 10, 1, c),
      px(5, 3, 10, 3, c),
      px(6, 6, 8, 1, c),
      px(7, 2, 6, 4, oscurecer(c, 0.84)),
      px(7, 2, 1, 4, aclarar(c, 1.12)),
    ].join('');
  }

  const c = pelo?.color ?? '#3A2A22';
  const out = [
    px(5, 1, 10, 8, oscurecer(PIEL, 0.55)),
    px(6, 2, 8, 6, PIEL_SOMBRA),
    px(7, 1, 6, 7, c),
    px(6, 3, 1, 4, oscurecer(c, 0.76)),
    px(13, 3, 1, 4, oscurecer(c, 0.76)),
    px(8, 2, 4, 1, aclarar(c, 1.18)),
    px(8, 8, 4, 1, PIEL_SOMBRA),
  ];
  if (pelo?.estilo === 'largo') {
    out.push(px(5, 5, 2, 5, c), px(13, 5, 2, 5, c));
  } else if (pelo?.estilo === 'colita') {
    out.push(px(14, 5, 2, 3, c), px(15, 7, 1, 2, oscurecer(c, 0.8)));
  } else if (pelo?.estilo === 'afro' || pelo?.estilo === 'rizado') {
    out.push(px(4, 1, 2, 4, c), px(14, 1, 2, 4, c), px(7, 0, 6, 1, aclarar(c, 1.12)));
  }
  if (gorroIt) {
    const hc = gorroIt.color ?? '#FFD23F';
    out.push(px(5, 0, 10, 2, hc), px(4, 2, 12, 1, oscurecer(hc, 0.72)));
  }
  return out.join('');
}

function mochilaEspalda(it?: CosmeticItem): string {
  if (!it) return '';
  const c = it.color ?? '#C23B3B';
  return [
    // Tirantes detrás de los hombros.
    px(6, 9, 2, 7, oscurecer(c, 0.45)),
    px(12, 9, 2, 7, oscurecer(c, 0.45)),
    px(7, 10, 1, 5, aclarar(c, 1.18)),
    // Cuerpo del bolso, centrado en la espalda y con bolsillo.
    px(7, 9, 6, 1, oscurecer(c, 0.35)),
    px(6, 10, 8, 1, oscurecer(c, 0.35)),
    px(6, 11, 8, 4, c),
    px(7, 15, 6, 1, oscurecer(c, 0.48)),
    px(8, 11, 4, 2, aclarar(c, 1.16)),
    px(8, 13, 4, 2, oscurecer(c, 0.52)),
    px(9, 13, 2, 1, aclarar(c, 1.22)),
  ].join('');
}

/** Perfil orientado al este; se espeja completo para caminar al oeste. */
function avatarSvgPerfil(
  equipado: Equipamiento,
  _sexo: Sexo,
  ancho: number,
  alto: number,
  paso: number,
  oeste: boolean,
): string {
  const pelo = prenda(equipado, 'pelo');
  const gorroIt = prenda(equipado, 'gorro');
  const mochilaIt = prenda(equipado, 'mochila');
  const ropa = prenda(equipado, 'ropa');
  const pantalon = prenda(equipado, 'pantalon');
  const zapatosIt = prenda(equipado, 'zapatos');
  const pc = pantalon?.color ?? '#2B3450';
  const shoe = zapatosIt?.color ?? '#7A5230';
  const rc = ropa?.color ?? '#6A6AD4';
  const shadow = oscurecer(rc, 0.65);
  const rearY = paso === 0 ? 18 : 17;
  const frontY = paso === 0 ? 17 : 18;
  const rearX = paso === 0 ? 7 : 8;
  const frontX = paso === 0 ? 11 : 10;
  const stride = [
    px(rearX, rearY, 3, 22 - rearY, pc),
    px(frontX, frontY, 3, 22 - frontY, pc),
    px(rearX, rearY, 1, 22 - rearY, oscurecer(pc, 0.68)),
    px(frontX, frontY, 1, 22 - frontY, aclarar(pc, 1.12)),
    px(rearX - 1, 21 + (paso === 0 ? 0 : -1), 5, 2, shoe),
    px(rearX - 2, 23 + (paso === 0 ? 0 : -1), 6, 1, oscurecer(shoe, 0.52)),
    px(frontX, 21 + (paso === 0 ? -1 : 0), 5, 2, aclarar(shoe, 1.08)),
    px(frontX - 1, 23 + (paso === 0 ? -1 : 0), 6, 1, oscurecer(shoe, 0.52)),
  ].join('');
  const hood = gorroIt?.estilo === 'capucha';
  const peloC = pelo?.color ?? '#3A2A22';
  const capuchaC = gorroIt?.color ?? '#FFD23F';
  const head = [
    ...(hood
      ? [
          px(8, 0, 5, 1, oscurecer(capuchaC, 0.42)),
          px(6, 1, 9, 1, oscurecer(capuchaC, 0.5)),
          px(5, 2, 11, 4, oscurecer(capuchaC, 0.5)),
          px(6, 6, 9, 2, oscurecer(capuchaC, 0.5)),
          px(8, 1, 6, 1, capuchaC),
          px(6, 2, 9, 1, capuchaC),
          px(6, 3, 9, 3, capuchaC),
          px(7, 6, 7, 1, capuchaC),
        ]
      : [
          px(6, 1, 9, 8, oscurecer(PIEL, 0.55)),
          px(7, 2, 7, 6, PIEL),
        ]),
    px(8, 2, 6, 4, PIEL),
    px(7, 4, 1, 2, PIEL_SOMBRA),
    px(13, 4, 1, 1, OJO),
    px(14, 5, 1, 1, PIEL_SOMBRA),
    px(13, 6, 2, 1, BOCA),
    ...(!hood
      ? [
          px(7, 1, 8, 2, peloC),
          px(7, 2, 2, 4, oscurecer(peloC, 0.82)),
          px(11, 2, 3, 1, peloC),
          ...(pelo?.estilo === 'largo' ? [px(7, 5, 1, 4, peloC)] : []),
        ]
      : []),
    ...(gorroIt && !hood
      ? [px(6, 0, 9, 2, capuchaC), px(7, 2, 9, 1, oscurecer(capuchaC, 0.72))]
      : []),
    ...(prenda(equipado, 'lentes') ? [px(12, 3, 3, 2, prenda(equipado, 'lentes')?.color ?? '#C99A16')] : []),
    ...(prenda(equipado, 'barba') ? [px(10, 6, 4, 2, prenda(equipado, 'barba')?.color ?? '#3A2A22')] : []),
  ].join('');

  const torso = [
    px(7, 9, 8, 1, aclarar(rc, 1.12)),
    px(7, 10, 8, 7, rc),
    px(7, 10, 1, 7, shadow),
    px(14, 10, 1, 7, oscurecer(rc, 0.72)),
    px(8, 16, 5, 1, shadow),
    ...(ropa?.estilo === 'poleron'
      ? [px(10, 10, 3, 1, aclarar(rc, 1.18)), px(11, 13, 3, 2, shadow)]
      : []),
    ...(ropa?.estilo === 'camisa' || ropa?.estilo === 'traje' ? [px(13, 10, 1, 6, '#F2E8C9')] : []),
  ].join('');
  const armX = paso === 0 ? 12 : 13;
  const arm = [
    px(armX, 10, 2, 6, shadow),
    px(armX, 10, 1, 5, oscurecer(rc, 0.45)),
    px(armX, 16, 2, 2, PIEL),
    px(armX, 16, 1, 1, PIEL_SOMBRA),
  ].join('');
  const tirante = mochilaIt
    ? [px(7, 10, 1, 5, '#503729'), px(7, 10, 1, 4, '#A87952')].join('')
    : '';

  const contents = [
    mochila(mochilaIt),
    stride,
    torso,
    tirante,
    arm,
    head,
  ].join('');
  const transform = oeste ? '<g transform="translate(20 0) scale(-1 1)">' + contents + '</g>' : contents;
  return svgAvatar(transform, ancho, alto);
}

/** Pose trasera: se ven la nuca y la mochila mientras avanza hacia arriba. */
function avatarSvgEspalda(
  equipado: Equipamiento,
  sexo: Sexo,
  ancho: number,
  alto: number,
  paso: number,
): string {
  const mochilaIt = prenda(equipado, 'mochila');
  const capa = [
    peloTrasero(prenda(equipado, 'pelo')),
    piernas(prenda(equipado, 'pantalon'), paso),
    zapatos(prenda(equipado, 'zapatos'), paso),
    torsoEspalda(prenda(equipado, 'ropa'), sexo),
    mochilaEspalda(mochilaIt),
    brazos(prenda(equipado, 'ropa'), paso),
    cabezaEspalda(prenda(equipado, 'pelo'), prenda(equipado, 'gorro')),
  ].join('');
  return svgAvatar(capa, ancho, alto);
}

/** Avatar frontal original, usado también en editor y retratos; pose base. */
export function avatarSvg(equipado: Equipamiento, sexo: Sexo = 'm', ancho = 48, alto = 58): string {
  return avatarSvgFrente(equipado, sexo, ancho, alto, 0);
}

/** Avatar del mapa con vistas cardinales y dos poses reales de caminata. */
export function avatarSvgRumbo(
  equipado: Equipamiento,
  sexo: Sexo,
  ancho: number,
  alto: number,
  rumbo: RumboAvatar,
  paso: 0 | 1,
): string {
  if (rumbo === 'n') return avatarSvgEspalda(equipado, sexo, ancho, alto, paso);
  if (rumbo === 'e' || rumbo === 'w') {
    return avatarSvgPerfil(equipado, sexo, ancho, alto, paso, rumbo === 'w');
  }
  return avatarSvgFrente(equipado, sexo, ancho, alto, paso);
}
