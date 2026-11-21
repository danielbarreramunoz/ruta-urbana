# RUTA URBANA — El RPG de tu vida

Juego de exploración urbana IRL como **Progressive Web App instalable**: camina por tu ciudad, disipa la niebla, completa misiones de la vida real (trámites, salud, trabajo) y personaliza tu avatar con lo que ganes. Presupuesto **$0**: todo gratuito y open-source, sin APIs de pago ni keys con facturación.

## Qué puedes hacer

- 🗺️ **Explorar**: la niebla cubre la ciudad y se disipa a tu paso (celdas de 100 m). Cada celda nueva da XP, con bonus cada 25.
- 📜 **Misiones**: 3 misiones guionadas + generador local de secundarias. Cada una paga XP, **fichas** y a veces un cosmético. Si algo externo falla, el botón 🆘 cobra XP parcial.
- 🧢 **Vestuario**: 42 prendas en 10 ranuras (pelo, gorro, lentes, barba, aros, ropa, pantalón, zapatos, tatuaje, mochila), con siluetas de mujer y hombre. Se compran con fichas o se ganan como premio.
- 📍 **Proximidad**: al entrar al radio del destino (50–80 m) vibra y aparece el banner; "Ya llegué" solo se activa dentro del área.
- 🛰️ **Radar social**: fantasmas con ubicación difusa e intercambio presencial de 4 dígitos (con backend local opcional).

## Requisitos

- Node 22 + npm (el repo usa `package-lock.json`; no mezclar con pnpm/yarn).
- Sin `.env` la app funciona 100% en solitario (localStorage). El backend Supabase es opcional, solo para multijugador real en tu red.

## Puesta en marcha

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # typecheck + build + PWA en dist/
npm run preview  # sirve dist/ en local
```

En el teléfono: abre la URL, **Agregar a pantalla de inicio**, y sal a caminar. Sin GPS también se puede jugar con el pad virtual (modo PAD). Ver el protocolo de pruebas en calle en [`GUIA-CALLE.md`](GUIA-CALLE.md).

## Stack

| Capa | Tecnología |
|---|---|
| App | Vite + React 19 + TypeScript estricto + Tailwind CSS v4 |
| Mapa | Leaflet + tiles OSM estándar (filtro CSS nocturno, atribución incluida) |
| Estado | zustand + persist a `localStorage` (`ruta-urbana/*`), sin backend |
| PWA | `vite-plugin-pwa` (service worker autoUpdate, precache del app shell, caché de tiles 7 días) |
| Audio | Web Audio retro, sin archivos, muteable |

## Estructura

```
src/
  App.tsx                 # tabs: inicio, mapa, misiones, radar, jugador
  components/             # MapView, Quests, AvatarEditor, FxOverlay, Hud, sprites…
  game/
    data/*.json           # catálogos data-driven: quests, dialogues, items, cosmetics
    types.ts              # tipos canónicos (Jugador, Quest, CosmeticItem…)
    store.ts              # stores zustand (jugador, misiones, exploración, alertas, fx)
    fog.ts                # motor de niebla: puro TS, sin DOM
    proximity.ts          # radios, cooldown 10 min, próximo destino
    generador.ts          # generador local de misiones secundarias
    audio.ts / geo.ts / alerts.ts / backend.ts / social.ts / useRadar.ts…
supabase/migrations/      # SQL opcional para multijugador local
```

## Reglas del proyecto

1. **Data-driven**: guiones y catálogos viven en `src/game/data/*.json`; la UI los consume, nunca hardcodea guiones. Tipos canónicos en `src/game/types.ts`.
2. **Cero dependencias de pago**: solo MIT/Apache/BSD. Prohibido Google Maps, Mapbox con tarjeta o keys con facturación.
3. **GPS web es best-effort**: `watchPosition` muere con la pantalla apagada; el joystick mock siempre disponible, el juego nunca se bloquea sin GPS.
4. **Offline honesto**: el service worker cachea lo ya visto; zonas y tiles nuevos requieren red. Sin la app abierta no hay geofencing en web.

## Verificación

```bash
npx tsc -b       # debe salir limpio
npm run build    # typecheck + PWA
npm run lint     # oxlint (hay 6 warnings preexistentes conocidos)
```

Más detalle (orden, persist/migraciones, avatar, mapa móvil) en [`AGENTS.md`](AGENTS.md).

## Video promocional

`promo/ruta-urbana-promo.html` es un video vertical **1080×1920 (24 s)** animado con Canvas, con **música chiptune sintetizada en vivo** (Web Audio, sin archivos ni red). Ábrelo en Chrome/Edge (o en `http://localhost:5173/promo/ruta-urbana-promo.html` con `npm run dev`) y pulsa **● Grabar WebM**: descarga `ruta-urbana-promo.webm` con video + audio. **♪ Descargar WAV** exporta el tema de 24 s por separado.

```bash
ffmpeg -i ruta-urbana-promo.webm -c:v libx264 -c:a aac -pix_fmt yuv420p promo.mp4
```

La música arranca con el clic (política de autoplay); el botón **♪ Música** la silencia (la grabación saldrá sin audio).

## Backend local (opcional)

Solo para multijugador real entre dispositivos de tu red:

```bash
supabase start      # requiere Docker + Supabase CLI
# aplica supabase/migrations/0001_fase5.sql y copia .env.example → .env
```

Usa la IP LAN en vez de `127.0.0.1`. RLS actual = abierto (solo desarrollo local).
