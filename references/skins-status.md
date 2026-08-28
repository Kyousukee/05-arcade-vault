# Estado de skins — Arcade Vault

Memoria de @skin-designer. Actualizado: 2026-08-28.
Estados: Pendiente · Completo · Parcial. Toda skin `clasico` reproduce el look original.

| Estado    | Juego         | id              | Dir          | Skins                   | Fecha      | Notas                                                          |
| --------- | ------------- | --------------- | ------------ | ----------------------- | ---------- | -------------------------------------------------------------- |
| Completo  | Caída         | `caida`         | `tetris/`    | clasico · neon · retro  | 2026-08-28 | Primera corrida: aquí nació el contrato compartido en `types.ts`. |
| Completo  | Asteroides    | `asteroides`    | `asteroids/` | clasico · neon · retro  | 2026-08-28 | Segunda corrida: consumió el contrato ya existente, sin tocarlo. |
| Pendiente | Serpentina    | `serpentina`    | `snake/`     | —                       | —          | Medio: `BOARD_BG`/`BOARD_CELL_ALT` limpios; frutas son atlas PNG. |
| Pendiente | Bloque Buster | `bloque-buster` | `arkanoid/`  | —                       | —          | Difícil: spritesheet, exige tintado en canvas o PNGs alternativos. |

## Contrato compartido

Ya existe en `lib/games/types.ts` desde 2026-08-28. **No se rediseña, se consume:**

- `SkinId = "clasico" | "neon" | "retro"` y `SKIN_IDS` (orden del selector, `clasico` primero).
- `GameSkin { id, label }` — forma común. Cada juego la extiende con SU record de colores.
- `GameMountOptions.skin?: SkinId` — ausente = `clasico`.
- `GameInstance.setSkin?(id): void` — opcional; su ausencia es lo que oculta el selector del HUD.

`components/GamePlayer.tsx` ya tiene el selector genérico: lee `av_skin_<gameId>` de
localStorage con `readStoredSkin()`, pasa la skin inicial por **ref** al montar y aplica los
cambios en un **efecto aparte** (`instanceRef.current?.setSkin?.(skin)`), nunca en las deps del
montaje. Detecta soporte con `typeof instance.setSkin === "function"`. Un juego nuevo solo tiene
que implementar `setSkin` y el selector aparece solo. El selector es un **combo box**
(`.skin-select`: disparador + panel `role="listbox"`, teclado y clic-fuera), no una fila de
swatches. Estilos: `.skin-select` en
`app/globals.css`.

## Detalle

### caida — Completo

- **Archivos:**
  - `lib/games/types.ts` — contrato compartido (aditivo y opcional).
  - `lib/games/tetris/skins.ts` — **nuevo.** `CaidaSkin`, `SKINS`, `resolveSkin()`.
  - `lib/games/tetris/constants.ts` — se le quitaron `COLORS` y `GRID_LINE_COLOR`, que migraron
    a `skins.ts` como la entrada `clasico`. Ya no tiene ni un color.
  - `lib/games/tetris/game.ts` — `rt.skin`, helpers `pushGlow`/`popGlow`, renderer sin literales
    y `setSkin()` en el handle público.
  - `components/GamePlayer.tsx` — estado, persistencia y combo box del HUD.
  - `app/globals.css` — bloque `.skin-picker` junto a `.hud-actions`.
- **Tokens de skin (11):** `pieces` (8 fills indexados por valor de celda, `null` en 0),
  `background`, `gridLine`, `cellHighlight`, `boardFrame`, `panelLabel`, `panelBox`,
  `overlayVeil`, `overlayTitle`, `overlayScore`, `glow`.
- **`glow`** es fracción del lado de celda (`rt.block`), no px fijos, para que el halo escale con
  el CRT. `clasico` y `retro` lo tienen a 0 y `pushGlow` no hace nada: cero cambio de render.
- **Fidelidad de `clasico`:** verificada por extracción — los 17 colores del original
  (8 de `COLORS` + `GRID_LINE_COLOR` + 8 literales inline de `game.ts`) aparecen idénticos y en
  el mismo orden en la entrada `clasico`.
- **Limitaciones:** ninguna. Caída no usa sprites ni imágenes; todo su color es extraíble y todo
  cambia con la skin, chrome incluido. El grep de color sobre `lib/games/tetris/` no devuelve
  nada fuera de `skins.ts`.
- **Verificación:** `npx tsc --noEmit` limpio y `npm run build` en verde. `npx eslint` sobre
  `components/GamePlayer.tsx` y `lib/games/` deja los **2 errores preexistentes** de
  `react-hooks/set-state-in-effect` (`setName` de `av_user` y `setMockLevel` del simulador), los
  mismos que había antes de tocar nada — cero errores nuevos. `references/templates/*.jsx` ya
  linteaba en rojo de fábrica y no se tocó.
### asteroides — Completo

- **Archivos:**
  - `lib/games/asteroids/skins.ts` — **nuevo.** `AsteroidsSkin`, `SKINS`, `resolveSkin()`,
    `particleStroke()` y los helpers `pushGlow`/`popGlow` (aquí y no en `game.ts` porque los
    usan también las entidades).
  - `lib/games/asteroids/entities.ts` — `draw()` de `Bullet`, `Asteroid`, `PowerUp`, `Ship` y
    `Particle` pasa a `draw(ctx, skin: AsteroidsSkin)`. Ya no tiene ni un color.
  - `lib/games/asteroids/game.ts` — `rt.skin = resolveSkin(skin)`, fondo y overlay desde la
    paleta, las entidades reciben `rt.skin` al dibujar, y `setSkin()` en el handle público.
  - `components/GamePlayer.tsx` y `app/globals.css` — **sin cambios**: el selector genérico y
    `.skin-picker` ya existían de la corrida de `caida`, y la detección por
    `typeof instance.setSkin === "function"` hace aparecer el combo box sola.
  - `lib/games/types.ts` — **sin cambios**: el contrato compartido se consume tal cual.
- **Tokens de skin (10):** `background`, `ship`, `thrust`, `bullet`, `asteroid`, `powerUp`,
  `particleRgb`, `overlayTitle`, `overlayScore`, `glow`.
- **`particleRgb`** guarda solo `"r,g,b"`: el alfa de la chispa lo pone el desvanecimiento
  frame a frame, así que lo compone `particleStroke(skin, alpha)` en vez de la paleta.
- **`glow`** aquí es px CSS directos (no fracción, como en Caída): Asteroides no tiene celda
  ni retícula de la que derivar una escala. `clasico` y `retro` a 0 → `pushGlow` no toca el
  contexto y el render es idéntico al original.
- **Fidelidad de `clasico`:** verificada por extracción. Los 9 colores del original
  (`#000` fondo, `#fff` nave/asteroide/bala/título, `#0ff` marco y "3x" del power-up,
  `rgba(255, 130, 0, 0.85)` llama, `rgba(255,255,255,alpha)` partícula,
  `rgba(255,255,255,0.65)` puntaje del overlay) aparecen idénticos, hex por hex, incluidos los
  espacios del `rgba` de la llama.
- **Limitaciones:** ninguna. Asteroides es vectorial puro, sin sprites ni imágenes: todo su
  color es extraíble y todo cambia con la skin, chrome incluido. El grep de color sobre
  `lib/games/asteroids/` no devuelve nada fuera de `skins.ts`.
- **Verificación:** `npx tsc --noEmit` limpio y `npm run build` en verde. `npx eslint` sobre
  `components/GamePlayer.tsx` y `lib/games/` deja los **2 errores preexistentes** de
  `react-hooks/set-state-in-effect` en `GamePlayer.tsx` (`setName` y `setMockLevel`) — cero
  errores nuevos, y `GamePlayer.tsx` no se tocó en esta corrida.
