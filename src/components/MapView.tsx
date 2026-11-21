import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import Joystick from './Joystick';
import { AVATAR_SVG, pinSvg } from './sprites';
import { quests } from '../game/data';
import { REVEAL_RADIUS_M, cellCenter, cellPolygon } from '../game/fog';
import { activarAvisos, useProximity } from '../game/useProximity';
import { permisoAvisos } from '../game/alerts';
import { useAlertStore, useExplorationStore, usePlayerStore, useSettingsStore } from '../game/store';

/**
 * Mapa base + niebla + proximidad (Fase 3, versión PWA).
 * - Tiles OSM con filtro nocturno (sin API key).
 * - Niebla: canvas redibujado (oscuro global + agujeros en visitadas).
 * - Pines de misiones (! activa, · discreta). Círculos de radio en la misión activa.
 * - Banner de alerta al entrar al radio + vibración + notificación opcional.
 */
export default function MapView({ onAbrirQuest }: { onAbrirQuest: (id: string) => void }) {
  const contRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const ringRef = useRef<L.Circle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pinesRef = useRef<L.LayerGroup | null>(null);
  const radiosRef = useRef<L.LayerGroup | null>(null);
  const visitedRef = useRef<string[]>([]);

  const { efectiva, mode, permiso, alerta, descartarAlerta } = useProximity();
  const setMode = useExplorationStore((s) => s.setMode);
  const visited = useExplorationStore((s) => s.visited);
  const resetFog = useExplorationStore((s) => s.resetFog);
  const misionActivaId = usePlayerStore((s) => s.jugador.misionActivaId);
  const avisosActivados = useAlertStore((s) => s.avisosActivados);
  const sonido = useSettingsStore((s) => s.sonido);
  const toggleSonido = useSettingsStore((s) => s.toggleSonido);
  const [seguir, setSeguir] = useState(true);
  const [permisoAviso, setPermisoAviso] = useState(permisoAvisos());
  const abrirRef = useRef(onAbrirQuest);
  abrirRef.current = onAbrirQuest;

  visitedRef.current = visited;

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
      icon: L.divIcon({ html: AVATAR_SVG, className: '', iconSize: [48, 48], iconAnchor: [24, 24] }),
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

    pinesRef.current = L.layerGroup().addTo(map);
    radiosRef.current = L.layerGroup().addTo(map);

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

  // Pines de misiones + radios de la activa.
  useEffect(() => {
    const pines = pinesRef.current;
    const radios = radiosRef.current;
    if (!pines || !radios) return;
    pines.clearLayers();
    radios.clearLayers();
    for (const q of quests) {
      for (const u of q.ubicaciones ?? []) {
        const activa = q.id === misionActivaId;
        const pin = L.marker([u.latitud, u.longitud], {
          icon: L.divIcon({ html: pinSvg(activa, u.sensible), className: '', iconSize: [30, 30], iconAnchor: [15, 15] }),
          keyboard: false,
        });
        pin.on('click', () => abrirRef.current(q.id));
        pin.addTo(pines);
        if (activa) {
          L.circle([u.latitud, u.longitud], {
            radius: u.radioM,
            color: '#FFD23F',
            weight: 1.5,
            dashArray: '6 4',
            opacity: 0.8,
            fill: false,
            interactive: false,
          }).addTo(radios);
        }
      }
    }
  }, [misionActivaId]);

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

  const pedirAvisos = async () => {
    const ok = await activarAvisos();
    setPermisoAviso(permisoAvisos());
    if (!ok) setPermisoAviso('denied');
  };

  return (
    <div className="relative h-full w-full">
      <div ref={contRef} className="absolute inset-0" />

      {/* Banner de alerta de proximidad */}
      {alerta && (
        <button
          onClick={() => { onAbrirQuest(alerta.questId); descartarAlerta(); }}
          className="absolute left-3 right-3 top-[104px] z-[1100] border-2 border-ruta-gold bg-ruta-panel p-3 text-left"
        >
          <div className="font-pixel text-[11px] text-ruta-gold">
            {alerta.sensible ? '● MISIÓN CERCANA' : `📍 LLEGASTE · a ${alerta.distanciaM} m`}
          </div>
          <div className="mt-0.5 font-pixel text-sm font-bold text-ruta-parchment">
            {alerta.sensible ? 'Tienes una misión secundaria cerca' : `${alerta.nombre} — ${alerta.questTitulo}`}
          </div>
          <div className="font-pixel text-[11px] text-ruta-muted">Toca para abrir → ✕ descarta</div>
        </button>
      )}
      {alerta && (
        <button
          onClick={descartarAlerta}
          aria-label="Descartar alerta"
          className="absolute right-5 top-[112px] z-[1101] flex h-7 w-7 items-center justify-center border border-ruta-line bg-ruta-void font-pixel text-sm text-ruta-muted"
        >
          ✕
        </button>
      )}

      {/* HUD superior */}
      <div className="absolute left-3 right-3 top-3 z-[1100] border-2 border-ruta-line bg-ruta-panel/95 p-3">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-xs text-ruta-parchment">{visited.length} celdas · radio 100 m</span>
          <button onClick={() => setSeguir((v) => !v)} className="font-pixel text-xs text-ruta-gold">
            {seguir ? 'SIGUIENDO' : 'LIBRE'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
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
          <button onClick={toggleSonido} className="border border-ruta-line px-3 py-1.5 font-pixel text-xs text-ruta-muted" title="Sonido retro">
            {sonido ? '🔊' : '🔇'}
          </button>
          {!avisosActivados && permisoAviso !== 'denied' && permisoAviso !== 'granted' && (
            <button onClick={pedirAvisos} className="border border-ruta-burocracia px-3 py-1.5 font-pixel text-xs text-ruta-burocracia">
              🔔 Avisos
            </button>
          )}
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
