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

Verificación antes de declarar listo: `npx tsc -b` limpio + `npm run build` OK + test de datos (`node -e` contra `src/game/data/*.json`, ver historial).

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
