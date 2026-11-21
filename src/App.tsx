import { useState } from 'react';
import AvatarEditor from './components/AvatarEditor';
import FxOverlay from './components/FxOverlay';
import Hud from './components/Hud';
import MapView from './components/MapView';
import { MisionesTab, QuestDetail } from './components/Quests';
import RadarTab from './components/Radar';
import { Sprite, attrSvg, uiSvg } from './components/sprites';
import { useRadar } from './game/useRadar';
import { buscarQuest } from './game/store';
import { usePlayerStore, useQuestStore, useSettingsStore } from './game/store';

type Tab = 'inicio' | 'mapa' | 'misiones' | 'radar' | 'jugador';

const TABS: { id: Tab; label: string; icono: string }[] = [
  { id: 'inicio', label: 'Inicio', icono: '🏠' },
  { id: 'mapa', label: 'Mapa', icono: '🗺️' },
  { id: 'misiones', label: 'Misiones', icono: '📜' },
  { id: 'radar', label: 'Radar', icono: '🛰️' },
  { id: 'jugador', label: 'Jugador', icono: '🧢' },
];

const ATRIBUTOS_TXT: { key: 'carisma' | 'valentia' | 'burocracia' | 'supervivencia'; label: string }[] = [
  { key: 'carisma', label: 'Carisma' },
  { key: 'valentia', label: 'Valentía' },
  { key: 'burocracia', label: 'Burocracia' },
  { key: 'supervivencia', label: 'Supervivencia' },
];

function InicioTab({ onAbrir, onMisiones }: { onAbrir: (id: string) => void; onMisiones: () => void }) {
  const jugador = usePlayerStore((s) => s.jugador);
  const mision = jugador.misionActivaId ? buscarQuest(jugador.misionActivaId) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-pixel text-[10px] tracking-[0.2em] text-ruta-gold">RUTA URBANA</div>
          <h1 className="font-pixel text-xl font-bold leading-6 text-ruta-parchment">Tu ciudad, por niveles.</h1>
        </div>
      </div>

      <Hud />

      {mision ? (
        <button onClick={() => onAbrir(mision.id)} className="px-frame px-frame--gold block w-full text-left">
          <div className="h-1 w-full bg-ruta-gold" />
          <div className="p-3">
            <div className="flex items-center gap-2 font-pixel text-[9px] tracking-widest text-ruta-gold">
              <span className="h-1.5 w-1.5 animate-pulse bg-ruta-gold" /> MISIÓN ACTIVA
            </div>
            <div className="mt-1 font-pixel text-base font-bold text-ruta-parchment">{mision.titulo}</div>
            <div className="mt-1 flex items-center justify-between font-pixel text-[10px] text-ruta-muted">
              <span>
                +{mision.recompensa.xp} XP
                {mision.recompensa.paga ? ` · +${mision.recompensa.paga} fichas` : ''}
              </span>
              <span>continuar →</span>
            </div>
          </div>
        </button>
      ) : (
        <button onClick={onMisiones} className="px-frame block w-full border-dashed p-3 text-left">
          <div className="font-pixel text-sm font-bold text-ruta-parchment">Sin misión activa</div>
          <div className="mt-0.5 font-pixel text-[11px] text-ruta-muted">Elige tu próxima ruta →</div>
        </button>
      )}

      <div className="px-frame p-3">
        <div className="font-pixel text-[11px] font-bold tracking-wide text-ruta-parchment">ATRIBUTOS</div>
        <div className="mt-2 space-y-1.5">
          {ATRIBUTOS_TXT.map((a) => (
            <div key={a.key} className="flex items-center gap-2">
              <Sprite svg={attrSvg(a.key)} size={14} />
              <span className="w-24 font-pixel text-[10px] text-ruta-muted">{a.label}</span>
              <div className="flex flex-1 gap-[2px]">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 ${i < Math.min(10, jugador.atributos[a.key]) ? 'bg-ruta-parchment' : 'bg-ruta-line'}`}
                  />
                ))}
              </div>
              <span className="w-5 text-right font-pixel text-[10px] font-bold text-ruta-parchment">
                {jugador.atributos[a.key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-frame p-3">
        <div className="font-pixel text-[11px] font-bold tracking-wide text-ruta-parchment">CÓMO SE JUEGA</div>
        <div className="mt-2 space-y-1.5">
          {[
            ['01', 'La niebla cubre la ciudad: cada celda nueva da XP y hay bonus cada 25.'],
            ['02', 'Activa una misión, revisa tu mochila y sigue el guion.'],
            ['03', 'Entra al radio del destino: vibra y aparece el aviso.'],
            ['04', 'Cobra XP, fichas y a veces un premio. Si algo externo falla, cobra parcial.'],
          ].map(([n, t]) => (
            <div key={t} className="flex gap-2 font-pixel text-[10px] leading-4 text-ruta-muted">
              <span className="flex-none border border-ruta-line px-1 text-ruta-gold">{n}</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
        <button onClick={onMisiones} className="px-btn mt-2.5 w-full py-2 font-pixel text-[11px] font-bold text-ruta-parchment">
          VER MISIONES →
        </button>
      </div>
    </div>
  );
}

function JugadorTab() {
  const jugador = usePlayerStore((s) => s.jugador);
  const ganarXP = usePlayerStore((s) => s.ganarXP);
  const ganarFichas = usePlayerStore((s) => s.ganarFichas);
  const reiniciar = usePlayerStore((s) => s.reiniciar);
  const reiniciarMisiones = useQuestStore((s) => s.reiniciarMisiones);
  const sonido = useSettingsStore((s) => s.sonido);
  const toggleSonido = useSettingsStore((s) => s.toggleSonido);
  const [confirmarReset, setConfirmarReset] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <div className="font-pixel text-[10px] tracking-[0.2em] text-ruta-muted">PERFIL LOCAL</div>
        <h1 className="font-pixel text-xl font-bold text-ruta-parchment">Jugador</h1>
      </div>
      <Hud />

      <AvatarEditor />

      <div className="px-frame p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="border border-ruta-line bg-ruta-void py-2">
            <div className="font-pixel text-lg font-bold text-ruta-gold">{jugador.nivel}</div>
            <div className="font-pixel text-[9px] text-ruta-muted">NIVEL</div>
          </div>
          <div className="border border-ruta-line bg-ruta-void py-2">
            <div className="font-pixel text-lg font-bold text-ruta-xp">{jugador.misionesCompletadas.length}</div>
            <div className="font-pixel text-[9px] text-ruta-muted">HECHAS</div>
          </div>
          <div className="border border-ruta-line bg-ruta-void py-2">
            <div className="font-pixel text-lg font-bold text-ruta-valentia">{jugador.misionesFallidas.length}</div>
            <div className="font-pixel text-[9px] text-ruta-muted">FALLIDAS</div>
          </div>
        </div>
        <p className="mt-2 font-pixel text-[9px] leading-3 text-ruta-muted">
          Progreso guardado en este navegador (localStorage). Sin cuentas ni servidores.
        </p>
      </div>

      <div className="px-frame p-3">
        <div className="font-pixel text-[11px] font-bold tracking-wide text-ruta-parchment">HERRAMIENTAS DE PRUEBA</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => ganarFichas(1000)}
            className="px-btn px-btn--xp py-2.5 font-pixel text-[10px] font-bold"
          >
            +1000 FICHAS
          </button>
          <button
            onClick={() => ganarXP(25, { valentia: 1 })}
            className="px-btn px-btn--xp py-2.5 font-pixel text-[10px] font-bold"
          >
            +25 XP (+1 VAL)
          </button>
        </div>
        <button
          onClick={() => {
            if (!confirmarReset) {
              setConfirmarReset(true);
            } else {
              reiniciarMisiones();
              setConfirmarReset(false);
            }
          }}
          className={`px-btn mt-2 w-full py-2.5 font-pixel text-[10px] font-bold ${confirmarReset ? 'px-btn--danger' : 'text-ruta-burocracia'}`}
        >
          {confirmarReset ? '¿SEGURO? TOCA OTRA VEZ' : '↻ REINICIAR MISIONES'}
        </button>
        <p className="mt-1.5 font-pixel text-[9px] leading-3 text-ruta-muted">
          Reiniciar misiones conserva nivel, fichas y cosméticos.
        </p>
      </div>

      <div className="space-y-2">
        <button onClick={toggleSonido} className="px-btn flex w-full items-center justify-center gap-2 py-3 font-pixel text-xs text-ruta-parchment">
          <Sprite svg={uiSvg(sonido ? 'soundOn' : 'soundOff')} size={16} />
          {sonido ? 'SONIDO ACTIVADO' : 'SONIDO DESACTIVADO'}
        </button>
        <button onClick={() => reiniciar()} className="px-btn w-full py-3 font-pixel text-xs text-ruta-muted">
          Reiniciar jugador (todo)
        </button>
      </div>
    </div>
  );
}

export default function App() {
  // Permite abrir una pestaña directa (#misiones, #radar…): útil para PWA shortcuts y QA.
  const [tab, setTab] = useState<Tab>(() => {
    const h = window.location.hash.replace('#', '');
    if (h.startsWith('mision/')) return 'misiones';
    return TABS.some((t) => t.id === h) ? (h as Tab) : 'mapa';
  });
  const [misionAbierta, setMisionAbierta] = useState<string | null>(() => {
    const h = window.location.hash.replace('#', '');
    return h.startsWith('mision/') ? h.slice('mision/'.length) : null;
  });
  useRadar();
  const esMapa = tab === 'mapa' && !misionAbierta;

  return (
    <div className="flex h-dvh w-full flex-col bg-ruta-void">
      <div className={`min-h-0 flex-1 ${esMapa ? 'relative' : 'overflow-y-auto'}`}>
        {misionAbierta ? (
          <div className="mx-auto max-w-md p-3">
            <QuestDetail questId={misionAbierta} onVolver={() => setMisionAbierta(null)} />
          </div>
        ) : tab === 'inicio' ? (
          <div className="mx-auto max-w-md p-3">
            <InicioTab
              onAbrir={(id) => setMisionAbierta(id)}
              onMisiones={() => setTab('misiones')}
            />
          </div>
        ) : tab === 'mapa' ? (
          <MapView onAbrirQuest={(id) => setMisionAbierta(id)} />
        ) : tab === 'misiones' ? (
          <div className="mx-auto max-w-md p-3">
            <MisionesTab onAbrir={setMisionAbierta} />
          </div>
        ) : tab === 'radar' ? (
          <div className="mx-auto max-w-md p-3">
            <RadarTab />
          </div>
        ) : (
          <div className="mx-auto max-w-md p-3">
            <JugadorTab />
          </div>
        )}
      </div>

      {!misionAbierta && (
        <nav className="grid grid-cols-5 border-t-2 border-ruta-line bg-ruta-panel">
          {TABS.map((t) => {
            const activo = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={activo ? 'page' : undefined}
                className={`relative flex flex-col items-center py-2 font-pixel text-[9px] tracking-wide transition-colors ${
                  activo ? 'text-ruta-gold' : 'text-ruta-muted'
                }`}
              >
                {activo && <span className="absolute inset-x-3 top-0 h-[3px] bg-ruta-gold" />}
                <span className={`text-[17px] leading-6 ${activo ? 'drop-shadow-[0_0_6px_rgba(255,210,63,0.55)]' : 'opacity-70 grayscale-[0.35]'}`}>
                  {t.icono}
                </span>
                {t.label}
              </button>
            );
          })}
        </nav>
      )}

      {misionAbierta && (
        <nav className="border-t-2 border-ruta-line bg-ruta-panel px-3 py-2 text-center font-pixel text-[10px] text-ruta-muted">
          MODO MISIÓN ·{' '}
          <button onClick={() => setMisionAbierta(null)} className="text-ruta-gold">
            volver al mapa
          </button>
        </nav>
      )}

      <FxOverlay />
    </div>
  );
}
