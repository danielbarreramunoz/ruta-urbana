# RUTA URBANA — PWA (Vite + React + TS + Leaflet)

Juego de exploración urbana IRL como **Progressive Web App instalable**.
Presupuesto $0: todo gratuito/open-source, sin APIs de pago.

## Stack

- Vite + React 19 + TypeScript estricto + Tailwind CSS v4 (`@theme` en `src/index.css`).
- Mapa: **Leaflet** + tiles OSM estándar con filtro CSS nocturno (sin key; uso moderado según política de OSM). Atribución © OpenStreetMap incluida en el mapa.
- Estado: **zustand + persist a localStorage** (`ruta-urbana/*`). Sin backend.
- PWA: `vite-plugin-pwa` (service worker autoUpdate, precache del app shell, runtime cache de tiles 7 días).

## Comandos

```bash
npm run dev          # desarrollo (http://localhost:5173)
npm run build        # typecheck + build + PWA en dist/
npm run preview      # sirve dist/ local
```

Verificación antes de declarar listo: `npx tsc -b` limpio + `npm run build` OK + test de datos (`node -e` contra `src/game/data/*.json`, ver historial). Detalle del orden y trampas en "Verificación obligatoria" y "Store" abajo.

## Verificación obligatoria (orden)

```bash
npx tsc -b          # mínimo en frontend; debe salir limpio
npm run build       # incluye typecheck + PWA; timeout amplio (300000 ms)
npm run lint        # oxlint; 0 errores. Preexistentes: 5× react(only-export-components) en sprites.tsx + 1× set-state-in-effect en geo.ts:26
```

- Sin tests unitarios en el repo. Para lógica pura (`fog.ts`, `cosmetics.ts`, `proximity.ts`, economía del store): compilar con `npx esbuild <file> --bundle --format=esm --outfile=/tmp/opencode/x.mjs` y correr `node` con stub de `localStorage`.
- Validar catálogos con `node -e`: ids únicos en `cosmetics.json`, `premio`/`desbloqueo.mision` existentes en `quests.json`, `paga` numérica.
- Tras cambiar `fog.ts`: correr el test de cobertura punto por punto (celdas nuevas pagan una vez; re-revelar no paga).

## Store (zustand + persist): reglas que muerden

- Claves `ruta-urbana/*` (`jugador`, `misiones`, `exploracion`, `alertas`, `ajustes`). Al agregar campos a `Jugador` o exploración: subir `version` + `migrate` + extender `normalizarJugador`/equivalente. Probar migración simulando un payload viejo en `localStorage` (v3 sin `sexo` → `'m'`).
- `ganarXP` alimenta `useFxStore` (efímero, no persistido). `FxOverlay` además vigila `jugador.nivel` como red de seguridad: no romper ese doble camino.
- Efectos agregados (`anunciarXp`) agrupan ráfagas (~1.2 s): no asumir 1 aviso = 1 llamada.
- En handlers de UI, leer acciones nuevas con `usePlayerStore.getState()` en el momento del clic (o fallback con `setState`), no solo por selector: un módulo desfasado (HMR / service worker viejo) causó `cambiarSexo is not a function`.
- `rescate` exige misión activa y paga una sola vez (`estado === 'activa'`); no relajar esa guarda.

## Avatar paramétrico (`src/components/avatar.ts`)

- Firma `avatarSvg(equipado, sexo, ancho, alto)`; string SVG, sin negro puro (bordes = `oscurecer()` del color de la prenda). Verificar con `grep -i "12121A\|TINTA"` vacío tras rediseños.
- Silueta `Sexo = 'f' | 'm'`; prendas con `genero` solo etiquetan (♀/♂), no restringen.
- Todo uso de `<Avatar>` / `avatarSvg` debe pasar `sexo` (`MapView`, `FxOverlay`, `AvatarEditor`). `MapView` refresca con `marker.setIcon` ante `[equipado, sexo, caminando, mirandoIzq]`.
- Revisión visual: bundle con esbuild + raster a PNG en `/tmp/opencode/*.png` (script en `/tmp/opencode/render.cjs`, no commitear). Comparar outfits hombre/mujer antes de declarar listo.

## Mapa / UI móvil

- `MapView`: banner en wrapper `inset-x-0 px-3` + hijo `w-full`, ✕ dentro (`right-1.5 top-1.5`); fila GPS/PAD con `min-w-0`/`flex-none`; título con `break-words`. El contenedor raíz lleva `overflow-hidden`.
- Ruta al destino = polyline recta punteada al próximo paso `ir` (`proximoDestino` en `proximity.ts`); honesto offline, sin ruteo pago.
- "Ya llegué" solo habilitado dentro del radio; fuera muestra `A X M · ACÉRCATE`.
- Pestañas del vestuario en wrap (no scroll oculto): MOCHILA debe verse sin scroll.
- Recuadro grande del avatar con fondo claro (`#e9e4d4 → #c3bcab`) para prendas oscuras.

## Reglas duras

1. **Cero dependencias de pago**: solo MIT/Apache/BSD. Prohibido Google Maps, Mapbox con tarjeta, keys con facturación.
2. **Data-driven**: guiones y catálogos viven en `src/game/data/*.json`; la UI los consume, nunca hardcodear guiones en componentes. Tipos canónicos en `src/game/types.ts` (Atributos: carisma, valentia, burocracia, supervivencia).
3. **Motor de niebla** en `src/game/fog.ts` (puro TS, sin DOM): celdas 100 m, revelado por intersección rectángulo-círculo. Cambios aquí → correr el test de cobertura punto por punto.
4. **GPS web es best-effort**: `watchPosition` muere con la pantalla apagada y el navegador pide permiso. El joystick mock siempre disponible; el juego nunca se bloquea sin GPS.
5. **Offline real de tiles**: el SW cachea lo ya visto; zonas nuevas requieren red. No prometer offline total del mapa.
6. Proyecto hermano `ruta-urbana-android/` (Expo + MapLibre nativo) archivado para el port futuro; no mezclar código RN aquí.

## Puertas de fase

- Fase 0-2: ✅ Mapa + niebla + joystick + misiones data-driven + HUD + diálogos + rescate.
- Fase 3: ✅ Proximidad a misión activa (radio 50–80 m) con vibración + banner + notificación opcional (solo app oculta, con permiso) + modo discreto para sensibles + cooldown 10 min. Sin app abierta NO hay geofencing en web: no prometerlo.
- Fase 4: ✅ Sprites pixel-art SVG propios (avatar, 3 retratos NPC, pines, iconos), sonidos retro Web Audio muteables, `GUIA-CALLE.md` con protocolo de 3 salidas. Pendiente: dogfooding en calle por el usuario.
- Fase 5: ✅ (base jugable sin backend) Sincronización de perfil last-write-wins, catálogo comunitario, generador local de misiones, radar con ubicación difusa + intercambio presencial de 4 dígitos + fantasmas en el mapa.

### Backend local (opcional, solo para multijugador real)

```bash
supabase start      # Postgres + PostGIS local (requiere Docker y Supabase CLI)
# aplica supabase/migrations/0001_fase5.sql y copia .env.example → .env
```

Sin `.env` la app es 100% funcional en solitario. Entre dispositivos con backend en la misma WiFi, usar la IP LAN en vez de 127.0.0.1. RLS actual = abierto (solo desarrollo local).
