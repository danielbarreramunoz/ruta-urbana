/** Micro-sonidos retro con Web Audio (sin archivos, 100% offline, muteable).
 *  Todos nacen de gestos del usuario, así que no chocan con el autoplay policy.
 */

export type Sonido = 'blip' | 'check' | 'paso' | 'completar' | 'nivel' | 'rescate' | 'alerta';

const PRESETS: Record<Sonido, { notas: number[]; dur: number; tipo: OscillatorType } > = {
  blip: { notas: [660], dur: 0.07, tipo: 'square' },
  check: { notas: [880], dur: 0.09, tipo: 'square' },
  paso: { notas: [440], dur: 0.06, tipo: 'square' },
  completar: { notas: [523, 659, 784, 1047], dur: 0.09, tipo: 'square' },
  nivel: { notas: [392, 523, 659, 784, 1047, 1319], dur: 0.08, tipo: 'square' },
  rescate: { notas: [180], dur: 0.25, tipo: 'sawtooth' },
  alerta: { notas: [880, 880], dur: 0.09, tipo: 'square' },
};

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Reproduce un preset. No hace nada si está muteado o sin soporte. */
export function sonar(nombre: Sonido, habilitado: boolean): void {
  if (!habilitado) return;
  const ac = contexto();
  if (!ac) return;
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
