import { useState } from 'react';
import { bajarPerfil, hayBackend, identidadLocal, subirPerfil } from '../game/backend';
import { usePlayerPosition } from '../game/geo';
import { codigoDeDispositivo, codigoValido, recompensaIntercambio, vecinosCercanos } from '../game/social';
import { usePlayerStore, usePresenceStore, useSettingsStore } from '../game/store';
import { sonar } from '../game/audio';

/** Radar social (Fase 5): vecinos difuminados, intercambio presencial, sync. */
export default function RadarTab() {
  const { efectiva } = usePlayerPosition();
  const otros = usePresenceStore((s) => s.otros);
  const jugador = usePlayerStore((s) => s.jugador);
  const ganarXP = usePlayerStore((s) => s.ganarXP);
  const aplicarPerfilRemoto = usePlayerStore((s) => s.aplicarPerfilRemoto);
  const sonido = useSettingsStore((s) => s.sonido);
  const [codigo, setCodigo] = useState('');
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const vecinos = vecinosCercanos(efectiva, otros);
  const miCodigo = codigoDeDispositivo(identidadLocal());
  const conectado = hayBackend();

  const intercambiar = () => {
    const c = codigo.trim();
    if (!codigoValido(c)) {
      setMensaje({ ok: false, texto: 'El código son 4 dígitos.' });
      return;
    }
    if (c === miCodigo) {
      setMensaje({ ok: false, texto: 'Ese es tu propio código: pídele el suyo a tu acompañante.' });
      return;
    }
    const usados: string[] = JSON.parse(localStorage.getItem('ruta-urbana/intercambios') ?? '[]');
    if (usados.includes(c)) {
      setMensaje({ ok: false, texto: 'Ese código ya se canjeó. Cada encuentro cuenta una vez.' });
      return;
    }
    localStorage.setItem('ruta-urbana/intercambios', JSON.stringify([...usados, c]));
    const r = recompensaIntercambio();
    ganarXP(r.xp, r.atributos);
    sonar('nivel', sonido);
    setMensaje({ ok: true, texto: `Intercambio registrado: +${r.xp} XP y +1 Carisma. Tu acompañante hace lo mismo en su juego.` });
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
      <div className="flex items-end justify-between">
        <div>
          <div className="font-pixel text-[10px] tracking-[0.2em] text-ruta-muted">MULTIJUGADOR</div>
          <h1 className="font-pixel text-xl font-bold text-ruta-parchment">Radar</h1>
        </div>
        <span className={`border px-2 py-1 font-pixel text-[9px] ${conectado ? 'border-ruta-xp text-ruta-xp' : 'border-ruta-line text-ruta-muted'}`}>
          {conectado ? '● ONLINE' : '○ LOCAL'}
        </span>
      </div>

      <div className={`px-frame px-3 py-2 font-pixel text-[10px] leading-4 ${conectado ? 'text-ruta-parchment' : 'text-ruta-muted'}`}>
        {conectado
          ? 'Backend conectado: radar y sync activos. Posiciones difuminadas ±200 m.'
          : 'Modo solitario: sin backend (.env). El intercambio presencial funciona igual.'}
      </div>

      <div className="px-frame p-3">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-sm font-bold text-ruta-parchment">Jugadores cercanos</span>
          <span className="font-pixel text-[9px] text-ruta-muted">{vecinos.length}</span>
        </div>
        <p className="mt-1 font-pixel text-[10px] leading-4 text-ruta-muted">
          Ubicación difusa: ves una zona aproximada, nunca el punto exacto. Comparte solo en lugares públicos.
        </p>

        {vecinos.length === 0 ? (
          <div className="mt-2 border border-dashed border-ruta-line px-2 py-3 text-center font-pixel text-[10px] text-ruta-muted">
            Nadie en el radar todavía.
          </div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {vecinos.map((v) => (
              <div key={v.id} className="flex items-center gap-2 border border-ruta-line bg-ruta-void p-2">
                <span className="flex h-7 w-7 flex-none items-center justify-center border border-ruta-burocracia font-pixel text-xs text-ruta-burocracia">
                  {v.nombre.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-pixel text-[11px] text-ruta-parchment">
                  {v.nombre} <span className="text-ruta-muted">Nv. {v.nivel}</span>
                </span>
                <span className="flex-none font-pixel text-[10px] text-ruta-gold">~{v.distanciaM} m</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 font-pixel text-[9px] leading-3 text-ruta-muted">
          Zonas seguras: el intercambio es presencial, en lugares públicos y con tu código a la vista.
        </p>
      </div>

      <div className="px-frame px-frame--gold p-3">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-sm font-bold text-ruta-parchment">Intercambio presencial</span>
          <span className="font-pixel text-[9px] text-ruta-gold">+30 XP</span>
        </div>
        <div className="mt-2 border-2 border-ruta-gold bg-ruta-void py-2 text-center">
          <div className="font-pixel text-[9px] tracking-[0.2em] text-ruta-muted">TU CÓDIGO</div>
          <div className="font-pixel text-3xl font-bold leading-9 tracking-[0.25em] text-ruta-gold">{miCodigo}</div>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="0000"
            aria-label="Código del acompañante"
            className="min-w-0 flex-1 border-2 border-ruta-line bg-ruta-void px-2 py-2 text-center font-pixel text-xl tracking-[0.3em] text-ruta-parchment placeholder:text-ruta-line focus:border-ruta-gold focus:outline-none"
          />
          <button onClick={intercambiar} className="px-btn px-btn--xp px-3 font-pixel text-[11px] font-bold">
            CANJEAR
          </button>
        </div>
        {mensaje && (
          <p className={`mt-2 font-pixel text-[10px] leading-4 ${mensaje.ok ? 'text-ruta-xp' : 'text-ruta-valentia'}`}>
            {mensaje.texto}
          </p>
        )}
      </div>

      <div className="px-frame p-3">
        <span className="font-pixel text-sm font-bold text-ruta-parchment">Sincronización</span>
        <div className="mt-2 flex gap-2">
          <button onClick={subirAhora} className="px-btn flex-1 py-2 font-pixel text-[10px] text-ruta-parchment">
            SUBIR
          </button>
          <button onClick={bajarAhora} className="px-btn flex-1 py-2 font-pixel text-[10px] text-ruta-parchment">
            BAJAR
          </button>
        </div>
        {syncMsg && <p className="mt-2 font-pixel text-[10px] text-ruta-muted">{syncMsg}</p>}
        <p className="mt-2 font-pixel text-[9px] leading-3 text-ruta-muted">
          Last-write-wins por fecha. Con backend local usa la IP LAN para jugar entre dispositivos.
        </p>
      </div>
    </div>
  );
}
