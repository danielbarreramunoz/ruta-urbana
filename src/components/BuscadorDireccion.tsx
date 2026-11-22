import { useEffect, useRef, useState } from 'react';
import { buscarDireccion, type ResultadoGeo } from '../game/geocod';
import { formatoDistancia } from '../game/cercanas';

/**
 * Buscador de direcciones (Nominatim, gratis y sin key).
 * Con debounce de 500 ms, estados de carga/error y distancia opcional.
 */
export default function BuscadorDireccion({
  onElegir,
  pos,
}: {
  onElegir: (r: ResultadoGeo) => void;
  pos?: { lat: number; lng: number };
}) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'idle' | 'buscando' | 'error' | 'listo'>('idle');
  const [resultados, setResultados] = useState<ResultadoGeo[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const alCambiar = (q: string) => {
    setTexto(q);
    window.clearTimeout(timer.current);
    if (q.trim().length < 4) {
      setResultados([]);
      setEstado('idle');
      return;
    }
    setEstado('buscando');
    timer.current = window.setTimeout(async () => {
      try {
        const r = await buscarDireccion(q);
        if (!vivo.current) return;
        setResultados(r);
        setEstado('listo');
      } catch {
        if (!vivo.current) return;
        setResultados([]);
        setEstado('error');
      }
    }, 500);
  };

  const dist = (r: ResultadoGeo): number | null => {
    if (!pos) return null;
    const dLat = (r.lat - pos.lat) * 111320;
    const dLng = (r.lng - pos.lng) * 111320 * Math.cos((pos.lat * Math.PI) / 180);
    return Math.round(Math.hypot(dLat, dLng));
  };

  return (
    <div className="space-y-2">
      <input
        value={texto}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder="Ej. farmacia Quilicura, Huérfanos 630"
        aria-label="Buscar dirección"
        className="w-full border-2 border-ruta-line bg-ruta-void p-2 font-pixel text-sm text-ruta-parchment placeholder:text-ruta-muted focus:border-ruta-burocracia focus:outline-none"
      />
      {estado === 'buscando' && (
        <div className="font-pixel text-[10px] tracking-widest text-ruta-gold" role="status">
          ◌ BUSCANDO…
        </div>
      )}
      {estado === 'error' && (
        <div className="font-pixel text-[10px] leading-4 text-ruta-valentia" role="alert">
          ○ Sin conexión o servicio caído · revisa tu red e intenta de nuevo
        </div>
      )}
      {estado === 'listo' && resultados.length === 0 && (
        <div className="font-pixel text-[10px] leading-4 text-ruta-muted">
          Sin resultados · prueba con comuna o calle y número
        </div>
      )}
      {resultados.map((r, i) => (
        <button
          key={`${r.lat},${r.lng},${i}`}
          onClick={() => onElegir(r)}
          className="px-btn block w-full p-2 text-left"
        >
          <div className="truncate font-pixel text-[11px] font-bold text-ruta-parchment">{r.nombre}</div>
          <div className="truncate font-pixel text-[9px] leading-3 text-ruta-muted">
            {dist(r) != null ? `${formatoDistancia(dist(r)!)} · ` : ''}{r.detalle || 'Toca para usar este punto'}
          </div>
        </button>
      ))}
      <p className="font-pixel text-[9px] leading-3 text-ruta-muted">
        Búsqueda © OpenStreetMap · solo con internet
      </p>
    </div>
  );
}
