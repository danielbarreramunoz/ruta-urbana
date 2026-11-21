# Dogfooding — protocolo de pruebas en calle (Fase 4)

Objetivo: validar que RUTA URBANA sirve fuera del escritorio. Mínimo **3 salidas reales**.

## Preparación (antes de salir)

1. En el PC: `npm run build` y sirve `dist/` o despliega la URL pública.
2. En el teléfono: abre la URL, instala la PWA (Agregar a pantalla de inicio).
3. Activa ubicación en modo **preciso** y desactiva el ahorro de batería para el navegador (si no, el GPS se duerme).
4. Carga completa + datos móviles (los tiles nuevos requieren red).

## Salida 1 — Mapa y niebla (~20 min caminando)

- [ ] El avatar te sigue con GPS real (modo 📡).
- [ ] La niebla se disipa a tu paso (radio 100 m).
- [ ] Cierra la app (incluso del multitarea), reabre: las zonas siguen despejadas.
- [ ] Anota: ¿cuántos metros de deriva tiene el GPS detenido? ¿La batería bajó cuánto %?

## Salida 2 — Misión completa (Registro Civil o farmacia real)

- [ ] Activa la misión, marca el checklist **antes** de salir.
- [ ] Al entrar al radio: ¿vibró? ¿banner correcto? (farmacia: texto neutro).
- [ ] Usa el guion del NPC palabra por palabra. ¿Sirvió? ¿Qué faltó?
- [ ] Completa la misión: ¿subió XP/atributos? ¿Sonó el jingle?

## Salida 3 — Rescate + joystick apagado

- [ ] Fuerza un rescate (botón 🆘): ¿dio XP parcial y quedó reprogramada?
- [ ] Prueba solo con GPS (sin joystick): ¿la app es usable caminando con una mano?
- [ ] Revisa consumo: ¿el teléfono se calentó? ¿El navegador pausó el GPS con pantalla apagada? (limitación web conocida: documentar).

## Criterio de salida

Fase 4 se da por validada si: app estable en las 3 salidas, GPS útil ±25 m, batería sin drenaje anormal y al menos 1 guion NPC usado tal cual con éxito.
