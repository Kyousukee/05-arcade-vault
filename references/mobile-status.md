# Estado móvil — Arcade Vault

Memoria de @mobile-porter. Actualizado: 2026-08-31.
Estados: Pendiente · Completo · Parcial. Base heredada: `specs/10-controles-tactiles-movil.md`.

| Estado   | Juego         | id              | Dir          | Mando                        | Fecha      | Notas                                                     |
| -------- | ------------- | --------------- | ------------ | ---------------------------- | ---------- | --------------------------------------------------------- |
| Completo | Asteroides    | `asteroides`    | `asteroids/` | ▲ ◀ ▶ · A FUEGO · B II       | 2026-08-28 | Del spec 10, no de una corrida de este agente.            |
| Completo | Caída         | `caida`         | `tetris/`    | ▼ ◀ ▶ · A GIRO · B CAÍDA     | 2026-08-28 | Del spec 10. `B` es `Space`, no la pausa.                 |
| Completo | Bloque Buster | `bloque-buster` | `arkanoid/`  | ◀ ▶ · B II                   | 2026-08-28 | Del spec 10. Mando de un solo botón.                      |
| Completo | Serpentina    | `serpentina`    | `snake/`     | ▲ ▼ ◀ ▶ · B II               | 2026-08-28 | Del spec 10. Mando de un solo botón.                      |
| Completo | Ranaria       | `ranaria`       | `frogger/`   | ▲ ▼ ◀ ▶ · B II               | 2026-08-31 | Primera corrida real del agente. Un toque = un salto.     |

## Base heredada del spec 10

Estas cuatro filas **no salieron de una corrida de @mobile-porter**: las dejó implementadas el
spec `specs/10-controles-tactiles-movil.md`. Se registran aquí para que la primera corrida real
solo vea como pendiente lo que de verdad lo esté.

Lo que ese spec dejó montado y que toda corrida consume sin rediseñar:

- `components/TouchGamepad.tsx` — cruceta de 4 direcciones + botones `A` / `B`, sin diagonales.
  Traduce cada control a `KeyboardEvent` sintético sobre `window` (`emit()`), con multitouch por
  `Map<pointerId, code>`, `setPointerCapture` y `keyup` de lo pendiente al desmontar. **No conoce
  ningún juego**: todo lo específico vive en `PAD_MAPS`.
- `components/GamePlayer.tsx` — `isCoarse` con `matchMedia("(pointer: coarse)")`, montaje bajo
  `isReal && isCoarse`, y la clase `av-playing` en `document.body`.
- `app/globals.css`, bloque `@media (pointer: coarse)` — layout de retrato a `100dvh` (Nav, footer
  y `.crt-bottom` ocultos), `.player-hud.hud-compact` en dos filas, y el modal de fin de partida
  anclado arriba con `max-height: 90dvh`.

Fuera de alcance por decisión del spec 10, y por tanto de este agente: gestos (swipe, arrastre del
paddle), landscape, overlay de "gira el dispositivo", vibración háptica, Fullscreen API,
`userScalable: false`, mando remapeable, y cualquier cambio en `lib/games/`.

## Detalle

### asteroides — Completo (spec 10)

- **Mando:** cruceta ▲ `ArrowUp` · ◀ `ArrowLeft` · ▶ `ArrowRight` — A `Space` (FUEGO) — B `KeyP` (II).
- **Archivos:** solo `PAD_MAPS`.
- **Controles descartados:** freno e hiperespacio. No caben en seis controles y el juego se
  sostiene sin ellos.
- **HUD / layout:** nada específico; usa `lives` y `power` (triple disparo), ya soportados.

### caida — Completo (spec 10)

- **Mando:** cruceta ▼ `ArrowDown` · ◀ `ArrowLeft` · ▶ `ArrowRight` — A `ArrowUp` (GIRO) —
  B `Space` (CAÍDA).
- **Archivos:** solo `PAD_MAPS`.
- **Controles descartados:** la pausa (`KeyP`) cede su botón a la caída rápida; se pausa desde el
  botón `PAUSA` del HUD compacto. Es el único juego donde `B` no es la pausa.
- **HUD / layout:** usa `lines`, ya soportado.

### bloque-buster — Completo (spec 10)

- **Mando:** ◀ `ArrowLeft` · ▶ `ArrowRight` — B `KeyP` (II). Sin `A`, sin ▲ ▼.
- **Archivos:** solo `PAD_MAPS`.
- **Controles descartados:** ninguno; el juego solo lee tres teclas.
- **Limitaciones:** mando de un solo botón, consecuencia aceptada de tener un mando único para
  todo el catálogo. El arrastre del paddle sobre el canvas quedó fuera del spec 10.

### serpentina — Completo (spec 10)

- **Mando:** las cuatro direcciones — B `KeyP` (II). Sin `A`.
- **Archivos:** solo `PAD_MAPS`.
- **Controles descartados:** ninguno.
- **HUD / layout:** usa `fruits`, ya soportado. El swipe para girar quedó fuera del spec 10.
### ranaria — Completo
- **Mando:** cruceta ▲ `ArrowUp` · ▼ `ArrowDown` · ◀ `ArrowLeft` · ▶ `ArrowRight` — sin `A` —
  B `KeyP` (II).
- **Archivos:** solo `PAD_MAPS` en `components/TouchGamepad.tsx`. Ni CSS ni `GamePlayer`.
- **Controles descartados:** `KeyW`/`KeyS`/`KeyA`/`KeyD` son alias de las flechas (mismo efecto,
  no merecen botón propio) y `Escape` es alias de `KeyP` para la pausa, ya cubierta por `B`.
  `a` queda en `null`: Ranaria no tiene acción secundaria y un botón inerte se lee como fallo.
- **Auto-repeat:** el mando emite **un solo `keydown` por dedo**, sin repetición. Medido con CDP:
  un dedo mantenido 1,5 s produce exactamente `D:ArrowUp` + `U:ArrowUp`, o sea **un salto por
  toque**, que es lo canónico en Frogger. El `pendingDir` del juego no encadena saltos.
- **HUD / layout:** nada. Ranaria publica `score`, `level` y `lives`, los tres ya pintados; canvas
  4:3 (800×600) como el resto; stats + selector de skin caben en 360 px sin desbordar
  (`hud-stats.scrollWidth === clientWidth`).
- **Verificación:** contexto táctil de Playwright (`hasTouch`, `isMobile`, DPR 2) a 360×640 y
  390×844. `av-playing` activo, sin scroll horizontal ni vertical, cinco `.pad-key` (los cuatro
  del mapa + pausa, ni uno de más), 47×47 px a 360 y 51×51 a 390, `pad.bottom` 630 ≤ 640 y
  `canvas.top` 107 ≥ 0. Tap real por CDP: puntuación 10 → 20 (una fila avanzada); la pausa por `B`
  levanta el overlay. Multitouch OK (`ArrowUp` + `ArrowLeft` simultáneos). Modal de fin de partida
  a 360×640: acepta las iniciales y el botón GUARDAR queda a y=402 con `vh` 640, visible con el
  teclado virtual abierto. Consola sin errores. `npm run lint` sin novedades (64 problemas
  preexistentes, idénticos antes y después; `TouchGamepad.tsx` limpio) y `npm run build` en verde.
