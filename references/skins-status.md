# Estado de skins — Arcade Vault

Memoria de @skin-designer. Actualizado: 2026-08-28.
Estados: Pendiente · Completo · Parcial. Toda skin `clasico` reproduce el look original.

| Estado    | Juego         | id              | Dir          | Skins                   | Fecha      | Notas                                                          |
| --------- | ------------- | --------------- | ------------ | ----------------------- | ---------- | -------------------------------------------------------------- |
| Completo  | Caída         | `caida`         | `tetris/`    | clasico · neon · retro  | 2026-08-28 | Primera corrida: aquí nació el contrato compartido en `types.ts`. |
| Completo  | Asteroides    | `asteroides`    | `asteroids/` | clasico · neon · retro  | 2026-08-28 | Segunda corrida: consumió el contrato ya existente, sin tocarlo. |
| Completo  | Serpentina    | `serpentina`    | `snake/`     | clasico · neon · retro  | 2026-08-28 | Tercera corrida. El atlas de frutas NO se tiñe: ver limitaciones. |
| Completo  | Bloque Buster | `bloque-buster` | `arkanoid/`  | clasico · neon · retro  | 2026-08-28 | Spritesheet: tintado en canvas cacheado por skin, explosiones incluidas. |

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
  - `app/globals.css` — bloque `.skin-select` junto a `.hud-actions`.
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
    `.skin-select` ya existían de la corrida de `caida`, y la detección por
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
### serpentina — Completo

- **Archivos:**
  - `lib/games/snake/skins.ts` — **nuevo.** `SerpentinaSkin`, `SKINS`, `resolveSkin()` y
    `snakeBodyFill()`.
  - `lib/games/snake/snake.ts` — se le quitaron `SNAKE_GREEN`, `SNAKE_HEAD` y `SNAKE_DEAD`, que
    migraron a `skins.ts` como la entrada `clasico`. `drawSnake()` y `drawEyes()` reciben ahora
    la skin como último parámetro. Ya no tiene ni un color.
  - `lib/games/snake/game.ts` — se le quitaron `BOARD_BG` y `BOARD_CELL_ALT`; `rt.skin =
    resolveSkin(skin)`, tablero, fruta y overlay leen de `rt.skin`, y `setSkin()` en el handle
    público.
  - `components/GamePlayer.tsx`, `app/globals.css` y `lib/games/types.ts` — **sin cambios**: el
    contrato y el combo box `.skin-select` ya existían, y la detección por
    `typeof instance.setSkin === "function"` hace aparecer el selector sola.
- **Tokens de skin (13):** `background`, `boardCellAlt`, `snakeBodyRgb`, `snakeHead`,
  `snakeDead`, `snakeEye`, `snakeAura`, `snakeGlow`, `fruitGlow`, `fruitAura`, `fruitFallback`,
  `overlayVeil`, `overlayTitle`.
- **`snakeBodyRgb`** guarda solo `"r, g, b"` (con los espacios del original): el alfa del cuerpo
  lo pone el degradado hacia la cola, así que lo compone `snakeBodyFill(skin, alpha)`.
- **`snakeGlow` es la excepción del vault:** en Caída y Asteroides `glow: 0` era el estado neutro,
  pero aquí el resplandor **forma parte del aspecto original** (`shadowBlur = 10` fijo en
  `drawSnake`). Por eso `clasico` lo trae a 10, `neon` lo sube a 18 y es `retro` —fósforo plano—
  quien lo apaga a 0.
- **Fidelidad de `clasico`:** verificada por extracción. Los 8 colores del original (`#080810`,
  `#0d0d18`, `rgba(0, 0, 0, 0.6)`, `#fff`, `#00ff88`, `#b6ffe0`, `#ff2e4d`, `#0a0a0f`), el
  `shadowBlur = 10` y el formato exacto de `rgba(0, 255, 136, x.xxx)` (espacios y `toFixed(3)`
  incluidos) se reproducen tal cual. `fruitFallback: null` conserva el color propio de cada fruta
  en el círculo de reserva.
- **Limitaciones:** **las frutas no cambian de color.** Son recortes de un atlas PNG
  (`public/games/serpentina/fruits.png`, 22 sprites) y su color es lo que identifica cada fruta y
  delata su tramo de puntos (común 10 / medio 25 / grande 50); tintarlas por canvas dejaría 22
  manchas indistinguibles y rompería la lectura del valor. La skin sí controla su **halo**
  (`fruitGlow`/`fruitAura`, a 0 en `clasico` y `retro`, 14 px cian-amarillo en `neon`) y el color
  del **círculo de reserva** que sustituye al sprite si el PNG no carga (`fruitFallback`). Por eso
  los 22 hex de `lib/games/snake/sprites.ts` siguen ahí: son metadatos del asset, no tokens de
  skin. El grep de color sobre el resto de `lib/games/snake/` (renderer: `game.ts` y `snake.ts`)
  no devuelve nada.
- **Verificación:** `npx tsc --noEmit` limpio y `npm run build` en verde. `npx eslint` sobre
  `components/GamePlayer.tsx` y `lib/games/` deja los **2 errores preexistentes** de
  `react-hooks/set-state-in-effect` (líneas 75 y 212 de `GamePlayer.tsx`, del simulador mock) —
  cero errores nuevos, y `GamePlayer.tsx` no se tocó en esta corrida.
### bloque-buster — Completo
- **Archivos:**
  - `lib/games/arkanoid/skins.ts` — **nuevo.** `ArkanoidSkin`, `SpriteTint`, `SKINS`,
    `resolveSkin()` y los helpers `pushGlow`/`popGlow`.
  - `lib/games/arkanoid/sprites.ts` — pipeline de tintado: `Spritesheet` (ahora
    `HTMLCanvasElement`, hacía falta `width`/`height`), `SkinnedSheet`, `buildTintedSheet()`,
    `tintFrameInto()` y `drawExplosionFrame()`. `drawSprite`/`drawBlockSprite` reciben
    `SkinnedSheet` en vez de la hoja cruda.
  - `lib/games/arkanoid/game.ts` — `rt.skin`, caché `rt.tinted: Map<SkinId, SkinnedSheet>`,
    `skinnedSheet()`, `drawWalls()`, chrome sin literales y `setSkin()` en el handle público.
  - `components/GamePlayer.tsx`, `app/globals.css` y `lib/games/types.ts` — **sin cambios**: el
    contrato y el combo box genérico ya existían y se consumen tal cual.
- **Vía elegida: tintado en canvas**, no PNGs alternativos (no se añaden assets). `buildTintedSheet()`
  produce una copia offscreen de la hoja entera por skin con tres pasadas de
  `globalCompositeOperation` por recorte: `color` (tono y saturación conservando la luminosidad, así
  sobrevive el biselado), `destination-in` (restaura la máscara alfa) y `source-atop` al 22 %
  (arrastra hacia el tinte los píxeles casi blancos, que `color` deja intactos). Una hoja por skin,
  cacheada en el runtime: nunca se tinta por frame.
- **Tokens de skin (8):** `background`, `hudText`, `overlayVeil`, `overlayTitle`, `wall`, `glow` y
  `tint` (`blocks` — los 7 `BlockColor` —, `paddle`, `ball`). El tinte de cada familia de bloque
  manda también sobre sus 4 frames de explosión, para que bloque y muerte casen.
- **`gray` y su explosión:** en el spritesheet `gray` reusa la fila de explosión de `red`
  (`sy: 176`), así que en una sola copia no caben ambos tintes. Se genera aparte una tira de
  128×16 (`SkinnedSheet.grayExplosion`) con esa explosión en el color de `gray`.
- **`wall`** es aditivo: el original no dibujaba marco, así que `clasico` lo tiene a `null` y
  `drawWalls()` no pinta nada. `neon` y `retro` sí lo usan, y es parte de lo que los separa.
- **Fidelidad de `clasico`:** verificada por extracción. Los 4 colores del original (`#000` fondo,
  `#fff` HUD, `rgba(0, 0, 0, 0.6)` velo, `#fff` mensaje del overlay) aparecen idénticos, espacios
  del `rgba` incluidos. Además `tint: null` hace que el sprite **no pase por el pipeline de
  tintado** (se dibuja la hoja original) y `glow: 0` deja `pushGlow` sin tocar el contexto: cero
  regresión visual.
- **Limitaciones:** el juego no tiene ni una fuente de color propia fuera del PNG, así que todo el
  color de bloques, paddle, pelota y explosiones es **derivado** del sprite: el modo `color`
  conserva la luminosidad original, de modo que las skins cambian tono y saturación pero no el
  claroscuro ni el biselado horneado en la hoja. Los píxeles con luminosidad máxima (brillos casi
  blancos) solo se desplazan el 22 % del refuerzo `source-atop`, a propósito, para no aplanar el
  sprite. El grep de color sobre `lib/games/arkanoid/` no devuelve nada fuera de `skins.ts`.
- **Verificación:** `npx tsc --noEmit` limpio y `npm run build` en verde. `npx eslint` sobre
  `components/GamePlayer.tsx` y `lib/games/` deja los **2 errores preexistentes** de
  `react-hooks/set-state-in-effect` (`setName` y `setMockLevel`) — cero errores nuevos, y
  `GamePlayer.tsx` no se tocó en esta corrida.
