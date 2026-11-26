import L from 'leaflet';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Joystick from './Joystick';
import { Sprite, pinGlifo, pinSvg, uiSvg, type PinEstado } from './sprites';
import { poiSvg } from './poi-icons';
import { avatarSvgRumbo, type RumboAvatar } from './avatar';
import { ETIQUETA_POI, INTERES_POI, RADIO_POI_M, cargarPois, type Poi } from '../game/pois';
import { generarMisionDesdePoi } from '../game/generador';
import { REVEAL_RADIUS_M, XP_POR_CELDA, cellCenter, haversineM } from '../game/fog';
import { activarAvisos, useProximity } from '../game/useProximity';
import { detenerMusica, desbloquearAudio, instalarDesbloqueoAudio, iniciarMusica, musicaSonando, sonar } from '../game/audio';
import { formatoDistancia, misionesCercanas, type Cercana } from '../game/cercanas';
import { LIMITE_PAN_M, ZOOM_MAX_MAPA, ZOOM_MIN_MAPA, centroFueraDeLimite, limitarCentro } from '../game/mapa';
import { agruparPuntos } from '../game/poi-cluster';
import { permisoAvisos } from '../game/alerts';
import { proximoDestino } from '../game/proximity';
import {
  ESTACIONES,
  ETIQUETA_ESTACION,
  ETIQUETA_MOMENTO,
  MOMENTOS,
  estacionDe,
  momentoSolar,
  paletaMapa,
  type Estacion,
  type MomentoDia,
} from '../game/ambiente';
import type { Equipamiento, Sexo } from '../game/types';
import {
  buscarQuest,
  listaMisionesMapa,
  questConDestino,
  useAlertStore,
  useExplorationStore,
  usePlayerStore,
  usePresenceStore,
  useQuestStore,
  usePerfilStore,
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

/** Pin de lugar: icono del tipo + badge `!` que cambia con el estado de la misión.
 *  disponible = dorado, activa = rojo, hecha = verde. */
const poiHtml = (categoria: string, estado: 'disponible' | 'activa' | 'completada', destacado = false) =>
  `<div class="ru-poi-wrap">
    <div class="ru-poi-badge ru-poi-badge--${estado}">!</div>
    <div class="ru-poi${destacado ? ' ru-poi--propio' : ''}">${poiSvg(categoria)}</div>
  </div>`;

/** Formas de partícula por estación. */
type FormaParticula = 'copo' | 'hoja' | 'petalo' | 'luciernaga';

interface ConfigEstacion {
  n: number;
  forma: FormaParticula;
  sube: boolean;
  /** Fracción de pantalla por segundo. */
  vel: number;
  /** Amplitud del vaivén lateral (0–1 de ancho). */
  viento: number;
  /** Giro en rad/s. */
  giro: number;
  colores: string[];
  rMin: number;
  rMax: number;
}

const CONFIG_ESTACION: Record<Estacion, ConfigEstacion> = {
  invierno: {
    n: 64, forma: 'copo', sube: false, vel: 0.1, viento: 0.022, giro: 0.8,
    colores: ['#FFFFFF', '#E8F2FF', '#CBDDF7'], rMin: 1.1, rMax: 2.3,
  },
  otonio: {
    n: 36, forma: 'hoja', sube: false, vel: 0.13, viento: 0.042, giro: 2.2,
    colores: ['#E0641F', '#C23B1A', '#F0A02E', '#8A4A12'], rMin: 2.2, rMax: 4.2,
  },
  primavera: {
    n: 36, forma: 'petalo', sube: false, vel: 0.1, viento: 0.034, giro: 1.9,
    colores: ['#E75D8F', '#F091B5', '#FFD23F', '#7CB832'], rMin: 1.8, rMax: 3.4,
  },
  verano: {
    n: 26, forma: 'luciernaga', sube: true, vel: 0.035, viento: 0.026, giro: 0,
    colores: ['#FFF2A8', '#FFD23F', '#FFF9DC'], rMin: 1.2, rMax: 2.2,
  },
};

interface Particula {
  x: number;
  y: number;
  /** Profundidad 0–1: cambia tamaño, alfa y velocidad (paralaje). */
  z: number;
  v: number;
  fase: number;
  rot: number;
  vrot: number;
  r: number;
  color: string;
  a: number;
}

/** Halo radial cacheado y teñido del color pedido (para luciérnagas). */
function spriteBrillo(color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  if (!g) return c;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, 32, 32);
  return c;
}

/** Partículas estacionales sobre el mapa (canvas liviano, sin DOM por copo).
 *  invierno = copos de nieve, otoño = hojas, primavera = pétalos, verano = luciérnagas.
 *  Va sobre la niebla (z 600 < HUD 1100) y respeta `prefers-reduced-motion`. */
function EfectoEstacion({ estacion }: { estacion: Estacion }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cfg = CONFIG_ESTACION[estacion];
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);

    let ancho = 300;
    let alto = 300;
    // Tamaño real solo al montar o redimensionar (nunca por frame: reasignar
    // `width` cada frame vacía el canvas y fuerza layout en cada tick).
    const ajustar = () => {
      ancho = canvas.clientWidth || 300;
      alto = canvas.clientHeight || 300;
      canvas.width = Math.round(ancho * dpr);
      canvas.height = Math.round(alto * dpr);
    };
    ajustar();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null;
    ro?.observe(canvas);

    const brillos = new Map<string, HTMLCanvasElement>();
    if (cfg.forma === 'luciernaga') for (const c of cfg.colores) brillos.set(c, spriteBrillo(c));

    // Densidad proporcional al área, con techo para no castigar móviles.
    const escala = Math.min(1.5, Math.max(0.6, (ancho * alto) / (400 * 700)));
    const total = Math.max(6, Math.round(cfg.n * escala * (reducir ? 0.35 : 1)));

    const crear = (): Particula => {
      const z = 0.25 + Math.random() * 0.75;
      return {
        x: Math.random() * 1.2 - 0.1,
        y: cfg.sube ? Math.random() * 1.2 : Math.random() * 1.3 - 0.15,
        z,
        v: cfg.vel * (0.55 + z * 0.9),
        fase: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI * 2,
        vrot: reducir ? 0 : (Math.random() - 0.5) * cfg.giro * 2,
        r: (cfg.rMin + Math.random() * (cfg.rMax - cfg.rMin)) * (0.65 + z * 0.6),
        color: cfg.colores[Math.floor(Math.random() * cfg.colores.length)],
        a: 0.32 + z * 0.5 + Math.random() * 0.16,
      };
    };
    const ps: Particula[] = Array.from({ length: total }, crear);

    let vivo = true;
    let raf = 0;
    let previo = performance.now();

    const dibujar = (t: number) => {
      if (!vivo) return;
      const dt = Math.min(64, t - previo) / 1000;
      previo = t;
      const reloj = t * 0.001;
      // Ráfaga de viento lenta y compartida: todo el campo respira junto.
      const vientoGlobal = Math.sin(reloj * 0.35) * cfg.viento * 0.55;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, ancho, alto);

      for (const p of ps) {
        p.y += (cfg.sube ? -p.v : p.v) * dt;
        p.x += (Math.sin(p.fase + reloj * 0.9) * cfg.viento + vientoGlobal) * dt * (0.4 + p.z);
        p.rot += p.vrot * dt;

        // Recicla al salir por cualquier borde (antes `x` se escapaba y la
        // partícula desaparecía para siempre: se veía "una sola").
        if (p.y < -0.15) p.y = 1.15;
        else if (p.y > 1.15) p.y = -0.15;
        if (p.x < -0.2) p.x = 1.2;
        else if (p.x > 1.2) p.x = -0.2;

        const px = p.x * ancho;
        const py = p.y * alto;
        ctx.globalAlpha = p.a;

        if (cfg.forma === 'copo') {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(0.7, p.r * 0.32);
          const L = p.r * 1.9;
          ctx.beginPath();
          for (let k = 0; k < 3; k++) {
            const ang = (k * Math.PI) / 3;
            const dx = Math.cos(ang) * L;
            const dy = Math.sin(ang) * L;
            ctx.moveTo(-dx, -dy);
            ctx.lineTo(dx, dy);
          }
          ctx.stroke();
          ctx.restore();
        } else if (cfg.forma === 'hoja') {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * 1.5, p.r * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();
          // Nervadura: le da lectura de hoja a tamaño pequeño.
          ctx.globalAlpha = p.a * 0.5;
          ctx.strokeStyle = '#4A2A10';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(-p.r * 1.25, 0);
          ctx.lineTo(p.r * 1.25, 0);
          ctx.stroke();
          ctx.restore();
        } else if (cfg.forma === 'petalo') {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * 1.35, p.r * 0.68, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = p.a * 0.45;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.ellipse(-p.r * 0.3, -p.r * 0.15, p.r * 0.55, p.r * 0.28, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Luciérnaga: halo que pulsa + núcleo.
          const pulso = 0.5 + 0.5 * Math.sin(p.fase + reloj * 2.2);
          const sprite = brillos.get(p.color);
          const d = p.r * 10;
          if (sprite) {
            ctx.globalAlpha = p.a * (0.45 + pulso * 0.55);
            ctx.drawImage(sprite, px - d / 2, py - d / 2, d, d);
          }
          ctx.globalAlpha = p.a;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(px, py, p.r * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = window.requestAnimationFrame(dibujar);
    };
    raf = window.requestAnimationFrame(dibujar);
    return () => {
      vivo = false;
      window.cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [estacion]);
  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 z-[600] h-full w-full"
      aria-hidden
    />
  );
}

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
export default function MapView({ onAbrirQuest, onCrearMision }: { onAbrirQuest: (id: string) => void; onCrearMision: () => void }) {
  const contRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const ringRef = useRef<L.Circle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const granoRef = useRef<HTMLCanvasElement | null>(null);
  const pinesRef = useRef<L.LayerGroup | null>(null);
  const radiosRef = useRef<L.LayerGroup | null>(null);
  const fantasmasRef = useRef<L.LayerGroup | null>(null);
  const poisRef = useRef<L.LayerGroup | null>(null);
  const rutaRef = useRef<L.Polyline | null>(null);
  const rutaCasingRef = useRef<L.Polyline | null>(null);
  const visitedRef = useRef<string[]>([]);
  const equipadoRef = useRef<Equipamiento>({});
  const sexoRef = useRef<Sexo>('m');
  const { efectiva, mode, permiso, real, detalle, errorInfo, precisionM, reintentar, alerta, descartarAlerta } = useProximity();
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const setMode = useExplorationStore((s) => s.setMode);
  const centerMock = useExplorationStore((s) => s.centerMock);
  const visited = useExplorationStore((s) => s.visited);
  const resetFog = useExplorationStore((s) => s.resetFog);
  const misionActivaId = usePlayerStore((s) => s.jugador.misionActivaId);
  const secundariasActivas = usePlayerStore((s) => s.jugador.secundariasActivas);
  const activas = [...new Set([...(misionActivaId ? [misionActivaId] : []), ...secundariasActivas])];
  const firmaActivas = activas.join(',');
  const equipado = usePlayerStore((s) => s.jugador.equipado);
  const sexo = usePlayerStore((s) => s.jugador.sexo);
  const progressos = useQuestStore((s) => s.progresos);
  const customs = useQuestStore((s) => s.customs);
  const otros = usePresenceStore((s) => s.otros);
  const avisosActivados = useAlertStore((s) => s.avisosActivados);
  const sonido = useSettingsStore((s) => s.sonido);
  const toggleSonido = useSettingsStore((s) => s.toggleSonido);
  const musica = useSettingsStore((s) => s.musica);
  const toggleMusica = useSettingsStore((s) => s.toggleMusica);
  const [musicaOn, setMusicaOn] = useState(() => musicaSonando());
  // El contexto solo se crea/reanuda en un gesto (politica de autoplay):
  // listener global, haya o no musica. Asi sonar() nunca crea contexto solo.
  useEffect(() => {
    instalarDesbloqueoAudio();
  }, []);
  // La música solo puede arrancar/reanudarse desde un gesto. Se mantiene el
  // listener: si el primer toque no alcanzó, el siguiente reintenta sin recargar.
  useEffect(() => {
    if (!musica) {
      detenerMusica();
      setMusicaOn(false);
      return;
    }
    const arrancar = () => {
      if (!useSettingsStore.getState().musica) return;
      desbloquearAudio();
      if (iniciarMusica()) {
        setMusicaOn(true);
        // El contexto puede tardar unos ms en correr: confirma el estado real
        // para que el boton no quede encendido con la musica en silencio.
        window.setTimeout(() => setMusicaOn(musicaSonando()), 500);
      }
    };
    // Captura antes que Leaflet/Joystick, que pueden parar la propagación de
    // los eventos y dejar el AudioContext suspendido indefinidamente.
    window.addEventListener('pointerdown', arrancar, true);
    window.addEventListener('keydown', arrancar, true);
    return () => {
      window.removeEventListener('pointerdown', arrancar, true);
      window.removeEventListener('keydown', arrancar, true);
    };
  }, [musica]);
  const pulsarMusica = () => {
    // Fuente de verdad: el motor real, no el estado local (tras recargar o
    // HMR pueden desincronizarse y el boton haria lo contrario).
    if (musicaSonando()) {
      detenerMusica();
      setMusicaOn(false);
      if (musica) toggleMusica();
    } else {
      if (!musica) toggleMusica();
      const ok = iniciarMusica();
      setMusicaOn(ok);
      if (ok) window.setTimeout(() => setMusicaOn(musicaSonando()), 500);
    }
    sonar('blip', sonido);
  };
  const temaMapa = useSettingsStore((s) => s.temaMapa) ?? 'auto';
  const ambientePref = useSettingsStore((s) => s.ambiente) ?? 'auto';
  const setTemaMapa = useSettingsStore((s) => s.setTemaMapa);
  const setAmbiente = useSettingsStore((s) => s.setAmbiente);
  const [panelTema, setPanelTema] = useState(false);
  const [panelControles, setPanelControles] = useState(false);
  /** Teletransporte (solo PAD): el siguiente toque en el mapa mueve al personaje. */
  const [modoTeleport, setModoTeleport] = useState(false);
  const teleportRef = useRef(false);
  teleportRef.current = modoTeleport;
  /** Guardia de reentrada del acotador de mapa. */
  const acotandoRef = useRef(false);
  const [zoomMapa, setZoomMapa] = useState(16);
  const [ahora, setAhora] = useState(() => new Date());
  const posicionSolRef = useRef(efectiva);
  posicionSolRef.current = efectiva;
  // Recalcula cada minuto, pero solo re-renderiza al cruzar de franja (hora o estación).
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setAhora((prev) =>
        momentoSolar(prev, posicionSolRef.current) === momentoSolar(d, posicionSolRef.current) &&
        estacionDe(prev) === estacionDe(d) ? prev : d,
      );
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const momentoAuto = momentoSolar(ahora, efectiva);
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
  const posRef = useRef(efectiva);
  posRef.current = efectiva;
  const pausaRef = useRef<number | undefined>(undefined);

  // Ruta: la principal manda; si no tiene paso pendiente, la primera secundaria.
  const rutaActivaId = [misionActivaId, ...secundariasActivas].find((id) => {
    if (!id) return false;
    const base = buscarQuest(id);
    if (!base) return false;
    const q = questConDestino(base, progressos[id]);
    return !!proximoDestino(q, progressos[id]?.pasosCompletados ?? []);
  }) ?? null;
  const questRutaBase = rutaActivaId ? buscarQuest(rutaActivaId) : undefined;
  const questRuta = questRutaBase ? questConDestino(questRutaBase, progressos[rutaActivaId ?? '']) : undefined;
  const destinoRuta = proximoDestino(questRuta, progressos[rutaActivaId ?? '']?.pasosCompletados ?? []);

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
      minZoom: ZOOM_MIN_MAPA,
      maxZoom: ZOOM_MAX_MAPA,
    });
    mapRef.current = map;
    setZoomMapa(map.getZoom());
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
    poisRef.current = L.layerGroup().addTo(map);
    // Pane propio sobre la niebla (z 550 < pines 600) para la guía de ruta.
    const paneGuia = map.createPane('rutaGuia');
    paneGuia.style.zIndex = '550';
    paneGuia.style.pointerEvents = 'none';

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
    const actualizarZoom = () => setZoomMapa(map.getZoom());
    map.on('zoomend', actualizarZoom);
    // Si el jugador arrastra el mapa, deja de seguirlo (evita el "salto" al caminar).
    map.on('dragstart', () => setSeguir(false));

    // Límite de desplazamiento: el centro no se aleja más de LIMITE_PAN_M del personaje.
    // Diferido + guardia de reentrada: setView dentro de moveend reentra a Leaflet
    // y recursaba (too much recursion). En teletransporte no se acota: se va lejos a propósito.
    const acotar = () => {
      if (acotandoRef.current || teleportRef.current) return;
      const c = map.getCenter();
      const centro = { lat: c.lat, lng: c.lng };
      if (!centroFueraDeLimite(centro, posRef.current)) return;
      acotandoRef.current = true;
      window.requestAnimationFrame(() => {
        try {
          if (mapRef.current !== map || teleportRef.current) return;
          const cc = map.getCenter();
          const centro2 = { lat: cc.lat, lng: cc.lng };
          if (!centroFueraDeLimite(centro2, posRef.current)) return;
          const fijado = limitarCentro(centro2, posRef.current, LIMITE_PAN_M - 50);
          map.setView([fijado.lat, fijado.lng], map.getZoom(), { animate: false });
        } finally {
          acotandoRef.current = false;
        }
      });
    };
    map.on('moveend', acotar);

    // Teletransporte en captura DOM: también funciona al tocar marcadores,
    // antes de que los handlers de Leaflet los consuman. Filtra arrastres/UI.
    const contenedor = map.getContainer();
    let inicioPuntero: { x: number; y: number } | null = null;
    const alPunteroAbajo = (e: PointerEvent) => {
      inicioPuntero = { x: e.clientX, y: e.clientY };
    };
    const alCancelarPuntero = () => {
      inicioPuntero = null;
    };
    const alClickCaptura = (e: MouseEvent) => {
      if (!teleportRef.current || modeRef.current !== 'joystick') return;
      const objetivo = e.target instanceof Element ? e.target : null;
      if (objetivo?.closest('.leaflet-control, .leaflet-popup, .leaflet-tooltip')) return;

      // Un arrastre desplaza el mapa; no debe confirmar el teletransporte.
      if (inicioPuntero) {
        const dx = e.clientX - inicioPuntero.x;
        const dy = e.clientY - inicioPuntero.y;
        if (Math.hypot(dx, dy) > 10) {
          inicioPuntero = null;
          return;
        }
      }
      inicioPuntero = null;
      const latlng = map.mouseEventToLatLng(e);
      teleportRef.current = false;
      setModoTeleport(false);
      setSeguir(true);
      // usePlayerPosition revela solo las celdas alrededor del destino; no interpola
      // ni descubre el trayecto entre el origen y el punto elegido.
      const destino = { lat: latlng.lat, lng: latlng.lng };
      useExplorationStore.getState().centerMock(destino);
      // La posición efectiva se actualiza en el próximo render: se adelanta aquí
      // para que el acotador no devuelva el mapa con la posición vieja.
      posRef.current = destino;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    contenedor.addEventListener('pointerdown', alPunteroAbajo, true);
    contenedor.addEventListener('pointercancel', alCancelarPuntero, true);
    contenedor.addEventListener('click', alClickCaptura, true);

    dibujarRef.current();
    return () => {
      window.cancelAnimationFrame(pendiente);
      map.off('move zoom moveend zoomend resize', programar);
      map.off('zoomend', actualizarZoom);
      map.off('moveend', acotar);
      contenedor.removeEventListener('pointerdown', alPunteroAbajo, true);
      contenedor.removeEventListener('pointercancel', alCancelarPuntero, true);
      contenedor.removeEventListener('click', alClickCaptura, true);
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
    const todas = listaMisionesMapa();
    const activasIds = firmaActivas ? firmaActivas.split(',') : [];
    for (const q of todas) {
      // Destino del jugador aplicado: el pin se mueve al punto buscado.
      const qq = questConDestino(q, progressos[q.id]);
      for (const u of qq.ubicaciones ?? []) {
        const estadoProg = progressos[q.id]?.estado;
        const esActiva = activasIds.includes(q.id);
        const estado: PinEstado =
          estadoProg === 'completada' ? 'completada' : esActiva ? 'activa' : u.sensible ? 'sensible' : 'disponible';
        const pin = L.marker([u.latitud, u.longitud], {
      icon: L.divIcon({ html: pinHtml(estado), className: '', iconSize: [26, 34], iconAnchor: [13, 34] }),
          keyboard: false,
          zIndexOffset: estado === 'activa' ? 900 : 500,
        });
        pin.on('click', () => abrirRef.current(q.id));
        pin.addTo(pines);
        if (esActiva) {
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
  }, [firmaActivas, customs, progressos]);

  // Guía hasta el próximo destino: borde blanco + núcleo fucsia animado,
  // legible sobre baldosas claras y oscuras (antes amarilla fina bajo la niebla).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!destinoRuta) {
      rutaRef.current?.remove();
      rutaRef.current = null;
      rutaCasingRef.current?.remove();
      rutaCasingRef.current = null;
      return;
    }
    const puntos: [number, number][] = [
      [efectiva.lat, efectiva.lng],
      [destinoRuta.latitud, destinoRuta.longitud],
    ];
    if (!rutaCasingRef.current) {
      rutaCasingRef.current = L.polyline(puntos, {
        pane: 'rutaGuia',
        color: '#FFFFFF',
        weight: 7,
        opacity: 0.9,
        dashArray: '7 9',
        interactive: false,
      }).addTo(map);
    } else {
      rutaCasingRef.current.setLatLngs(puntos);
    }
    if (!rutaRef.current) {
      rutaRef.current = L.polyline(puntos, {
        pane: 'rutaGuia',
        color: '#FF3D5E',
        weight: 3.5,
        opacity: 1,
        dashArray: '7 9',
        interactive: false,
        className: 'ruta-guia',
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

  /** Cambiar de modo siempre recentra en el personaje (GPS o PAD). */
  const cambiarModo = (siguiente: typeof mode) => {
    if (siguiente !== 'joystick') setModoTeleport(false);
    if (siguiente === 'joystick' && real) centerMock(real);
    setSeguir(true);
    setMode(siguiente);
    const destino = siguiente === 'gps' ? (real ?? efectiva) : (real ?? efectiva);
    mapRef.current?.setView([destino.lat, destino.lng], mapRef.current.getZoom(), { animate: true });
  };

  const pedirAvisos = async () => {
    const ok = await activarAvisos();
    setPermisoAviso(permisoAvisos());
    if (!ok) setPermisoAviso('denied');
  };

  // ── Misiones cercanas: tras el fix GPS se ordenan los objetivos por distancia.
  const gpsListo = mode === 'gps' ? real != null : true;
  const [estadoCercanas, setEstadoCercanas] = useState<'buscando' | 'cargando' | 'listo'>('cargando');
  const [cercanas, setCercanas] = useState<Cercana[]>([]);
  const [verCercanas, setVerCercanas] = useState(false);
  const [verLugares, setVerLugares] = useState(false);
  // Firma a ~111 m: recalcula al moverse de cuadra, no 10 veces por segundo.
  const firmaPos = `${efectiva.lat.toFixed(3)},${efectiva.lng.toFixed(3)}`;
  useEffect(() => {
    if (!gpsListo) {
      setEstadoCercanas('buscando');
      return;
    }
    setEstadoCercanas('cargando');
    // Cede un frame para que "Cargando objetivos…" pinte antes del cálculo.
    const id = window.setTimeout(() => {
      const prog = useQuestStore.getState().progresos;
      const [lat, lng] = firmaPos.split(',').map(Number);
      const todas = listaMisionesMapa().map((q) => questConDestino(q, prog[q.id]));
      setCercanas(
        misionesCercanas({ lat, lng }, todas, (qid) => prog[qid]?.estado ?? 'disponible'),
      );
      setEstadoCercanas('listo');
    }, 60);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsListo, firmaPos, progressos, customs]);

  // Al primer fix GPS en modo gps: centra el mapa en la posición real.
  const habiaReal = useRef(!!real);
  useEffect(() => {
    if (real && !habiaReal.current && mapRef.current) {
      mapRef.current.setView([real.lat, real.lng], Math.max(mapRef.current.getZoom(), 16), { animate: true });
      setSeguir(true);
    }
    habiaReal.current = !!real;
  }, [real]);

  // ── Lugares de interés (OSM/Overpass): farmacias, salud y trámites cercanos.
  const [pois, setPois] = useState<Poi[]>([]);
  const [estadoPois, setEstadoPois] = useState<'espera' | 'cargando' | 'listo' | 'error'>('espera');
  /** true si se muestran datos guardados por falla de red/cuota. */
  const [poisStale, setPoisStale] = useState(false);
  const [poiSel, setPoiSel] = useState<Poi | null>(null);
  const [avisoPoi, setAvisoPoi] = useState<string | null>(null);
  const [intentoPoi, setIntentoPoi] = useState(0);
  const poisDatosRef = useRef(pois);
  poisDatosRef.current = pois;
  const ultimoFetchPoi = useRef(0);
  const ultimoIntentoPoi = useRef(0);
  /** Centro de la última consulta real a proveedores de POI. */
  const centroConsultaPoi = useRef<{ lat: number; lng: number } | null>(null);
  const intereses = usePerfilStore((s) => s.perfil.intereses);
  const firmaIntereses = intereses.join(',');
  useEffect(() => {
    if (!gpsListo) {
      setEstadoPois('espera');
      return;
    }
    // Si el jugador se fue a otra zona (teletransporte o caminata larga),
    // se descarta la lista anterior y se consulta de inmediato sin cooldown.
    const centro = centroConsultaPoi.current;
    const saltoZona = centro == null || haversineM(centro, efectiva) > 1200;
    const forzado = intentoPoi !== ultimoIntentoPoi.current;
    ultimoIntentoPoi.current = intentoPoi;
    if (!forzado && !saltoZona && Date.now() - ultimoFetchPoi.current < 120000) {
      setEstadoPois(poisDatosRef.current.length > 0 ? 'listo' : 'error');
      return;
    }
    ultimoFetchPoi.current = Date.now();
    centroConsultaPoi.current = efectiva;
    let cancelado = false;
    if (saltoZona) {
      setPois([]);
      setPoisStale(false);
      setPoiSel(null);
    }
    setEstadoPois('cargando');
    cargarPois(efectiva.lat, efectiva.lng)
      .then((r) => {
        if (cancelado) return;
        setPois(r.pois);
        setPoisStale(!!r.desactualizado);
        setEstadoPois('listo');
      })
      .catch(() => {
        if (!cancelado) {
          setPoisStale(false);
          // Si ya habia datos, se conservan en vez de vaciar a error.
          setEstadoPois(poisDatosRef.current.length > 0 ? 'listo' : 'error');
        }
      });
    return () => {
      cancelado = true;
    };
    // La firma a ~111 m evita recalcular en cada paso del PAD; el cooldown y
    // `saltoZona` controlan cuándo se consulta realmente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsListo, efectiva.lat.toFixed(3), efectiva.lng.toFixed(3), intentoPoi]);

  /** Solo lugares dentro del radio de búsqueda actual; afinidad y distancia ordenan la lista. */
  const poisOrdenados = [...pois]
    .filter((p) => haversineM(efectiva, p) <= RADIO_POI_M)
    .sort((a, b) => {
      const pa = intereses.includes(INTERES_POI[a.categoria]) ? 0 : 1;
      const pb = intereses.includes(INTERES_POI[b.categoria]) ? 0 : 1;
      return pa - pb || haversineM(efectiva, a) - haversineM(efectiva, b);
    });
  /** Lugares más cercanos, para mostrarlos también en "Cerca de ti". */
  const poisCercanos = poisOrdenados.slice(0, 4);
  const totalCercanos = cercanas.length + poisCercanos.length;
  // Si aparecen servicios y no había objetivos, abre la lista una vez:
  // antes el usuario veía "Cerca de ti" vacío y creía que no había nada.
  const autoAbiertoCercanas = useRef(false);
  useEffect(() => {
    if (autoAbiertoCercanas.current || estadoCercanas !== 'listo' || totalCercanos === 0) return;
    autoAbiertoCercanas.current = true;
    setVerCercanas(true);
  }, [estadoCercanas, totalCercanos]);


  // Pinta los POIs como posibles misiones (icono de tipo + badge de estado).
  useEffect(() => {
    const capa = poisRef.current;
    const map = mapRef.current;
    if (!capa || !map) return;
    capa.clearLayers();
    const interesesIds = firmaIntereses ? firmaIntereses.split(',') : [];
    const activasIds = firmaActivas ? firmaActivas.split(',') : [];
    const todasCustom = [...listaMisionesMapa()].filter((q) => q.id.startsWith('custom-'));
    const proyectados = poisOrdenados.map((p) => {
      const punto = map.latLngToContainerPoint([p.lat, p.lng]);
      return { valor: p, x: punto.x, y: punto.y };
    });
    // Agrupa a baja escala para reducir ruido visual. Al acercarse, cada POI
    // vuelve a su icono individual con categoría y badge de misión.
    const radioCluster = zoomMapa < 15.5 ? 72 : zoomMapa < 16.5 ? 46 : zoomMapa < 17 ? 26 : 0;
    const grupos = radioCluster
      ? agruparPuntos(proyectados, radioCluster)
      : proyectados.map((p) => ({ valores: [p.valor], x: p.x, y: p.y }));

    for (const grupo of grupos) {
      if (grupo.valores.length > 1) {
        const centro = map.containerPointToLatLng([grupo.x, grupo.y]);
        const cluster = L.marker([centro.lat, centro.lng], {
          icon: L.divIcon({
            html: `<div class="ru-poi-cluster">${grupo.valores.length}</div>`,
            className: '',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
          keyboard: false,
          title: `${grupo.valores.length} lugares cercanos · toca para acercar`,
        });
        cluster.on('click', () => {
          map.setView(
            [centro.lat, centro.lng],
            Math.min(ZOOM_MAX_MAPA, map.getZoom() + 2),
            { animate: true },
          );
        });
        cluster.addTo(capa);
        continue;
      }

      const p = grupo.valores[0];
      const propio = interesesIds.includes(INTERES_POI[p.categoria]);
      const mision = todasCustom.find((q) => q.poiId === p.id);
      const estado = mision
        ? (progressos[mision.id]?.estado === 'completada' ? 'completada' : activasIds.includes(mision.id) ? 'activa' : 'disponible')
        : 'disponible';
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          html: poiHtml(p.categoria, estado, propio),
          className: '',
          iconSize: [30, 34],
          iconAnchor: [15, 30],
        }),
        keyboard: false,
        title: `${p.nombre} · ${ETIQUETA_POI[p.categoria]}`,
      });
      marker.on('click', () => setPoiSel(p));
      marker.addTo(capa);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pois, firmaIntereses, customs, progressos, firmaActivas, zoomMapa, firmaPos]);

  /** Convierte el POI elegido en misión secundaria anclada ahí mismo. */
  const crearDesdePoi = (p: Poi) => {
    const { quest, dialogos } = generarMisionDesdePoi(p);
    useQuestStore.getState().agregarCustom(quest, dialogos);
    const r = useQuestStore.getState().activar(quest.id);
    if (r === 'limite') {
      setAvisoPoi('Ya tienes 2 secundarias activas · termina o cancela una primero. La misión quedó guardada.');
      sonar('blip', useSettingsStore.getState().sonido);
      return;
    }
    setAvisoPoi(null);
    setPoiSel(null);
    sonar('completar', useSettingsStore.getState().sonido);
    onAbrirQuest(quest.id);
  };

  /** Vuela al objetivo cercano (sin seguirlo: evita el salto al caminar). */
  const volarA = (lat: number, lng: number) => {
    setSeguir(false);
    mapRef.current?.setView([lat, lng], Math.max(mapRef.current?.getZoom() ?? 16, 16), { animate: true });
  };

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${paleta.claro ? 'mapa-dia' : 'mapa-noche'}${modoTeleport ? ' ru-teleport' : ''}`}
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
      {/* Clima estacional por fecha: nieve / hojas / pétalos / destellos. */}
      <EfectoEstacion estacion={estacion} />

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
          <button onClick={() => cambiarModo('gps')} className={`px-btn flex min-w-0 flex-1 items-center justify-center gap-2 py-2 font-pixel text-[11px] ${mode === 'gps' ? 'px-btn--on' : 'text-ruta-muted'}`}>
            <Sprite svg={uiSvg('gps')} size={14} /> {mode === 'gps' && !real ? 'GPS…' : 'GPS'}
          </button>
          <button onClick={() => cambiarModo('joystick')} className={`px-btn flex min-w-0 flex-1 items-center justify-center gap-2 py-2 font-pixel text-[11px] ${mode === 'joystick' ? 'px-btn--on' : 'text-ruta-muted'}`}>
            <Sprite svg={uiSvg('joystick')} size={14} /> PAD
          </button>
          {mode === 'joystick' && (
            <button
              onClick={() => setModoTeleport((v) => !v)}
              aria-pressed={modoTeleport}
              title="Teletransportarse (modo pruebas): toca el mapa"
              aria-label="Teletransportarse"
              className={`px-btn flex h-9 w-9 flex-none items-center justify-center font-pixel text-sm ${modoTeleport ? 'px-btn--on text-ruta-gold' : 'text-ruta-muted'}`}
            >
              ↗
            </button>
          )}
          <button
            onClick={() => setPanelControles((v) => !v)}
            aria-expanded={panelControles}
            aria-label="Más controles"
            title="Más controles"
            className={`px-btn flex h-9 w-9 flex-none items-center justify-center font-pixel text-base ${panelControles ? 'px-btn--on' : 'text-ruta-muted'}`}
          >
            ⚙
          </button>
        </div>

        {panelControles && (
          <div className="px-frame flex flex-wrap items-center gap-2 p-2">
            <button onClick={resetFog} title="Reiniciar niebla" aria-label="Reiniciar niebla" className="px-btn flex h-9 w-9 flex-none items-center justify-center text-ruta-muted">
              <Sprite svg={uiSvg('fog')} size={16} />
            </button>
            <button onClick={toggleSonido} title={sonido ? 'Silenciar sonidos' : 'Activar sonidos'} aria-label={sonido ? 'Silenciar' : 'Activar sonido'} className="px-btn flex h-9 w-9 flex-none items-center justify-center text-ruta-muted">
              <Sprite svg={uiSvg(sonido ? 'soundOn' : 'soundOff')} size={16} />
            </button>
            <button onClick={pulsarMusica} title={musicaOn ? 'Pausar música' : 'Música de fondo'} aria-label={musicaOn ? 'Pausar música' : 'Activar música'} aria-pressed={musicaOn} className={`px-btn flex h-9 w-9 flex-none items-center justify-center ${musicaOn ? 'px-btn--on' : 'text-ruta-muted'}`}>
              <span aria-hidden className="font-pixel text-base leading-none">{musicaOn ? '♫' : '♪'}</span>
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
        )}

        {mode === 'gps' && permiso !== 'ok' && (
          <div className="px-frame border-ruta-valentia px-2 py-1 font-pixel text-[10px] leading-4 text-ruta-valentia">
            {detalle === 'inseguro' ? (
              <>GPS necesita HTTPS · en el celu abre la app por HTTPS, no por IP http</>
            ) : detalle === 'permiso-denegado' || permiso === 'denegado' ? (
              <>GPS bloqueado · permite ubicación en el navegador y toca GPS</>
            ) : (
              <>Buscando GPS… sal al exterior con vista al cielo y espera el fix (el primero tarda hasta 1 min)</>
            )}
            {errorInfo && <div className="mt-0.5 opacity-80">{errorInfo}</div>}
            <button onClick={() => { reintentar(); centrar(); }} className="ml-2 underline">reintentar</button>
          </div>
        )}
        {mode === 'gps' && permiso === 'ok' && precisionM != null && (
          <div className={`px-frame px-2 py-1 font-pixel text-[10px] leading-4 ${precisionM > 100 ? 'border-ruta-valentia text-ruta-valentia' : 'text-ruta-muted'}`}>
            {precisionM > 100 ? (
              <>GPS aproximado ±{Math.round(precisionM)} m · revisa “ubicación precisa” en Android y sal al exterior</>
            ) : (
              <>GPS ±{Math.round(precisionM)} m</>
            )}
          </div>
        )}
        {mode === 'joystick' && permiso === 'denegado' && (
          <div className="px-frame border-ruta-valentia px-2 py-1 font-pixel text-[10px] text-ruta-valentia">
            Sin GPS del navegador · usando pad
          </div>
        )}
        {modoTeleport && (
          <div className="px-frame px-frame--gold flex items-center gap-2 px-2 py-1.5">
            <span className="min-w-0 flex-1 font-pixel text-[10px] leading-4 text-ruta-gold">
              ↗ TOCA EL MAPA PARA TELETRANSPORTARTE
            </span>
            <button
              onClick={() => setModoTeleport(false)}
              aria-label="Cancelar teletransporte"
              className="px-btn h-6 w-6 flex-none font-pixel text-[10px] text-ruta-muted"
            >
              ✕
            </button>
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

        {/* Objetivos cercanos: tras el fix GPS, ordenados por distancia. */}
        <div className="px-frame p-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVerCercanas((v) => !v)}
              aria-expanded={verCercanas}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
            >
              <span className="truncate font-pixel text-[9px] tracking-widest text-ruta-muted">
                {estadoCercanas === 'buscando' ? '◌ BUSCANDO GPS…' : estadoCercanas === 'cargando' ? '◌ CARGANDO OBJETIVOS…' : `◎ CERCA DE TI${totalCercanos ? ` · ${totalCercanos}` : ''}`}
              </span>
              <span className="font-pixel text-[10px] text-ruta-gold">{verCercanas ? '▾' : '▸'}</span>
            </button>
            {real && (
              <button
                onClick={() => {
                  centerMock(real);
                  setSeguir(true);
                  mapRef.current?.setView([real.lat, real.lng], Math.max(mapRef.current?.getZoom() ?? 16, 16), { animate: true });
                }}
                title="Llevar el PAD a mi GPS y recalcular"
                aria-label="Llevar el PAD a mi GPS y recalcular"
                className="px-btn flex h-7 flex-none items-center gap-1 px-2 font-pixel text-[9px] text-ruta-gold"
              >
                📍 MI GPS
              </button>
            )}
          </div>
          {verCercanas && estadoCercanas === 'listo' && totalCercanos === 0 && (
            <div className="mt-1 space-y-1.5">
              <div className="font-pixel text-[10px] leading-4 text-ruta-muted">
                {estadoPois === 'cargando' ? 'Buscando misiones y servicios…' : 'Sin objetivos en 5 km · juega donde estás'}
              </div>
              <button onClick={onCrearMision} className="px-btn px-btn--xp w-full py-2 font-pixel text-[10px] font-bold">
                ＋ CREAR MISIÓN AQUÍ
              </button>
            </div>
          )}
          {verCercanas && estadoCercanas === 'listo' && cercanas.map((c) => (
            <div key={`${c.questId}:${c.ubicacion.id}`} className="mt-1 flex min-w-0 items-center gap-2">
              <button onClick={() => { onAbrirQuest(c.questId); }} className="block min-w-0 flex-1 text-left">
                <div className="truncate font-pixel text-[11px] font-bold leading-4 text-ruta-parchment">
                  {c.ubicacion.nombre}
                </div>
                <div className="truncate font-pixel text-[9px] leading-3 text-ruta-muted">
                  <span className="text-ruta-xp">{formatoDistancia(c.distanciaM)}</span> · {c.titulo}
                </div>
              </button>
              <button
                onClick={() => volarA(c.ubicacion.latitud, c.ubicacion.longitud)}
                title={`Ver ${c.ubicacion.nombre} en el mapa`}
                aria-label={`Ver ${c.ubicacion.nombre} en el mapa`}
                className="px-btn flex h-7 w-7 flex-none items-center justify-center font-pixel text-xs text-ruta-gold"
              >
                ◎
              </button>
            </div>
          ))}
          {verCercanas && estadoCercanas === 'listo' && poisCercanos.length > 0 && (
            <div className="mt-2 border-t border-ruta-line pt-1.5">
              <div className="font-pixel text-[8px] tracking-widest text-ruta-muted">SERVICIOS CERCA</div>
              {poisCercanos.map((p) => (
                <div key={p.id} className="mt-1 flex min-w-0 items-center gap-2">
                  <button onClick={() => setPoiSel(p)} className="block min-w-0 flex-1 text-left">
                    <div className="truncate font-pixel text-[11px] font-bold leading-4 text-ruta-parchment">
                      {p.nombre}
                    </div>
                    <div className="truncate font-pixel text-[9px] leading-3 text-ruta-muted">
                      <span className="text-ruta-xp">{formatoDistancia(haversineM(efectiva, p))}</span> · {ETIQUETA_POI[p.categoria]}
                    </div>
                  </button>
                  <button
                    onClick={() => volarA(p.lat, p.lng)}
                    title={`Ver ${p.nombre} en el mapa`}
                    aria-label={`Ver ${p.nombre} en el mapa`}
                    className="px-btn flex h-7 w-7 flex-none items-center justify-center font-pixel text-xs text-ruta-gold"
                  >
                    ◎
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lugares de interés de OSM: posibles misiones alrededor */}
        <div className="px-frame p-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVerLugares((v) => !v)}
              aria-expanded={verLugares}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
            >
              <span className="truncate font-pixel text-[9px] tracking-widest text-ruta-muted">
                {estadoPois === 'espera'
                  ? '◌ LUGARES · ESPERANDO GPS'
                  : estadoPois === 'cargando'
                    ? '◌ BUSCANDO LUGARES…'
                    : estadoPois === 'error'
                      ? '○ LUGARES NO DISPONIBLES'
                      : `★ LUGARES · ${poisOrdenados.length}${poisStale ? ' (guardados)' : ''}`}
              </span>
              <span className="font-pixel text-[10px] text-ruta-gold">{verLugares ? '▾' : '▸'}</span>
            </button>
            {estadoPois === 'error' && (
              <button
                onClick={() => setIntentoPoi((n) => n + 1)}
                className="px-btn px-2 py-0.5 font-pixel text-[9px] text-ruta-gold"
              >
                REINTENTAR
              </button>
            )}
          </div>
          {verLugares && estadoPois === 'listo' && poisOrdenados.length === 0 && (
            <div className="mt-1 font-pixel text-[10px] leading-4 text-ruta-muted">Sin datos de OSM en 3 km.</div>
          )}
          {verLugares && poisOrdenados.slice(0, 6).map((p) => (
            <button
              key={p.id}
              onClick={() => setPoiSel(p)}
              className="mt-1 block w-full truncate text-left font-pixel text-[10px] leading-4 text-ruta-parchment"
            >
              <span className="text-ruta-gold">★</span> {p.nombre}
              <span className="text-ruta-muted"> · {ETIQUETA_POI[p.categoria]}</span>
              <span className="text-ruta-xp"> · {formatoDistancia(haversineM(efectiva, p))}</span>
            </button>
          ))}
        </div>
      </div>

      {/* POI elegido: ofrecer misión anclada ahí */}
      {poiSel && (
        <div className="absolute inset-x-0 bottom-24 z-[1100] flex justify-center px-3">
          <div className="w-full max-w-md px-frame px-frame--gold p-3">
            <div className="font-pixel text-[9px] tracking-widest text-ruta-gold">
              ★ {ETIQUETA_POI[poiSel.categoria].toUpperCase()}
            </div>
            <div className="mt-1 break-words font-pixel text-sm font-bold leading-5 text-ruta-parchment">
              {poiSel.nombre}
            </div>
            {avisoPoi && (
              <div className="mt-1.5 border border-ruta-valentia px-2 py-1 font-pixel text-[9px] leading-3 text-ruta-valentia" role="status">
                {avisoPoi}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => crearDesdePoi(poiSel)}
                className="px-btn px-btn--xp min-w-0 flex-1 py-2 font-pixel text-[10px] font-bold"
              >
                ▶ MISIÓN AQUÍ
              </button>
              <button
                onClick={() => volarA(poiSel.lat, poiSel.lng)}
                aria-label="Ver en el mapa"
                className="px-btn h-9 w-9 flex-none font-pixel text-xs text-ruta-gold"
              >
                ◎
              </button>
              <button
                onClick={() => setPoiSel(null)}
                aria-label="Cerrar"
                className="px-btn h-9 w-9 flex-none font-pixel text-xs text-ruta-muted"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom */}
      <div className="absolute bottom-4 left-3 z-[1100] flex flex-col gap-2">
        <button onClick={() => mapRef.current?.zoomIn()} aria-label="Acercar" className="px-btn flex h-9 w-9 items-center justify-center font-pixel text-base text-ruta-parchment">+</button>
        <button onClick={() => mapRef.current?.zoomOut()} aria-label="Alejar" className="px-btn flex h-9 w-9 items-center justify-center font-pixel text-base text-ruta-parchment">−</button>
        <div className="px-frame mt-1 max-w-[76px] px-1.5 py-1 text-center font-pixel text-[8px] leading-3 text-ruta-muted">
          ◌ 100 m<br />niebla
        </div>
      </div>

      {/* Pad */}
      {mode === 'joystick' && !poiSel && (
        <div className="absolute bottom-4 right-3 z-[1100]">
          <Joystick onCenter={centrar} />
        </div>
      )}
    </div>
  );
}
