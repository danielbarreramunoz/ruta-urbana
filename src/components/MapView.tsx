import L from 'leaflet';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Joystick from './Joystick';
import { Sprite, pinGlifo, pinSvg, uiSvg, type PinEstado } from './sprites';
import { avatarSvgRumbo, type RumboAvatar } from './avatar';
import { quests } from '../game/data';
import { REVEAL_RADIUS_M, XP_POR_CELDA, cellCenter } from '../game/fog';
import { activarAvisos, useProximity } from '../game/useProximity';
import { permisoAvisos } from '../game/alerts';
import { proximoDestino } from '../game/proximity';
import {
  ESTACIONES,
  ETIQUETA_ESTACION,
  ETIQUETA_MOMENTO,
  MOMENTOS,
  estacionDe,
  momentoDe,
  paletaMapa,
  type Estacion,
  type MomentoDia,
} from '../game/ambiente';
import type { Equipamiento, Sexo } from '../game/types';
import {
  buscarQuest,
  useAlertStore,
  useExplorationStore,
  usePlayerStore,
  usePresenceStore,
  useQuestStore,
  useSettingsStore,
} from '../game/store';

const avatarHtml = (equipado: Equipamiento, sexo: Sexo, caminando = false, rumbo: RumboAvatar = 's') => `
<div class="ru-avatar${caminando ? ' ru-avatar--walk' : ''}" data-rumbo="${rumbo}">
  <div class="ru-avatar__halo"></div>
  <div class="ru-avatar__shadow"></div>
  <div class="ru-avatar__ring"></div>
  <div class="ru-avatar__body">
    <div class="ru-avatar__frame ru-avatar__frame--a">${avatarSvgRumbo(equipado, sexo, 48, 58, rumbo, 0)}</div>
    <div class="ru-avatar__frame ru-avatar__frame--b">${avatarSvgRumbo(equipado, sexo, 48, 58, rumbo, 1)}</div>
  </div>
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
  const rutaRef = useRef<L.Polyline | null>(null);
  const visitedRef = useRef<string[]>([]);
  const equipadoRef = useRef<Equipamiento>({});
  const sexoRef = useRef<Sexo>('m');
  const { efectiva, mode, permiso, real, alerta, descartarAlerta } = useProximity();
  const setMode = useExplorationStore((s) => s.setMode);
  const visited = useExplorationStore((s) => s.visited);
  const resetFog = useExplorationStore((s) => s.resetFog);
  const misionActivaId = usePlayerStore((s) => s.jugador.misionActivaId);
  const equipado = usePlayerStore((s) => s.jugador.equipado);
  const sexo = usePlayerStore((s) => s.jugador.sexo);
  const progressos = useQuestStore((s) => s.progresos);
  const customs = useQuestStore((s) => s.customs);
  const otros = usePresenceStore((s) => s.otros);
  const avisosActivados = useAlertStore((s) => s.avisosActivados);
  const sonido = useSettingsStore((s) => s.sonido);
  const toggleSonido = useSettingsStore((s) => s.toggleSonido);
  const temaMapa = useSettingsStore((s) => s.temaMapa) ?? 'auto';
  const ambientePref = useSettingsStore((s) => s.ambiente) ?? 'auto';
  const setTemaMapa = useSettingsStore((s) => s.setTemaMapa);
  const setAmbiente = useSettingsStore((s) => s.setAmbiente);
  const [panelTema, setPanelTema] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());
  // Recalcula cada minuto, pero solo re-renderiza al cruzar de franja (hora o estación).
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setAhora((prev) =>
        momentoDe(prev) === momentoDe(d) && estacionDe(prev) === estacionDe(d) ? prev : d,
      );
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const momentoAuto = momentoDe(ahora);
  const estacionAuto = estacionDe(ahora);
  const momento: MomentoDia = temaMapa === 'auto' ? momentoAuto : temaMapa;
  const estacion: Estacion = ambientePref === 'auto' ? estacionAuto : ambientePref;
  const paleta = paletaMapa(momento, estacion);
  const iconoTema = momento === 'dia' ? 'sol' : momento === 'atardecer' ? 'atardecer' : momento === 'madrugada' ? 'madrugada' : 'luna';
  const [seguir, setSeguir] = useState(true);
  const [caminando, setCaminando] = useState(false);
  const [rumbo, setRumbo] = useState<RumboAvatar>('s');
  const [permisoAviso, setPermisoAviso] = useState(permisoAvisos());
  const abrirRef = useRef(onAbrirQuest);
  abrirRef.current = onAbrirQuest;
  const prevPosRef = useRef(efectiva);
  const pausaRef = useRef<number | undefined>(undefined);

  const questActiva = misionActivaId ? buscarQuest(misionActivaId) : undefined;
  const destinoRuta = proximoDestino(questActiva, progressos[misionActivaId ?? '']?.pasosCompletados ?? []);

  visitedRef.current = visited;
  equipadoRef.current = equipado;
  sexoRef.current = sexo;

  /** Pinta la niebla: base + grano + perforado radial suave en celdas visitadas.
   *  El canvas vive en espacio de pantalla (no en el pane): siempre cubre el
   *  viewport, incluso a mitad de un arrastre. */
  const dibujarNiebla = () => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;
    const size = map.getSize();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ancho = Math.round(size.x * dpr);
    const alto = Math.round(size.y * dpr);
    if (canvas.width !== ancho || canvas.height !== alto) {
      canvas.width = ancho;
      canvas.height = alto;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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
      // El filtro de tema va por baldosa (no en el pane): una capa filtrada del
      // tamaño del pane se recorta al mover el mapa en GPUs móviles.
      className: 'osm-tiles',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = L.marker([efectiva.lat, efectiva.lng], {
      icon: L.divIcon({ html: avatarHtml(equipadoRef.current, sexoRef.current), className: '', iconSize: [56, 68], iconAnchor: [28, 52] }),
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

    // Redibuja la niebla durante el arrastre/zoom (throttle a un frame).
    let pendiente = 0;
    const programar = () => {
      if (pendiente) return;
      pendiente = window.requestAnimationFrame(() => {
        pendiente = 0;
        dibujarRef.current();
      });
    };
    map.on('move zoom moveend zoomend resize', programar);
    // Si el jugador arrastra el mapa, deja de seguirlo (evita el "salto" al caminar).
    map.on('dragstart', () => setSeguir(false));
    dibujarRef.current();
    return () => {
      window.cancelAnimationFrame(pendiente);
      map.off('move zoom moveend zoomend resize', programar);
      map.remove();
      mapRef.current = null;
      rutaRef.current = null;
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

  // Ruta punteada hasta el próximo destino de la misión activa.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!destinoRuta) {
      rutaRef.current?.remove();
      rutaRef.current = null;
      return;
    }
    const puntos: [number, number][] = [
      [efectiva.lat, efectiva.lng],
      [destinoRuta.latitud, destinoRuta.longitud],
    ];
    if (!rutaRef.current) {
      rutaRef.current = L.polyline(puntos, {
        color: '#FFD23F',
        weight: 2,
        opacity: 0.75,
        dashArray: '6 8',
        interactive: false,
      }).addTo(map);
    } else {
      rutaRef.current.setLatLngs(puntos);
    }
  }, [efectiva, destinoRuta]);

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

  // Detecta desplazamiento: orienta el sprite y desplaza el paso hacia el rumbo.
  useEffect(() => {
    const prev = prevPosRef.current;
    prevPosRef.current = efectiva;
    const dLat = efectiva.lat - prev.lat;
    const dLng = efectiva.lng - prev.lng;
    if (dLat === 0 && dLng === 0) return;
    const metros = Math.hypot(
      dLat * 111320,
      dLng * 111320 * Math.cos((efectiva.lat * Math.PI) / 180),
    );
    if (metros < 0.5) return; // ignora ruido del GPS
    const x = dLng * 111320 * Math.cos((efectiva.lat * Math.PI) / 180);
    const y = dLat * 111320;
    const nuevoRumbo: RumboAvatar =
      Math.abs(x) > Math.abs(y) ? (x > 0 ? 'e' : 'w') : y > 0 ? 'n' : 's';
    setRumbo(nuevoRumbo);
    setCaminando(true);
    window.clearTimeout(pausaRef.current);
    pausaRef.current = window.setTimeout(() => setCaminando(false), 420);
  }, [efectiva]);

  useEffect(() => () => window.clearTimeout(pausaRef.current), []);

  // Cambiar de ropa, caminar o cambiar el rumbo refresca el avatar.
  useEffect(() => {
    markerRef.current?.setIcon(
      L.divIcon({
        html: avatarHtml(equipado, sexo, caminando, rumbo),
        className: '',
        iconSize: [56, 68],
        iconAnchor: [28, 52],
      }),
    );
  }, [equipado, sexo, caminando, rumbo]);

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
    <div
      className={`relative h-full w-full overflow-hidden ${paleta.claro ? 'mapa-dia' : 'mapa-noche'}`}
      style={
        {
          '--ru-map-filter': paleta.filtro,
          '--ru-map-fondo': paleta.fondo,
          '--ru-tinte': paleta.tinte,
          '--ru-tinte-ambiente': paleta.tinteAmbiente,
          '--ru-vineta': paleta.vineta,
        } as CSSProperties
      }
    >
      <div ref={contRef} className="absolute inset-0" />
      {/* Tintes sobre las baldosas (bajo la niebla y los pines). */}
      <div className="ru-tinte-momento" />
      <div className="ru-tinte-ambiente" />
      <canvas ref={canvasRef} className="ru-niebla" aria-hidden />
      <div className="ru-vignette" />

      {/* Banner de proximidad */}
      {alerta && (
        <div className="absolute inset-x-0 top-[118px] z-[1100] flex justify-center px-3">
          <div className="w-full overflow-hidden px-frame px-frame--gold p-3">
            <button onClick={() => { onAbrirQuest(alerta.questId); descartarAlerta(); }} className="block w-full pr-7 text-left">
              <div className="flex items-center gap-2 font-pixel text-[10px] tracking-widest text-ruta-gold">
                <Sprite svg={uiSvg('target')} size={12} />
                {alerta.sensible ? 'MISIÓN CERCANA' : `LLEGASTE · ~${alerta.distanciaM} M`}
              </div>
              <div className="mt-1 break-words font-pixel text-sm font-bold leading-5 text-ruta-parchment">
                {alerta.sensible ? 'Tienes una misión secundaria cerca' : `${alerta.nombre} · ${alerta.questTitulo}`}
              </div>
              <div className="mt-0.5 font-pixel text-[10px] leading-4 text-ruta-muted">Toca para abrir la misión →</div>
            </button>
            <button
              onClick={descartarAlerta}
              aria-label="Descartar alerta"
              className="px-btn absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center font-pixel text-xs text-ruta-muted"
            >
              ✕
            </button>
          </div>
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
            <span className="font-pixel text-[10px] text-ruta-xp">+{XP_POR_CELDA} XP</span>
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
          <button onClick={() => setMode('gps')} className={`px-btn flex min-w-0 flex-1 items-center justify-center gap-2 py-2 font-pixel text-[11px] ${mode === 'gps' ? 'px-btn--on' : 'text-ruta-muted'}`}>
            <Sprite svg={uiSvg('gps')} size={14} /> {mode === 'gps' && !real ? 'GPS…' : 'GPS'}
          </button>
          <button onClick={() => setMode('joystick')} className={`px-btn flex min-w-0 flex-1 items-center justify-center gap-2 py-2 font-pixel text-[11px] ${mode === 'joystick' ? 'px-btn--on' : 'text-ruta-muted'}`}>
            <Sprite svg={uiSvg('joystick')} size={14} /> PAD
          </button>
          <button onClick={resetFog} title="Reiniciar niebla" aria-label="Reiniciar niebla" className="px-btn flex h-9 w-9 flex-none items-center justify-center text-ruta-muted">
            <Sprite svg={uiSvg('fog')} size={16} />
          </button>
          <button onClick={toggleSonido} title={sonido ? 'Silenciar sonidos' : 'Activar sonidos'} aria-label={sonido ? 'Silenciar' : 'Activar sonido'} className="px-btn flex h-9 w-9 flex-none items-center justify-center text-ruta-muted">
            <Sprite svg={uiSvg(sonido ? 'soundOn' : 'soundOff')} size={16} />
          </button>
          <button
            onClick={() => setPanelTema((v) => !v)}
            title={`Tema del mapa: ${ETIQUETA_MOMENTO[momento]} · ${ETIQUETA_ESTACION[estacion]}${temaMapa === 'auto' ? ' (auto)' : ''}`}
            aria-label="Ajustar tema del mapa"
            aria-expanded={panelTema}
            className={`px-btn flex h-9 w-9 flex-none items-center justify-center ${paleta.claro ? 'text-ruta-gold' : 'text-ruta-muted'}`}
          >
            <Sprite svg={uiSvg(iconoTema)} size={16} />
          </button>
          {!avisosActivados && permisoAviso !== 'denied' && (
            <button onClick={pedirAvisos} aria-label="Activar avisos" className="px-btn flex h-9 w-9 flex-none items-center justify-center text-ruta-burocracia">
              <Sprite svg={uiSvg('bell')} size={16} />
            </button>
          )}
        </div>

        {mode === 'gps' && permiso !== 'ok' && (
          <div className="px-frame border-ruta-valentia px-2 py-1 font-pixel text-[10px] text-ruta-valentia">
            {permiso === 'denegado'
              ? 'GPS bloqueado · permite ubicación en el navegador'
              : 'Buscando GPS… sal al exterior y espera el fix'}
          </div>
        )}
        {mode === 'joystick' && permiso === 'denegado' && (
          <div className="px-frame border-ruta-valentia px-2 py-1 font-pixel text-[10px] text-ruta-valentia">
            Sin GPS del navegador · usando pad
          </div>
        )}

        {panelTema && (
          <div className="px-frame space-y-2 p-2">
            <div>
              <div className="flex items-center justify-between font-pixel text-[9px] tracking-widest text-ruta-muted">
                <span>MOMENTO</span>
                <span className="text-ruta-gold">{temaMapa === 'auto' ? `AUTO · ${ETIQUETA_MOMENTO[momentoAuto]}` : 'FIJO'}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <button onClick={() => setTemaMapa('auto')} className={`px-btn px-2 py-1 font-pixel text-[10px] ${temaMapa === 'auto' ? 'px-btn--on' : 'text-ruta-muted'}`}>
                  AUTO
                </button>
                {MOMENTOS.map((m) => (
                  <button key={m} onClick={() => setTemaMapa(m)} className={`px-btn px-2 py-1 font-pixel text-[10px] ${temaMapa === m ? 'px-btn--on' : 'text-ruta-muted'}`}>
                    {ETIQUETA_MOMENTO[m].toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between font-pixel text-[9px] tracking-widest text-ruta-muted">
                <span>AMBIENTE</span>
                <span className="text-ruta-gold">{ambientePref === 'auto' ? `AUTO · ${ETIQUETA_ESTACION[estacionAuto]}` : 'FIJO'}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <button onClick={() => setAmbiente('auto')} className={`px-btn px-2 py-1 font-pixel text-[10px] ${ambientePref === 'auto' ? 'px-btn--on' : 'text-ruta-muted'}`}>
                  AUTO
                </button>
                {ESTACIONES.map((e) => (
                  <button key={e} onClick={() => setAmbiente(e)} className={`px-btn px-2 py-1 font-pixel text-[10px] ${ambientePref === e ? 'px-btn--on' : 'text-ruta-muted'}`}>
                    {ETIQUETA_ESTACION[e].toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
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
