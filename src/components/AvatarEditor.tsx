import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, Sprite, uiSvg } from './sprites';
import { sonar } from '../game/audio';
import { SLOT_ORDEN, esPropio, estaDesbloqueado, motivoBloqueo, porSlot } from '../game/cosmetics';
import { cosmeticos } from '../game/data';
import { usePlayerStore, useSettingsStore, type ResultadoCompra } from '../game/store';
import type { CosmeticItem, CosmeticSlot, Equipamiento, Sexo } from '../game/types';

const RESULTADO: Record<ResultadoCompra, string> = {
  ok: 'Comprado',
  'ya-tienes': 'Ya lo tienes',
  'sin-fichas': 'Te faltan fichas',
  bloqueado: 'Aún bloqueado',
  'no-existe': 'No existe',
};

const PRENDA_LABEL: Record<string, string> = {
  pelo: 'Pelo', gorro: 'Gorro', lentes: 'Lentes', barba: 'Barba', aros: 'Aros',
  ropa: 'Ropa', pantalon: 'Pantalón', zapatos: 'Zapatos', tatuaje: 'Tatuaje', mochila: 'Mochila',
};

/** Vestuario pixel-art: probador, silueta en vivo y catálogo comprable por ranura. */
export default function AvatarEditor() {
  const jugador = usePlayerStore((s) => s.jugador);
  const comprar = usePlayerStore((s) => s.comprarCosmetico);
  const equipar = usePlayerStore((s) => s.equiparCosmetico);
  const desequipar = usePlayerStore((s) => s.desequiparSlot);
  const renombrar = usePlayerStore((s) => s.renombrar);
  const sonido = useSettingsStore((s) => s.sonido);
  /** Categoría abierta en el modal. `null` = modal cerrado, la pantalla queda limpia. */
  const [abierto, setAbierto] = useState<CosmeticSlot | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 2600);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // Cerrar con Escape y congelar el scroll de fondo mientras el modal está abierto.
  useEffect(() => {
    if (!abierto) return;
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(null);
    };
    window.addEventListener('keydown', alTeclado);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alTeclado);
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  const items = abierto ? porSlot(abierto) : [];
  const labelSlot = (abierto && SLOT_ORDEN.find((s) => s.id === abierto)?.label) || 'CATEGORÍA';
  const totalRanuras = SLOT_ORDEN.length;

  /** Mismo equipamiento, con la prenda candidata puesta (o sin la ranura). */
  const vista = (paraSlot: CosmeticSlot, item?: CosmeticItem): Equipamiento => {
    const e = { ...jugador.equipado };
    if (item) e[item.slot] = item.id;
    else delete e[paraSlot];
    return e;
  };

  const accion = (item: CosmeticItem) => {
    if (!estaDesbloqueado(jugador, item)) {
      setAviso(`🔒 ${item.nombre}: ${motivoBloqueo(jugador, item) ?? 'bloqueado'}`);
      sonar('blip', sonido);
      return;
    }
    if (jugador.equipado[item.slot] === item.id) {
      desequipar(item.slot);
      sonar('blip', sonido);
      setAviso(`${item.nombre} guardado`);
      return;
    }
    if (!esPropio(jugador, item)) {
      const r = comprar(item.id);
      if (r === 'ok') equipar(item.id);
      sonar(r === 'ok' ? 'check' : 'blip', sonido);
      setAviso(r === 'ok' ? `✓ ${item.nombre} comprado y equipado` : `${item.nombre}: ${RESULTADO[r]}`);
      return;
    }
    equipar(item.id);
    sonar('blip', sonido);
    setAviso(`Puesto: ${item.nombre}`);
  };

  const estado = (item: CosmeticItem) => {
    if (jugador.equipado[item.slot] === item.id) return { texto: 'EQUIPADO', tipo: 'puesto' };
    if (!estaDesbloqueado(jugador, item)) return { texto: motivoBloqueo(jugador, item) ?? 'BLOQUEADO', tipo: 'bloqueado' };
    if (esPropio(jugador, item)) return { texto: 'EQUIPAR', tipo: 'propio' };
    return { texto: `◉ ${item.precio} FICHAS`, tipo: 'comprar' };
  };

  return (
    <section className="wardrobe-shell" aria-label="Vestuario">
      <header className="wardrobe-heading">
        <div>
          <h2 className="wardrobe-title">VESTUARIO</h2>
          <p className="wardrobe-kicker">TU AVATAR, TUS REGLAS</p>
        </div>
        <div className="wardrobe-coins"><Sprite svg={uiSvg('coins')} size={15} /> {jugador.fichas} <span>FICHAS</span></div>
      </header>

      <section className="wardrobe-profile" aria-label="Perfil del avatar">
        <div className="wardrobe-portrait">
          <div className="wardrobe-portrait-label">AVATAR · NV. {jugador.nivel}</div>
          <div className="wardrobe-avatar-shadow" />
          <Avatar equipado={jugador.equipado} sexo={jugador.sexo} alto={156} titulo="Tu avatar" />
          <div className="wardrobe-spark" aria-hidden>✦</div>
        </div>

        <div className="wardrobe-profile-info">
          <div className="wardrobe-look-label">PROBADOR EN VIVO</div>
          <h3 className="wardrobe-profile-title">{jugador.equipado.ropa ? 'TU LOOK ACTUAL' : 'ARMA TU LOOK'}</h3>
          <p className="wardrobe-description">Combina prendas y accesorios como quieras.</p>

          <label className="wardrobe-field-label" htmlFor="wardrobe-name">NOMBRE</label>
          <input
            id="wardrobe-name"
            key={jugador.nombre}
            defaultValue={jugador.nombre}
            onBlur={(e) => renombrar(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            maxLength={24}
            className="wardrobe-name-input"
          />

          <div className="wardrobe-field-label wardrobe-sex-label">SILUETA</div>
          <div className="wardrobe-sex-switch" role="group" aria-label="Silueta del avatar">
            {(['f', 'm'] as Sexo[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={jugador.sexo === s}
                onClick={() => {
                  const store = usePlayerStore.getState();
                  if (typeof store.cambiarSexo === 'function') store.cambiarSexo(s);
                  else usePlayerStore.setState((prev) => ({ jugador: { ...prev.jugador, sexo: s, updatedAt: new Date().toISOString() } }));
                  sonar('blip', sonido);
                }}
                className={`wardrobe-sex-option ${jugador.sexo === s ? 'is-selected' : ''}`}
              >
                {s === 'f' ? '♀ MUJER' : '♂ HOMBRE'}
              </button>
            ))}
          </div>
          <div className="wardrobe-collection-count">{cosmeticos.filter((item) => esPropio(jugador, item)).length} piezas propias · {cosmeticos.length} diseños</div>
        </div>
      </section>

      <section className="wardrobe-catalog" aria-label="Catálogo de prendas">
        <div className="wardrobe-catalog-heading">
          <div>
            <h3>{totalRanuras} RANURAS PARA PERSONALIZAR</h3>
            <p>Toca una categoría para ver sus opciones</p>
          </div>
        </div>

        <nav className="wardrobe-tabs" aria-label="Categorías del vestuario">
          {SLOT_ORDEN.map((s) => {
            const equipadoId = jugador.equipado[s.id];
            const equipadoNombre = equipadoId
              ? cosmeticos.find((c) => c.id === equipadoId)?.nombre
              : undefined;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { setAbierto(s.id); setAviso(null); }}
                className="wardrobe-tab"
                aria-haspopup="dialog"
              >
                <span>{s.label}</span>
                <span className="wardrobe-tab-wearing">{equipadoNombre ?? '—'}</span>
              </button>
            );
          })}
        </nav>

        {aviso && !abierto && <div className="wardrobe-notice" role="status">{aviso}</div>}
      </section>

      <footer className="wardrobe-footer">
        <div>PELO · ROPA · ZAPATOS · ACCESORIOS</div>
        <p>GANA FICHAS EN MISIONES Y ARMA TU PROPIO LOOK</p>
      </footer>

      {abierto && createPortal(
        <div className="wardrobe-modal-backdrop">
          <button
            type="button"
            aria-label="Cerrar opciones"
            className="wardrobe-modal-veil"
            onClick={() => setAbierto(null)}
          />
          <div className="wardrobe-modal" role="dialog" aria-modal="true" aria-label={`Opciones de ${labelSlot}`}>
            <header className="wardrobe-modal-heading">
              <div className="wardrobe-modal-heading-copy">
                <div className="wardrobe-modal-eyebrow">{PRENDA_LABEL[abierto]} · {items.length} DISEÑOS</div>
                <h3 className="wardrobe-modal-title">{labelSlot}</h3>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(null)}
                className="wardrobe-modal-close"
                aria-label="Cerrar"
                autoFocus
              >
                ✕
              </button>
            </header>

            <div className="wardrobe-modal-content">
              {aviso && <div className="wardrobe-notice" role="status">{aviso}</div>}
              <div className="wardrobe-items wardrobe-modal-items">
              <button
                type="button"
                onClick={() => { desequipar(abierto); sonar('blip', sonido); setAviso(`${labelSlot}: sin prenda`); }}
                className={`wardrobe-item ${!jugador.equipado[abierto] ? 'is-equipped' : ''}`}
              >
                <div className="wardrobe-item-preview"><Avatar equipado={vista(abierto)} sexo={jugador.sexo} alto={72} /></div>
                <div className="wardrobe-item-meta">
                  <span className="wardrobe-item-slot">{PRENDA_LABEL[abierto]}</span>
                  <strong>Sin {abierto === 'ropa' ? 'ropa' : labelSlot.toLowerCase()}</strong>
                  <span className={`wardrobe-item-status ${!jugador.equipado[abierto] ? 'status-equipped' : ''}`}>
                    {!jugador.equipado[abierto] ? 'PUESTO' : 'QUITAR'}
                  </span>
                </div>
              </button>

              {items.map((item) => {
                const est = estado(item);
                const bloqueado = est.tipo === 'bloqueado';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => accion(item)}
                    aria-label={`${item.nombre}: ${est.texto}`}
                    className={`wardrobe-item ${est.tipo === 'puesto' ? 'is-equipped' : ''} ${bloqueado ? 'is-locked' : ''}`}
                  >
                    <div className="wardrobe-item-preview"><Avatar equipado={vista(abierto, item)} sexo={jugador.sexo} alto={72} /></div>
                    <div className="wardrobe-item-meta">
                      <span className="wardrobe-item-slot">{PRENDA_LABEL[item.slot]}{item.genero ? ` · ${item.genero === 'f' ? '♀' : item.genero === 'm' ? '♂' : '◇'}` : ''}</span>
                      <strong>{item.nombre}</strong>
                      <span className={`wardrobe-item-status status-${est.tipo}`}>{est.texto}</span>
                    </div>
                  </button>
                );
              })}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
