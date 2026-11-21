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
