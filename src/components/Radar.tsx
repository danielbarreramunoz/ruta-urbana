import { useState } from 'react';
import { bajarPerfil, hayBackend, identidadLocal, subirPerfil } from '../game/backend';
import { usePlayerPosition } from '../game/geo';
import { codigoDeDispositivo, codigoValido, recompensaIntercambio, vecinosCercanos } from '../game/social';
import { usePlayerStore, usePresenceStore } from '../game/store';
import { sonar } from '../game/audio';
import { useSettingsStore } from '../game/store';

/** Radar social (Fase 5): vecinos difuminados, intercambio presencial, sync. */
export default function RadarTab() {
  const { efectiva } = usePlayerPosition();
  const otros = usePresenceStore((s) => s.otros);
  const jugador = usePlayerStore((s) => s.jugador);
  const ganarXP = usePlayerStore((s) => s.ganarXP);
  const aplicarPerfilRemoto = usePlayerStore((s) => s.aplicarPerfilRemoto);
  const sonido = useSettingsStore((s) => s.sonido);
  const [codigo, setCodigo] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const vecinos = vecinosCercanos(efectiva, otros);
  const miCodigo = codigoDeDispositivo(identidadLocal());

  const intercambiar = () => {
    const c = codigo.trim();
    if (!codigoValido(c)) {
      setMensaje('El código son 4 dígitos.');
      return;
    }
    if (c === miCodigo) {
      setMensaje('Ese es tu propio código: pídele el suyo a tu acompañante.');
      return;
    }
    const usados: string[] = JSON.parse(localStorage.getItem('ruta-urbana/intercambios') ?? '[]');
    if (usados.includes(c)) {
      setMensaje('Ese código ya se canjeó. Cada encuentro cuenta una vez.');
      return;
    }
    localStorage.setItem('ruta-urbana/intercambios', JSON.stringify([...usados, c]));
    const r = recompensaIntercambio();
    ganarXP(r.xp, r.atributos);
    sonar('nivel', sonido);
    setMensaje(`¡Intercambio registrado! +${r.xp} XP y +1 Carisma. Tu acompañante hace lo mismo en su juego.`);
    setCodigo('');
  };

  const subirAhora = async () => {
    const ok = await subirPerfil(jugador, identidadLocal());
    setSyncMsg(ok ? '✓ Progreso subido.' : '✗ Sin backend o falló la subida.');
  };

  const bajarAhora = async () => {
    const remoto = await bajarPerfil(identidadLocal(), jugador.updatedAt);
    if (remoto) {
      aplicarPerfilRemoto(remoto);
      setSyncMsg('✓ Progreso remoto adoptado (era más nuevo).');
    } else {
      setSyncMsg('Sin cambios remotos (o sin backend).');
    }
  };

  return (
    <div className="space-y-3">
      <div className="font-pixel text-xs tracking-widest text-ruta-muted">RADAR · MULTIJUGADOR LOCAL</div>

      <div className={`border-2 p-3 font-pixel text-xs leading-5 ${hayBackend() ? 'border-ruta-xp bg-ruta-panel text-ruta-parchment' : 'border-ruta-line bg-ruta-panel text-ruta-muted'}`}>
        {hayBackend()
          ? '● Backend conectado: radar y sync activos (posiciones difuminadas ±200 m).'
          : '○ Modo solitario: sin backend configurado (ver .env.example). El intercambio presencial funciona igual.'}
      </div>

      <div className="border-2 border-ruta-line bg-ruta-panel p-4">
        <div className="font-pixel text-sm font-bold text-ruta-parchment">🛰️ Jugadores cercanos</div>
        <p className="mt-1 font-pixel text-[11px] leading-4 text-ruta-muted">
          Ubicación difusa por privacidad: ves una zona aproximada, nunca el punto exacto. Zonas seguras: comparte solo en lugares públicos.
        </p>
        {vecinos.length === 0 ? (
          <p className="mt-2 font-pixel text-xs text-ruta-muted">Nadie cerca por ahora. El radar se actualiza solo.</p>
        ) : (
          vecinos.map((v) => (
            <div key={v.id} className="mt-2 flex items-center justify-between border border-ruta-line bg-ruta-void p-2.5">
              <span className="font-pixel text-xs text-ruta-parchment">👤 {v.nombre} · Nv. {v.nivel}</span>
              <span className="font-pixel text-[11px] text-ruta-gold">~{v.distanciaM} m</span>
            </div>
          ))
        )}
      </div>

      <div className="border-2 border-ruta-line bg-ruta-panel p-4">
        <div className="font-pixel text-sm font-bold text-ruta-parchment">🤝 Intercambio presencial</div>
        <p className="mt-1 font-pixel text-[11px] leading-4 text-ruta-muted">
          Muestra tu código, anota el de tu acompañante. Ambos ganan +30 XP y +1 Carisma.
        </p>
        <div className="mt-2 border border-ruta-gold bg-ruta-void p-3 text-center">
          <div className="font-pixel text-[10px] tracking-widest text-ruta-muted">TU CÓDIGO</div>
          <div className="font-pixel text-3xl font-bold tracking-widest text-ruta-gold">{miCodigo}</div>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="Código de 4 dígitos"
            className="min-w-0 flex-1 border border-ruta-line bg-ruta-void p-3 text-center font-pixel text-lg tracking-widest text-ruta-parchment placeholder:text-ruta-muted"
          />
          <button onClick={intercambiar} className="border border-ruta-xp bg-ruta-void px-4 font-pixel text-xs font-bold text-ruta-xp">
            CANJEAR
          </button>
        </div>
        {mensaje && <p className="mt-2 font-pixel text-xs leading-5 text-ruta-parchment">{mensaje}</p>}
      </div>

      <div className="border-2 border-ruta-line bg-ruta-panel p-4">
        <div className="font-pixel text-sm font-bold text-ruta-parchment">☁️ Sincronización</div>
        <div className="mt-2 flex gap-2">
          <button onClick={subirAhora} className="flex-1 border border-ruta-line bg-ruta-void p-2.5 font-pixel text-xs text-ruta-parchment">SUBIR AHORA</button>
          <button onClick={bajarAhora} className="flex-1 border border-ruta-line bg-ruta-void p-2.5 font-pixel text-xs text-ruta-parchment">BAJAR</button>
        </div>
        {syncMsg && <p className="mt-2 font-pixel text-xs text-ruta-muted">{syncMsg}</p>}
      </div>
    </div>
  );
}
