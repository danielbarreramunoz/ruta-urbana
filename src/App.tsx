import { useState } from 'react';
import Hud from './components/Hud';
import MapView from './components/MapView';
import { MisionesTab, QuestDetail } from './components/Quests';
import { questById } from './game/data';
import { usePlayerStore, useSettingsStore } from './game/store';

type Tab = 'inicio' | 'mapa' | 'misiones' | 'jugador';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Inicio', icon: '🏠' },
  { id: 'mapa', label: 'Mapa', icon: '🗺️' },
  { id: 'misiones', label: 'Misiones', icon: '📜' },
  { id: 'jugador', label: 'Jugador', icon: '🧢' },
];

function InicioTab({ onAbrir }: { onAbrir: (id: string) => void }) {
  const jugador = usePlayerStore((s) => s.jugador);
  const mision = jugador.misionActivaId ? questById.get(jugador.misionActivaId) : undefined;
  return (
    <div className="space-y-3">
      <div className="font-pixel text-xs tracking-widest text-ruta-muted">RUTA URBANA · PWA</div>
      <Hud />
      {mision ? (
        <button onClick={() => onAbrir(mision.id)} className="block w-full border-2 border-ruta-gold bg-ruta-panel p-4 text-left">
          <div className="font-pixel text-[11px] text-ruta-gold">▶ MISIÓN ACTIVA</div>
          <div className="mt-1 font-pixel text-lg font-bold text-ruta-parchment">{mision.titulo}</div>
          <div className="mt-1 font-pixel text-xs text-ruta-muted">Toca para continuar →</div>
        </button>
      ) : (
        <div className="border-2 border-dashed border-ruta-line bg-ruta-panel p-4">
          <div className="font-pixel text-sm font-bold text-ruta-muted">Sin misión activa</div>
          <div className="mt-1 font-pixel text-xs text-ruta-muted">Elige tu próxima ruta en Misiones →</div>
        </div>
      )}
      <div className="border-2 border-ruta-line bg-ruta-panel p-4">
        <div className="font-pixel text-sm font-bold text-ruta-parchment">Motor de juego activo</div>
        {['Mapa con niebla (100 m)', 'Catálogo data-driven (3 misiones)', 'Checklist previo + diálogos NPC', 'Rescate con XP parcial'].map((t) => (
          <div key={t} className="mt-1 font-pixel text-xs text-ruta-muted">▸ {t}</div>
        ))}
      </div>
    </div>
  );
}

function JugadorTab() {
  const jugador = usePlayerStore((s) => s.jugador);
  const ganarXP = usePlayerStore((s) => s.ganarXP);
  const reiniciar = usePlayerStore((s) => s.reiniciar);
  const sonido = useSettingsStore((s) => s.sonido);
  const toggleSonido = useSettingsStore((s) => s.toggleSonido);
  return (
    <div className="space-y-3">
      <div className="font-pixel text-xs tracking-widest text-ruta-muted">JUGADOR · LOCALSTORAGE</div>
      <Hud />
      <div className="border-2 border-ruta-line bg-ruta-panel p-4 font-pixel text-xs leading-5 text-ruta-muted">
        Nivel {jugador.nivel} · {jugador.xp}/{jugador.xpParaSiguienteNivel} XP
        <br />
        Misiones: {jugador.misionesCompletadas.length} ✓ · {jugador.misionesFallidas.length} ✗
        <br />
        Progreso guardado en este navegador.
      </div>
      <button onClick={() => ganarXP(25, { valentia: 1 })} className="w-full border-2 border-ruta-xp bg-ruta-panel p-4 font-pixel text-sm font-bold text-ruta-xp">
        +25 XP de prueba (+1 VAL)
      </button>
      <button onClick={toggleSonido} className="w-full border-2 border-ruta-line bg-ruta-panel p-4 font-pixel text-sm text-ruta-parchment">
        {sonido ? '🔊 Sonido activado' : '🔇 Sonido desactivado'} — tocar para cambiar
      </button>
      <button onClick={() => reiniciar()} className="w-full border-2 border-ruta-line bg-ruta-panel p-4 font-pixel text-sm text-ruta-muted">
        Reiniciar jugador
      </button>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('mapa');
  const [misionAbierta, setMisionAbierta] = useState<string | null>(null);
  const esMapa = tab === 'mapa' && !misionAbierta;

  return (
    <div className="flex h-dvh w-full flex-col bg-ruta-void">
      <div className={`min-h-0 flex-1 ${esMapa ? 'relative' : 'overflow-y-auto'}`}>
        {misionAbierta ? (
          <div className="mx-auto max-w-md p-4">
            <QuestDetail questId={misionAbierta} onVolver={() => setMisionAbierta(null)} />
          </div>
        ) : tab === 'inicio' ? (
          <div className="mx-auto max-w-md p-4">
            <InicioTab onAbrir={(id) => { setTab('misiones'); setMisionAbierta(id); }} />
          </div>
        ) : tab === 'mapa' ? (
          <MapView onAbrirQuest={(id) => setMisionAbierta(id)} />
        ) : tab === 'misiones' ? (
          <div className="mx-auto max-w-md p-4">
            <MisionesTab onAbrir={setMisionAbierta} />
          </div>
        ) : (
          <div className="mx-auto max-w-md p-4">
            <JugadorTab />
          </div>
        )}
      </div>
      {!misionAbierta && (
        <nav className="grid grid-cols-4 border-t-2 border-ruta-line bg-ruta-panel">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center py-2.5 font-pixel text-[11px] ${tab === t.id ? 'text-ruta-gold' : 'text-ruta-muted'}`}
            >
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
      {misionAbierta && (
        <nav className="border-t-2 border-ruta-line bg-ruta-panel p-2.5 text-center font-pixel text-[11px] text-ruta-muted">
          Viendo misión · <button onClick={() => setMisionAbierta(null)} className="text-ruta-gold">volver</button>
        </nav>
      )}
    </div>
  );
}
