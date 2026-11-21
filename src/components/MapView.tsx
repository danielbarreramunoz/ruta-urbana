import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import Joystick from './Joystick';
import { usePlayerPosition } from '../game/geo';
import { REVEAL_RADIUS_M, cellCenter, cellPolygon } from '../game/fog';
import { useExplorationStore } from '../game/store';

const AVATAR_HTML = `
<div style="position:relative;width:48px;height:48px">
  <div style="position:absolute;inset:2px;border:2px solid #FFD23F;border-radius:9999px;opacity:.5"></div>
  <div style="position:absolute;left:11px;top:22px;width:26px;height:20px;background:#FF5D5D;border:1px solid #1A1A24;border-radius:2px"></div>
  <div style="position:absolute;left:15px;top:20px;width:18px;height:18px;background:#6AA8FF;border:1px solid #1A1A24;border-radius:2px"></div>
  <div style="position:absolute;left:13px;top:6px;width:22px;height:22px;background:#FFD23F;border:2px solid #1A1A24;border-radius:9999px"></div>
</div>`;

/**
 * Mapa base + niebla de exploración (web).
 * Tiles gratuitos CARTO dark (© OpenStreetMap © CARTO, sin API key).
 * La niebla es un canvas redibujado: oscuro global + agujeros en celdas visitadas.
 */
export default function MapView() {
  const contRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const ringRef = useRef<L.Circle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visitedRef = useRef<string[]>([]);

  const { efectiva, mode, permiso } = usePlayerPosition();
  const setMode = useExplorationStore((s) => s.setMode);
  const visited = useExplorationStore((s) => s.visited);
  const resetFog = useExplorationStore((s) => s.resetFog);
  const [seguir, setSeguir] = useState(true);

  visitedRef.current = visited;

  // Dibujar niebla: oscuro + destination-out en visitadas cercanas.
  const dibujarNiebla = () => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;
    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, size.x, size.y);
    ctx.fillStyle = 'rgba(4,4,9,0.72)';
    ctx.fillRect(0, 0, size.x, size.y);
    const bounds = map.getBounds().pad(0.2);
    ctx.globalCompositeOperation = 'destination-out';
    for (const key of visitedRef.current) {
      const c = cellCenter(key);
      if (!bounds.contains([c.lat, c.lng])) continue;
      const ring = cellPolygon(key)[0];
      ctx.beginPath();
      ring.forEach(([lng, lat], i) => {
        const p = map.latLngToContainerPoint([lat, lng]);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fill();
    }
  };
  const dibujarRef = useRef(dibujarNiebla);
  dibujarRef.current = dibujarNiebla;

  // Inicializar mapa una vez.
  useEffect(() => {
    if (!contRef.current || mapRef.current) return;
    const map = L.map(contRef.current, {
      zoomControl: false,
      attributionControl: true,
      center: [efectiva.lat, efectiva.lng],
      zoom: 16,
    });
    mapRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'osm-dark-tiles',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '400';
    map.getPanes().overlayPane.appendChild(canvas);
    canvasRef.current = canvas;

    const marker = L.marker([efectiva.lat, efectiva.lng], {
      icon: L.divIcon({ html: AVATAR_HTML, className: '', iconSize: [48, 48], iconAnchor: [24, 24] }),
      interactive: false,
      keyboard: false,
    }).addTo(map);
    markerRef.current = marker;

    const ring = L.circle([efectiva.lat, efectiva.lng], {
      radius: REVEAL_RADIUS_M,
      color: '#FFD23F',
      weight: 1.5,
      opacity: 0.7,
      fillColor: '#FFD23F',
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(map);
    ringRef.current = ring;

    const redibujar = () => dibujarRef.current();
    map.on('moveend zoomend resize', redibujar);
    redibujar();
    return () => {
      map.off('moveend zoomend resize', redibujar);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seguir avatar + mover marcador y anillo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.setLatLng([efectiva.lat, efectiva.lng]);
    ringRef.current?.setLatLng([efectiva.lat, efectiva.lng]);
    if (seguir) map.setView([efectiva.lat, efectiva.lng], map.getZoom(), { animate: true });
    dibujarRef.current();
  }, [efectiva, seguir]);

  useEffect(() => {
    dibujarRef.current();
  }, [visited]);

  const centrar = () => {
    setSeguir(true);
    mapRef.current?.setView([efectiva.lat, efectiva.lng], mapRef.current.getZoom(), { animate: true });
  };

  return (
    <div className="relative h-full w-full">
      <div ref={contRef} className="absolute inset-0" />

      {/* HUD superior */}
      <div className="absolute left-3 right-3 top-3 z-[1100] border-2 border-ruta-line bg-ruta-panel/95 p-3">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-xs text-ruta-parchment">{visited.length} celdas · radio 100 m</span>
          <button onClick={() => setSeguir((v) => !v)} className="font-pixel text-xs text-ruta-gold">
            {seguir ? 'SIGUIENDO' : 'LIBRE'}
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          {(['gps', 'joystick'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`border px-3 py-1.5 font-pixel text-xs ${mode === m ? 'border-ruta-gold bg-ruta-void text-ruta-gold' : 'border-ruta-line text-ruta-muted'}`}
            >
              {m === 'gps' ? '📡 GPS' : '🕹️ JOYSTICK'}
            </button>
          ))}
          <button onClick={resetFog} className="border border-ruta-line px-3 py-1.5 font-pixel text-xs text-ruta-muted">
            Reset niebla
          </button>
        </div>
        {(permiso === 'denegado' || permiso === 'no-fijado') && (
          <div className="mt-2 font-pixel text-[11px] text-ruta-valentia">
            Sin GPS del navegador: jugando con joystick.
          </div>
        )}
      </div>

      {/* Zoom + / − */}
      <div className="absolute bottom-4 left-3 z-[1100] flex flex-col gap-2">
        <button onClick={() => mapRef.current?.zoomIn()} className="h-10 w-10 border-2 border-ruta-line bg-ruta-panel font-pixel text-lg text-ruta-parchment">+</button>
        <button onClick={() => mapRef.current?.zoomOut()} className="h-10 w-10 border-2 border-ruta-line bg-ruta-panel font-pixel text-lg text-ruta-parchment">−</button>
      </div>

      {/* Joystick */}
      {mode === 'joystick' && (
        <div className="absolute bottom-4 right-3 z-[1100]">
          <Joystick onCenter={centrar} />
        </div>
      )}
    </div>
  );
}
