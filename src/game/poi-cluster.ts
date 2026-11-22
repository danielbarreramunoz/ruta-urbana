/** Agrupación visual de POI en píxeles (puro TS, testeable sin DOM). */
export interface PuntoProyectado<T> {
  valor: T;
  x: number;
  y: number;
}

export interface GrupoPuntos<T> {
  valores: T[];
  x: number;
  y: number;
}

/**
 * Agrupa puntos cercanos en pantalla. Usa componentes conectados para que no
 * queden pares superpuestos en el borde de una celda de agrupación.
 */
export function agruparPuntos<T>(
  puntos: PuntoProyectado<T>[],
  radioPx: number,
): GrupoPuntos<T>[] {
  const padres = puntos.map((_, i) => i);
  const buscar = (i: number): number => {
    if (padres[i] !== i) padres[i] = buscar(padres[i]);
    return padres[i];
  };
  const unir = (a: number, b: number) => {
    const ra = buscar(a);
    const rb = buscar(b);
    if (ra !== rb) padres[rb] = ra;
  };
  const radio2 = radioPx * radioPx;

  for (let i = 0; i < puntos.length; i++) {
    for (let j = i + 1; j < puntos.length; j++) {
      const dx = puntos[i].x - puntos[j].x;
      const dy = puntos[i].y - puntos[j].y;
      if (dx * dx + dy * dy <= radio2) unir(i, j);
    }
  }

  const grupos = new Map<number, PuntoProyectado<T>[]>();
  puntos.forEach((p, i) => {
    const raiz = buscar(i);
    const grupo = grupos.get(raiz) ?? [];
    grupo.push(p);
    grupos.set(raiz, grupo);
  });

  return [...grupos.values()].map((grupo) => ({
    valores: grupo.map((p) => p.valor),
    x: grupo.reduce((s, p) => s + p.x, 0) / grupo.length,
    y: grupo.reduce((s, p) => s + p.y, 0) / grupo.length,
  }));
}
