import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import Joystick from './Joystick';
import { Sprite, AVATAR_SVG, pinGlifo, pinSvg, uiSvg, type PinEstado } from './sprites';
import { quests } from '../game/data';
import { REVEAL_RADIUS_M, cellCenter } from '../game/fog';
import { activarAvisos, useProximity } from '../game/useProximity';
import { permisoAvisos } from '../game/alerts';
import {
  useAlertStore,
  useExplorationStore,
  usePlayerStore,
  usePresenceStore,
  useQuestStore,
  useSettingsStore,
} from '../game/store';

const AVATAR_HTML = `
<div class="ru-avatar">
  <div class="ru-avatar__halo"></div>
  <div class="ru-avatar__shadow"></div>
  <div class="ru-avatar__ring"></div>
  <div class="ru-avatar__body">${AVATAR_SVG}</div>
</div>`;

const pinHtml = (estado: PinEstado) =>
  `<div class="ru-pin ${estado === 'activa' ? 'ru-pin--activa' : ''}">${pinSvg(estado)}<span class="ru-pin__glyph" style="color:${estado === 'activa' ? '#0d0d14' : '#F2E8C9'}">${pinGlifo(estado)}</span></div>`;

const ghostHtml = (nombre: string) => `<div class="ru-ghost" title="${nombre} (aprox)">👤</div>`;

/** Textura de grano cacheada para la niebla (una sola generación). */
function crearGrano(size = 96): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 10;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Mapa: niebla con degradado suave, avatar animado, pines con estado y radar.
 * La niebla se pinta en canvas: base oscura + grano + perforado radial por celda.
 */
export default function MapView({ onAbrirQuest }: { onAbrirQuest: (id: string) => void }) {
  const contRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const ringRef = useRef<L.Circle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const granoRef = useRef<HTMLCanvasElement | null>(null);
  const pinesRef = useRef<L.LayerGroup | null>(null);
  const radiosRef = useRef<L.LayerGroup | null>(null);
  const fantasmasRef = useRef<L.LayerGroup | null>(null);
  const visitedRef = useRef<string[]>([]);

  const { efectiva, mode, permiso, alerta, descartarAlerta } = useProximity();
  const setMode = useExplorationStore((s) => s.setMode);
  const visited = useExplorationStore((s) => s.visited);
  const resetFog = useExplorationStore((s) => s.resetFog);
  const misionActivaId = usePlayerStore((s) => s.jugador.misionActivaId);
  const progressos = useQuestStore((s) => s.progresos);
  const customs = useQuestStore((s) => s.customs);
  const otros = usePresenceStore((s) => s.otros);
  const avisosActivados = useAlertStore((s) => s.avisosActivados);
  const sonido = useSettingsStore((s) => s.sonido);
  const toggleSonido = useSettingsStore((s) => s.toggleSonido);
  const [seguir, setSeguir] = useState(true);
  const [permisoAviso, setPermisoAviso] = useState(permisoAvisos());
  const abrirRef = useRef(onAbrirQuest);
  abrirRef.current = onAbrirQuest;

  visitedRef.current = visited;

  /** Pinta la niebla: base + grano + perforado radial suave en celdas visitadas. */
  const dibujarNiebla = () => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;
    const size = map.getSize();
    if (canvas.width !== size.x || canvas.height !== size.y) {
      canvas.width = size.x;
      canvas.height = size.y;
    }
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, size.x, size.y);

    // Base: más oscura en los bordes (profundidad).
    const base = ctx.createRadialGradient(size.x / 2, size.y / 2, Math.min(size.x, size.y) * 0.25, size.x / 2, size.y / 2, Math.max(size.x, size.y) * 0.75);
    base.addColorStop(0, 'rgba(5,5,12,0.58)');
    base.addColorStop(1, 'rgba(3,3,8,0.82)');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size.x, size.y);

    // Grano de película: da textura de exploración, no plano negro.
    if (!granoRef.current) granoRef.current = crearGrano();
    const patron = ctx.createPattern(granoRef.current, 'repeat');
    if (patron) {
      ctx.fillStyle = patron;
      ctx.fillRect(0, 0, size.x, size.y);
    }

    // Perforado suave: 100 m reales convertidos a píxeles según el zoom.
    const zoom = map.getZoom();
    const metrosPorPixel = (156543.03392 * Math.cos((efectiva.lat * Math.PI) / 180)) / Math.pow(2, zoom);
    const radioCeldaPx = Math.min(240, Math.max(10, 100 / metrosPorPixel));

    const bounds = map.getBounds().pad(0.25);
    ctx.globalCompositeOperation = 'destination-out';
    for (const key of visitedRef.current) {
      const c = cellCenter(key);
      if (!bounds.contains([c.lat, c.lng])) continue;
      const p = map.latLngToContainerPoint([c.lat, c.lng]);
      const g = ctx.createRadialGradient(p.x, p.y, radioCeldaPx * 0.35, p.x, p.y, radioCeldaPx);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.62, 'rgba(0,0,0,0.96)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radioCeldaPx, 0, Math.PI * 2);
      ctx.fill();
    }

    // Halo cálido solo en el borde del área descubierta: la niebla "arde" al contacto.
    ctx.globalCompositeOperation = 'source-over';
    for (const key of visitedRef.current) {
      const c = cellCenter(key);
      if (!bounds.contains([c.lat, c.lng])) continue;
      const p = map.latLngToContainerPoint([c.lat, c.lng]);
      const g = ctx.createRadialGradient(p.x, p.y, radioCeldaPx * 0.55, p.x, p.y, radioCeldaPx * 1.15);
      g.addColorStop(0, 'rgba(255,210,63,0)');
      g.addColorStop(0.55, 'rgba(255,210,63,0.02)');
      g.addColorStop(0.82, 'rgba(255,210,63,0.035)');
      g.addColorStop(1, 'rgba(255,210,63,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radioCeldaPx * 1.15, 0, Math.PI * 2);
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
      zoomSnap: 0.5,
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
      icon: L.divIcon({ html: AVATAR_HTML, className: '', iconSize: [48, 60], iconAnchor: [24, 44] }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(map);
    markerRef.current = marker;

    const ring = L.circle([efectiva.lat, efectiva.lng], {
      radius: REVEAL_RADIUS_M,
      color: '#FFD23F',
      weight: 1.5,
      opacity: 0.55,
      dashArray: '4 6',
      fillColor: '#FFD23F',
      fillOpacity: 0.05,
      interactive: false,
    }).addTo(map);
    ringRef.current = ring;

    pinesRef.current = L.layerGroup().addTo(map);
    radiosRef.current = L.layerGroup().addTo(map);
    fantasmasRef.current = L.layerGroup().addTo(map);

    const redibujar = () => dibujarRef.current();
    map.on('moveend zoomend resize', redibujar);
    // Si el jugador arrastra el mapa, deja de seguirlo (evita el "salto" al caminar).
    map.on('dragstart', () => setSeguir(false));
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
    const todas = [...quests, ...customs.map((c) => c.quest)];
    for (const q of todas) {
      for (const u of q.ubicaciones ?? []) {
        const estadoProg = progressos[q.id]?.estado;
        const estado: PinEstado =
          estadoProg === 'completada' ? 'completada' : q.id === misionActivaId ? 'activa' : u.sensible ? 'sensible' : 'disponible';
        const pin = L.marker([u.latitud, u.longitud], {
      icon: L.divIcon({ html: pinHtml(estado), className: '', iconSize: [26, 34], iconAnchor: [13, 34] }),
          keyboard: false,
          zIndexOffset: estado === 'activa' ? 900 : 500,
        });
        pin.on('click', () => abrirRef.current(q.id));
        pin.addTo(pines);
        if (q.id === misionActivaId) {
          L.circle([u.latitud, u.longitud], {
            radius: u.radioM,
            color: '#FFD23F',
            weight: 1.5,
            dashArray: '3 7',
            opacity: 0.75,
            fillColor: '#FFD23F',
            fillOpacity: 0.06,
            interactive: false,
          }).addTo(radios);
        }
      }
    }
  }, [misionActivaId, customs, progressos]);

  // Fantasmas del radar (posiciones difuminadas).
  useEffect(() => {
    const capa = fantasmasRef.current;
    if (!capa) return;
    capa.clearLayers();
    for (const o of otros) {
      capa.addLayer(
        L.marker([o.pos.lat, o.pos.lng], {
          icon: L.divIcon({ html: ghostHtml(o.nombre), className: '', iconSize: [26, 26], iconAnchor: [13, 13] }),
          keyboard: false,
          interactive: false,
        }),
      );
    }
  }, [otros]);

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
      <div className="ru-vignette" />

      {/* Banner de proximidad */}
      {alerta && (
        <div className="absolute left-3 right-3 top-[118px] z-[1100] px-frame px-frame--gold p-3">
          <button onClick={() => { onAbrirQuest(alerta.questId); descartarAlerta(); }} className="block w-full text-left">
            <div className="flex items-center gap-2 font-pixel text-[10px] tracking-widest text-ruta-gold">
              <Sprite svg={uiSvg('target')} size={12} />
              {alerta.sensible ? 'MISIÓN CERCANA' : `LLEGASTE · ~${alerta.distanciaM} M`}
            </div>
            <div className="mt-1 font-pixel text-sm font-bold text-ruta-parchment">
              {alerta.sensible ? 'Tienes una misión secundaria cerca' : `${alerta.nombre} · ${alerta.questTitulo}`}
            </div>
            <div className="mt-0.5 font-pixel text-[10px] text-ruta-muted">Toca para abrir la misión →</div>
          </button>
          <button
            onClick={descartarAlerta}
            aria-label="Descartar alerta"
            className="px-btn absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center font-pixel text-xs text-ruta-muted"
          >
            ✕
          </button>
        </div>
      )}

      {/* HUD superior */}
      <div className="absolute left-3 right-3 top-3 z-[1100] space-y-2">
        <div className="px-frame flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 animate-pulse bg-ruta-xp" />
            <span className="font-pixel text-[11px] text-ruta-parchment">
              {visited.length} <span className="text-ruta-muted">celdas</span>
            </span>
            <span className="font-pixel text-[10px] text-ruta-line">|</span>
            <span className="font-pixel text-[10px] text-ruta-muted">100 m</span>
          </div>
          <button
            onClick={() => (seguir ? setSeguir(false) : centrar())}
            className={`px-btn px-2 py-1 font-pixel text-[10px] tracking-wider ${seguir ? 'px-btn--on' : ''}`}
            title={seguir ? 'Dejar de seguir' : 'Centrar en tu posición'}
          >
            {seguir ? '◉ SIGUIENDO' : '○ CENTRAR'}
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setMode('gps')} className={`px-btn flex flex-1 items-center justify-center gap-2 py-2 font-pixel text-[11px] ${mode === 'gps' ? 'px-btn--on' : 'text-ruta-muted'}`}>
            <Sprite svg={uiSvg('gps')} size={14} /> GPS
          </button>
          <button onClick={() => setMode('joystick')} className={`px-btn flex flex-1 items-center justify-center gap-2 py-2 font-pixel text-[11px] ${mode === 'joystick' ? 'px-btn--on' : 'text-ruta-muted'}`}>
            <Sprite svg={uiSvg('joystick')} size={14} /> PAD
          </button>
          <button onClick={resetFog} title="Reiniciar niebla" aria-label="Reiniciar niebla" className="px-btn flex h-9 w-9 items-center justify-center text-ruta-muted">
            <Sprite svg={uiSvg('fog')} size={16} />
          </button>
          <button onClick={toggleSonido} title={sonido ? 'Silenciar sonidos' : 'Activar sonidos'} aria-label={sonido ? 'Silenciar' : 'Activar sonido'} className="px-btn flex h-9 w-9 items-center justify-center text-ruta-muted">
            <Sprite svg={uiSvg(sonido ? 'soundOn' : 'soundOff')} size={16} />
          </button>
          {!avisosActivados && permisoAviso !== 'denied' && (
            <button onClick={pedirAvisos} aria-label="Activar avisos" className="px-btn flex h-9 w-9 items-center justify-center text-ruta-burocracia">
              <Sprite svg={uiSvg('bell')} size={16} />
            </button>
          )}
        </div>

        {(permiso === 'denegado' || permiso === 'no-fijado') && (
          <div className="px-frame border-ruta-valentia px-2 py-1 font-pixel text-[10px] text-ruta-valentia">
            Sin GPS del navegador · usando pad
          </div>
        )}
      </div>

      {/* Zoom */}
      <div className="absolute bottom-4 left-3 z-[1100] flex flex-col gap-2">
        <button onClick={() => mapRef.current?.zoomIn()} aria-label="Acercar" className="px-btn flex h-9 w-9 items-center justify-center font-pixel text-base text-ruta-parchment">+</button>
        <button onClick={() => mapRef.current?.zoomOut()} aria-label="Alejar" className="px-btn flex h-9 w-9 items-center justify-center font-pixel text-base text-ruta-parchment">−</button>
        <div className="px-frame mt-1 max-w-[76px] px-1.5 py-1 text-center font-pixel text-[8px] leading-3 text-ruta-muted">
          ◌ 100 m<br />niebla
        </div>
      </div>

      {/* Pad */}
      {mode === 'joystick' && (
        <div className="absolute bottom-4 right-3 z-[1100]">
          <Joystick onCenter={centrar} />
        </div>
      )}
    </div>
  );
}
