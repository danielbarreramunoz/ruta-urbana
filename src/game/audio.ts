/** Audio del juego: micro-sonidos retro + música chiptune procedural.
 *  100% Web Audio y sin archivos: funciona offline y no choca con la política
 *  de autoplay porque todo nace de un gesto del usuario.
 */

export type Sonido = 'blip' | 'check' | 'paso' | 'completar' | 'nivel' | 'rescate' | 'alerta';

const PRESETS: Record<Sonido, { notas: number[]; dur: number; tipo: OscillatorType }> = {
  blip: { notas: [660], dur: 0.07, tipo: 'square' },
  check: { notas: [880], dur: 0.09, tipo: 'square' },
  paso: { notas: [440], dur: 0.06, tipo: 'square' },
  completar: { notas: [523, 659, 784, 1047], dur: 0.09, tipo: 'square' },
  nivel: { notas: [392, 523, 659, 784, 1047, 1319], dur: 0.08, tipo: 'square' },
  rescate: { notas: [180], dur: 0.25, tipo: 'sawtooth' },
  alerta: { notas: [880, 880], dur: 0.09, tipo: 'square' },
};

let ctx: AudioContext | null = null;

function existente(): AudioContext | null {
  return ctx;
}

function crear(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return ctx;
  } catch {
    return null;
  }
}

let desbloqueoPendiente: Promise<void> | null = null;

/** Llamar desde pointer/tecla: el navegador solo permite resume en un gesto. */
export function desbloquearAudio(): void {
  const ac = crear();
  if (!ac || ac.state === 'running' || desbloqueoPendiente) return;
  desbloqueoPendiente = ac.resume()
    .catch(() => {})
    .finally(() => { desbloqueoPendiente = null; });
}

let desbloqueoInstalado = false;

/** Instala una vez los listeners de gesto que crean/reanudan el contexto.
 *  Llamar al montar la app, haya o no musica: asi sonar() nunca necesita
 *  crear el contexto fuera de un gesto (origen del warning de autoplay). */
export function instalarDesbloqueoAudio(): void {
  if (desbloqueoInstalado || typeof window === 'undefined') return;
  desbloqueoInstalado = true;
  const alGesto = () => { desbloquearAudio(); };
  window.addEventListener('pointerdown', alGesto, true);
  window.addEventListener('keydown', alGesto, true);
  window.addEventListener('touchend', alGesto, true);
}

/** Reproduce un preset. Nunca crea el contexto: sin gesto previo no suena (sin warnings). */
export function sonar(nombre: Sonido, habilitado: boolean): void {
  if (!habilitado) return;
  const ac = existente();
  // Los efectos no intentan desbloquear audio desde un efecto React/GPS:
  // esperan al próximo gesto del usuario y no generan warnings repetidos.
  if (!ac || ac.state !== 'running') return;
  const { notas, dur, tipo } = PRESETS[nombre];
  const t0 = ac.currentTime;
  notas.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = tipo;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, t0 + i * dur);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * dur + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0 + i * dur);
    osc.stop(t0 + i * dur + dur + 0.02);
  });
}

/* ───────────────────────── Música chiptune procedural ─────────────────────────
 * Scheduler con lookahead: cada 25 ms se agendan las notas de los próximos
 * 180 ms usando el reloj absoluto del AudioContext. Así el tempo no depende del
 * `setInterval` ni del throttling del navegador (antes la melodía se arrastraba
 * y se desincronizaba).
 *
 * Arreglo de 8 compases: La m – Fa – Do – Sol con melodía A/B, arpegio, pad
 * suave, bajo con octava de cierre, bombo y charles de ruido. Filtro paso bajo
 * y eco corto para que no suene a pitidos secos. Todo generado en vivo.
 */

const BPM_MUSICA = 100;
const DUR_PASO = 60 / BPM_MUSICA / 2; // corchea
const PASOS_COMPAS = 8;
const TOTAL_PASOS = PASOS_COMPAS * 8;
const SWING = DUR_PASO * 0.07;

interface Acorde {
  bajo: number;
  notas: number[];
}

const ACORDES: Acorde[] = [
  { bajo: 110.0, notas: [220.0, 261.63, 329.63] }, // Am
  { bajo: 87.31, notas: [174.61, 220.0, 261.63] }, // F
  { bajo: 130.81, notas: [261.63, 329.63, 392.0] }, // C
  { bajo: 98.0, notas: [196.0, 246.94, 293.66] }, // G
];

/** Melodía de 64 corcheas (8 compases). `null` = silencio. */
const MELODIA: (number | null)[] = [
  // A
  659.25, null, 523.25, null, 587.33, null, 523.25, null,
  440.0, null, 523.25, 587.33, null, 523.25, null, null,
  659.25, null, 783.99, null, 659.25, 587.33, null, 523.25,
  587.33, null, 523.25, null, 440.0, null, null, null,
  // B (respuesta más alta)
  783.99, null, 659.25, null, 587.33, 659.25, null, null,
  523.25, null, 587.33, 659.25, null, 523.25, null, null,
  783.99, null, 659.25, 587.33, null, 659.25, 523.25, null,
  440.0, null, 523.25, 587.33, 440.0, null, null, null,
];

interface MotorMusica {
  ac: AudioContext;
  master: GainNode;
  eco: GainNode;
  ruido: AudioBuffer;
}

let motor: MotorMusica | null = null;
let programador: number | undefined;

export function musicaSonando(): boolean {
  return motor !== null && motor.ac.state === 'running';
}

/** Arranca el loop. Debe llamarse desde un gesto (tap/click). Idempotente.
 *  Si el AudioContext sigue suspendido por la política de autoplay, el motor
 *  queda creado y el scheduler reintenta `resume()` en cada tick: la música
 *  entra sola en cuanto el navegador permite el audio, sin recargar. */
export function iniciarMusica(): boolean {
  if (motor) {
    desbloquearAudio();
    return true;
  }
  const ac = crear();
  if (!ac) return false;
  try {
    desbloquearAudio();
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, ac.currentTime);
    master.gain.exponentialRampToValueAtTime(0.9, ac.currentTime + 1.4);

    const filtro = ac.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 5200;
    filtro.Q.value = 0.5;
    master.connect(filtro).connect(ac.destination);

    // Eco corto solo para la melodía: da aire sin embarrar el bajo.
    const eco = ac.createGain();
    eco.gain.value = 1;
    const retardo = ac.createDelay(1);
    retardo.delayTime.value = DUR_PASO * 1.5;
    const realim = ac.createGain();
    realim.gain.value = 0.26;
    const mezcla = ac.createGain();
    mezcla.gain.value = 0.17;
    eco.connect(retardo);
    retardo.connect(realim).connect(retardo);
    retardo.connect(mezcla).connect(master);

    const actual: MotorMusica = { ac, master, eco, ruido: crearRuido(ac, 0.5) };
    motor = actual;

    let paso = 0;
    let siguiente = ac.currentTime + 0.12;
    let relojListo = ac.state === 'running';
    const tick = () => {
      if (motor !== actual) return;
      if (ac.state !== 'running') {
        // Espera un gesto real. Evita resume() cada 25 ms, que Chromium bloquea
        // con warnings de autoplay y deja el scheduler corriendo sin audio.
        return;
      }
      if (!relojListo) {
        relojListo = true;
        siguiente = ac.currentTime + 0.12;
      }
      while (siguiente < ac.currentTime + 0.18) {
        programarPaso(actual, paso, siguiente + (paso % 2 === 1 ? SWING : 0));
        siguiente += DUR_PASO;
        paso = (paso + 1) % TOTAL_PASOS;
      }
    };
    tick();
    programador = window.setInterval(tick, 25);
    return true;
  } catch {
    return false;
  }
}

export function detenerMusica(): void {
  const actual = motor;
  motor = null;
  if (programador !== undefined) window.clearInterval(programador);
  programador = undefined;
  if (!actual) return;
  const { ac, master } = actual;
  const t = ac.currentTime;
  try {
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
    master.gain.setTargetAtTime(0.0001, t, 0.07);
  } catch {
    /* sin soporte: se corta igual al desconectar */
  }
  // Deja terminar el fundido/eco antes de soltar el grafo.
  window.setTimeout(() => {
    try {
      master.disconnect();
      actual.eco.disconnect();
    } catch {
      /* ya desconectado */
    }
  }, 700);
}

function programarPaso(m: MotorMusica, paso: number, t: number): void {
  const idx = paso % PASOS_COMPAS;
  const compas = Math.floor(paso / PASOS_COMPAS) % 8;
  const acorde = ACORDES[compas % ACORDES.length];

  const nota = MELODIA[paso];
  if (nota) notaOsc(m, nota, t, DUR_PASO * 1.8, 0.075, 'square', m.master, 0.008, m.eco);

  // Arpegio tenue que cambia con cada acorde.
  const arp = acorde.notas[paso % acorde.notas.length] * 2;
  notaOsc(m, arp, t, DUR_PASO * 0.7, 0.02, 'triangle', m.master, 0.006);

  // Bajo en pulsos de negra; octava al cerrar compases impares.
  if (idx % 2 === 0) {
    const octava = idx === 6 && compas % 2 === 1 ? 2 : 1;
    notaOsc(m, acorde.bajo * octava, t, DUR_PASO * 1.6, 0.15, 'triangle', m.master, 0.01);
  }

  // Pad sostenido al inicio de cada compás (ataque lento).
  if (idx === 0) {
    for (const f of acorde.notas) notaOsc(m, f, t, DUR_PASO * PASOS_COMPAS * 0.95, 0.016, 'sine', m.master, 0.55);
  }

  if (idx === 0 || idx === 4) bombo(m, t);
  if (idx === 2 || idx === 6) charles(m, t);
}

/** Nota con envolvente ataque/decaimiento. `extra` es un envío paralelo (eco). */
function notaOsc(
  m: MotorMusica,
  freq: number,
  t: number,
  dur: number,
  vol: number,
  tipo: OscillatorType,
  destino: AudioNode,
  ataque = 0.01,
  extra?: AudioNode,
): void {
  const osc = m.ac.createOscillator();
  const g = m.ac.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.max(0.005, ataque));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(destino);
  if (extra) g.connect(extra);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function bombo(m: MotorMusica, t: number): void {
  const osc = m.ac.createOscillator();
  const g = m.ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(125, t);
  osc.frequency.exponentialRampToValueAtTime(44, t + 0.11);
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
  osc.connect(g).connect(m.master);
  osc.start(t);
  osc.stop(t + 0.19);
}

function charles(m: MotorMusica, t: number): void {
  const src = m.ac.createBufferSource();
  src.buffer = m.ruido;
  const pasoAlto = m.ac.createBiquadFilter();
  pasoAlto.type = 'highpass';
  pasoAlto.frequency.value = 7200;
  const g = m.ac.createGain();
  g.gain.setValueAtTime(0.032, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(pasoAlto).connect(g).connect(m.master);
  src.start(t);
  src.stop(t + 0.06);
}

function crearRuido(ac: AudioContext, seg: number): AudioBuffer {
  const buffer = ac.createBuffer(1, Math.max(1, Math.ceil(ac.sampleRate * seg)), ac.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  return buffer;
}
