# Spec 08 — Bloque Buster (Arkanoid) jugable

**Estado:** aprobado
**Depende de:** 05-asteroides-jugable, 06-juegos-y-leaderboard
**Fecha:** 2026-08-24

**Objetivo:** Portar el Arkanoid de `references/started-games/04-arkanoid` a TypeScript bajo el contrato `GameFactory`, registrarlo como `bloque-buster` y marcar esa fila de `games` como jugable para que compita en el leaderboard con puntajes reales.

> Se apoya en el contrato del registry y el reproductor del spec 05 (`lib/games/types.ts`, `lib/games/registry.ts`, `components/GamePlayer.tsx`) y en las tablas `games` / `scores` y el endpoint `POST /api/scores` del spec 06. Es el primer juego del vault con assets externos (spritesheet PNG y audio MP3) y el primero cuya relación de aspecto original (800×600) ya coincide con el CRT 4:3.

## Alcance

**Incluye:**

- **Portado a TypeScript** de `references/started-games/04-arkanoid` a `lib/games/arkanoid/`, sin globals de módulo:
  - `constants.ts` — área lógica `LOGICAL_W = 800` / `LOGICAL_H = 600`, `PADDLE_SPEED = 400`, `BLOCK_COLS = 10`, `BLOCK_ROWS = 6`, `BLOCK_W = 64`, `BLOCK_H = 24`, `BLOCKS_ORIGIN_X`, `BLOCKS_ORIGIN_Y = 80`, `BASE_BALL_VX = 200`, `BASE_BALL_VY = -300`, `PADDLE_INIT`, `BALL_SIZE = 16`, `START_LIVES = 3`, `POINTS_PER_BLOCK = 10`, `EXPLOSION_DURATION = 150`, `GAME_OVER_DELAY`, `STATE_INTERVAL`.
  - `levels.ts` — `LEVELS: LevelDef[]`, los 5 patrones (`parrilla`, `pirámide`, `ajedrez`, `filas con huecos`, `marco + cruz`) generados por funciones puras exportadas, con sus multiplicadores `1.00 / 1.10 / 1.21 / 1.33 / 1.46`.
  - `sprites.ts` — `SPRITES`, `EXPLOSION_FRAMES`, y un `loadSpritesheet(): Promise<CanvasImageSource>` **por instancia**, sin los globals `ssImg` / `ssLoaded` / `ssCallbacks`.
  - `audio.ts` — carga de los dos MP3 y reproducción por instancia, silenciada en pausa y liberada en `destroy()`.
  - `game.ts` — `createBloqueBusterGame(opts)`: estado en un objeto `runtime` local a la factory, loop `requestAnimationFrame`, listeners de teclado y ratón, `ResizeObserver` y `destroy()` idempotente.
- **Assets a `public/`**: `public/games/bloque-buster/spritesheet-breakout.png`, `public/games/bloque-buster/sounds/ball-bounce.mp3` y `.../break-sound.mp3`. Se referencian por ruta absoluta desde la raíz del sitio.
- **Área lógica fija 800×600**: el canvas llena el CRT y el contexto aplica `ctx.setTransform(dpr * w / 800, 0, 0, dpr * h / 600, 0, 0)`. Toda la geometría y la física del original se portan **sin recalibrar**. El resize solo recalcula ese transform.
- **Controles:** `←`/`→` mueven el paddle a `PADDLE_SPEED`; el ratón sobre el canvas lo centra en el puntero; `P` y `Escape` alternan pausa. `preventDefault` en flechas, ya cubierto por `BLOCKED_KEYS` de `components/GamePlayer.tsx` con su bypass para campos de formulario.
- **HUD en canvas portado tal cual**: `Score:` arriba-izquierda, `Nivel:` centrado y las vidas como sprites de pelota arriba-derecha. Además el juego publica `score`, `lives` y `level` al HUD React por `onState`, que ya tiene esos tres stats.
- **Fin de partida:** al agotarse las 3 vidas, overlay `GAME OVER` en canvas ~1.2 s y un único `onGameOver(score)`. Al completar el nivel 5, el mismo camino con el overlay `¡COMPLETASTE EL JUEGO!` — la partida perfecta también puntúa.
- **`restart()`** vuelve siempre al nivel 1 con `score = 0`, 3 vidas y la velocidad base.
- **Entrada `bloque-buster`** en `GAME_REGISTRY` (`lib/games/registry.ts`) con `import()` dinámico.
- **Migración `enable_game_bloque_buster`:** `update public.games set playable = true where id = 'bloque-buster'` y `delete from public.scores where game_id = 'bloque-buster'` (los 12 puntajes sembrados del spec 06).
- **Verificación:** `npm run lint`, `npm run build` y prueba manual del recorrido completo en navegador.

**NO incluye (fuera de este spec):**

- Controles táctiles para móvil — solo teclado y ratón, con el aviso `.keyboard-notice` que ya existe.
- Control de mute o de volumen en el reproductor: el audio suena siempre y solo calla en pausa. Un botón de mute es un spec de plataforma aparte.
- El overlay de pausa con los 5 botones de salto de nivel del original, y su `click` hit-testeado en canvas.
- Niveles más allá de los 5 de la fuente, power-ups, paddle de tamaño variable y lanzamiento manual de la pelota (sale disparada sola, como en el original).
- Repintado con la paleta neón del vault: se usan los sprites del spritesheet original.
- Cambios en `lib/games/types.ts` o en el HUD de `components/GamePlayer.tsx` — el juego encaja en el contrato actual.
- Cambiar el `title`, los textos `short`/`long`, el `cover` o el `sort_order` de la fila `bloque-buster`.
- Retirar los mocks duplicados de la biblioteca ni portar los demás juegos de `references/started-games/`.
- Tests automatizados (no hay test runner configurado).

**Consecuencias aceptadas de este scope:**

- La pestaña `BLOQUE BUSTER` del Hall of Fame pasa de 12 puntajes sembrados a **vacía** hasta que alguien juegue.
- Con el salto de nivel fuera, la única forma de ver los niveles 2–5 es jugarlos. Es lo que hace comparables los puntajes.
- Al ser el primer juego con audio y sin mute, un jugador que quiera silencio solo puede bajar el volumen del sistema o de la pestaña.
- Con el área lógica fija, en un CRT pequeño todo se ve más pequeño en vez de reajustarse: el juego escala, no se rediseña. Es la contrapartida de no recalibrar la física.
- La física original se porta con sus rarezas: al romper un bloque solo se invierte `vy` (nunca `vx`) y se procesa un bloque por frame.

## Modelo de datos

Este spec no crea tablas nuevas ni estructuras compartidas: reusa `public.games` y `public.scores` del spec 06 y actualiza una fila existente. Tampoco toca `lib/games/types.ts` — el juego encaja en el `GameState` actual. Lo que sí define es el estado interno del juego, los tipos de nivel y sprite, y el transform del canvas.

### Estado interno — `lib/games/arkanoid/game.ts`

No se exporta. Sustituye a los trece globals de módulo del original (`canvas, ctx, paddle, ball, blocks, explosions, lives, score, gameState, currentLevel, isPaused, keys, lastTime`) más los tres de `assets/spritesheet.js` (`ssImg, ssLoaded, ssCallbacks`):

```ts
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball extends Rect {
  vx: number; // px lógicos/segundo
  vy: number;
}

interface Block extends Rect {
  color: BlockColor;
  alive: boolean;
}

interface Explosion extends Rect {
  color: BlockColor;
  elapsed: number; // ms desde que se rompió el bloque
}

interface ArkanoidRuntime {
  paddle: Rect;
  ball: Ball;
  blocks: Block[];
  explosions: Explosion[];
  score: number;
  lives: number;
  level: number; // 1–5
  phase: GamePhase;
  prevPhase: GamePhase; // fase previa a la pausa
  keys: { left: boolean; right: boolean };
  sheet: CanvasImageSource | null; // null hasta que resuelve el PNG
  endMessage: string; // "GAME OVER" o "¡COMPLETASTE EL JUEGO!"
  gameOverTimer: number; // ~1.2 s de overlay antes de onGameOver
  stateAccum: number; // acumulador de la emisión de onState
  lastTime: number | null; // null tras resume() para no arrastrar dt
  /** Tamaño del canvas en px CSS. Solo se usa para calcular el transform. */
  cssW: number;
  cssH: number;
}
```

Todo el juego —posiciones, velocidades, colisiones y dibujo— vive en el **espacio lógico 800×600**. `cssW` / `cssH` no entran nunca en la física.

### Niveles y sprites

```ts
// levels.ts
type BlockColor = "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

interface BlockDef {
  col: number; // 0–9
  row: number; // 0–5
  color: BlockColor;
}

interface LevelDef {
  speed: number; // multiplicador de BASE_BALL_VX / BASE_BALL_VY
  blocks: BlockDef[];
}

export const LEVELS: LevelDef[]; // 5 entradas, speed 1.00 / 1.10 / 1.21 / 1.33 / 1.46
```

```ts
// sprites.ts
interface Frame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export const SPRITES: { paddle: Frame; ball: Frame; blocks: Record<BlockColor, Frame> };
export const EXPLOSION_FRAMES: Record<BlockColor, [Frame, Frame, Frame, Frame]>;
export function loadSpritesheet(): Promise<CanvasImageSource>;
```

`loadSpritesheet()` crea su propia `Image` con `src = "/games/bloque-buster/spritesheet-breakout.png"`, la vuelca a un canvas offscreen y resuelve. Sin caché de módulo: dos instancias cargan cada una la suya, y el navegador sirve la segunda del caché HTTP. Mientras la promesa no resuelve, `runtime.sheet` es `null` y el juego dibuja fondo negro sin romperse.

### Transform del canvas

`applyResize()` mide con `getBoundingClientRect()` y aplica un único transform que combina DPR y escala lógica:

```ts
canvas.width = Math.round(cssW * dpr);
canvas.height = Math.round(cssH * dpr);
ctx.setTransform((cssW * dpr) / LOGICAL_W, 0, 0, (cssH * dpr) / LOGICAL_H, 0, 0);
```

Como `.crt-screen` tiene `aspect-ratio: 4/3` y `LOGICAL_W / LOGICAL_H = 800 / 600` es también 4:3, los dos factores coinciden y no hay deformación. **Ninguna entidad se reposiciona al redimensionar**: sus coordenadas son lógicas y no cambian.

El `mousemove` hace el camino inverso para llevar el puntero al espacio lógico:

```ts
const mx = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
```

### Puntuación y progresión (portadas sin cambios)

- 10 puntos por bloque roto (`POINTS_PER_BLOCK`). El `score` se acumula a través de los 5 niveles.
- Al romperse el último bloque del nivel: si `level < 5`, carga el siguiente con su `speed`; si `level === 5`, victoria.
- Pelota perdida (`ball.y > 600`): `lives--`. Si quedan vidas, la pelota se reposiciona sobre el paddle con la velocidad del nivel actual; si no, fin de partida.
- Al romper un bloque solo se invierte `vy`, y se procesa **un bloque por frame**. Portado tal cual.

### Mapeo al `GameState`

| Campo del contrato | Qué publica Bloque Buster                   |
| ------------------ | ------------------------------------------- |
| `score`            | `runtime.score`                             |
| `lives`            | `runtime.lives` (3 → 0)                     |
| `level`            | `runtime.level` (1–5)                       |
| `phase`            | `runtime.phase`                             |
| `lines`            | no se publica (`undefined`) — no aplica     |
| `tripleShot`       | `0` constante — es específico de Asteroides |

`components/GamePlayer.tsx` y `app/globals.css` **no se tocan**: los stats `PUNTUACIÓN`, `VIDAS` y `NIVEL` ya existen y el de `LÍNEAS` se oculta solo al llegar `undefined`.

### Entrada en el registry — `lib/games/registry.ts`

```ts
export const GAME_REGISTRY: Record<string, () => Promise<GameFactory>> = {
  asteroides: async () => (await import("./asteroids/game")).createAsteroidsGame,
  caida: async () => (await import("./tetris/game")).createCaidaGame,
  "bloque-buster": async () => (await import("./arkanoid/game")).createBloqueBusterGame,
};
```

La carpeta se llama por la fuente (`arkanoid`) y la factory por el juego publicado (`createBloqueBusterGame`), igual que `tetris` / `createCaidaGame`.

### Migración `enable_game_bloque_buster`

La fila ya existe desde el seed del spec 06 (`sort_order = 0`, `cat = 'ARCADE'`, `cover = 'cover-bricks'`, `color = 'cyan'`, `title = 'BLOQUE BUSTER'`), así que es un `update`, no un `insert`:

```sql
update public.games set playable = true where id = 'bloque-buster';
delete from public.scores where game_id = 'bloque-buster';
```

El `delete` retira los 12 puntajes sembrados: a partir de aquí `bloque-buster` solo acumula partidas reales, igual que `asteroides` y `caida`. El schema no cambia, así que **no** hay que regenerar `lib/supabase/database.types.ts`.

## Plan de implementación

1. **Consultar la doc vendored.** Revisar `node_modules/next/dist/docs/` antes de escribir código: `01-app/02-guides` para `import()` dinámico y para servir archivos estáticos desde `public/` en Next 16.2.10, y las convenciones de client component con `useRef`/`useEffect` sobre `<canvas>` con React 19. No hay ruta ni fichero de convención nuevo: el reproductor ya existe.

2. **Copiar los assets a `public/`.** `spritesheet-breakout.png` a `public/games/bloque-buster/`, y `ball-bounce.mp3` y `break-sound.mp3` a `public/games/bloque-buster/sounds/`. Verificable de inmediato: `npm run dev` y abrir `/games/bloque-buster/spritesheet-breakout.png` en el navegador.

3. **Constantes.** Crear `lib/games/arkanoid/constants.ts` con `LOGICAL_W`, `LOGICAL_H`, `PADDLE_SPEED`, `BLOCK_COLS`, `BLOCK_ROWS`, `BLOCK_W`, `BLOCK_H`, `BLOCKS_ORIGIN_X`, `BLOCKS_ORIGIN_Y`, `BASE_BALL_VX`, `BASE_BALL_VY`, `PADDLE_INIT`, `BALL_SIZE`, `START_LIVES`, `POINTS_PER_BLOCK`, `EXPLOSION_DURATION`, `GAME_OVER_DELAY` y `STATE_INTERVAL`. Sin consumidores todavía.

4. **Niveles.** Crear `lib/games/arkanoid/levels.ts` con `BlockColor`, `BlockDef`, `LevelDef` y `LEVELS`, portando la IIFE del original a cinco funciones puras (`buildGrid`, `buildPyramid`, `buildCheckerboard`, `buildGappedRows`, `buildFrameCross`) que devuelven `BlockDef[]`. Verificable con un `console.log` puntual: 60, 45, 30, 40 y 34 bloques respectivamente.

5. **Spritesheet.** Crear `lib/games/arkanoid/sprites.ts` con `Frame`, `SPRITES`, `EXPLOSION_FRAMES` y `loadSpritesheet()` devolviendo una `Promise` — sin `ssImg`/`ssLoaded`/`ssCallbacks` de módulo. `drawSprite` y `drawFrame` pasan a recibir la hoja como parámetro en vez de leerla de un global.

6. **Audio.** Crear `lib/games/arkanoid/audio.ts` con una función que precarga los dos MP3 y expone `playBounce()` / `playBreak()` clonando el nodo para permitir solapamiento, más un `dispose()` que pausa y suelta las referencias. Todo por instancia.

7. **Factory y loop.** Crear `lib/games/arkanoid/game.ts` con `createBloqueBusterGame(opts)`: el `runtime` local, `initPaddle`, `initBall`, `loadLevel(n)`, `collideAABB`, el `update(dt)` portado (paddle, movimiento de pelota, rebotes en muros, rebote en paddle, colisión con bloques, explosiones, pelota perdida) y el loop `rAF` con `dt` capado a 50 ms. Devuelve un `GameInstance` con los cinco métodos y un `draw()` mínimo (fondo, paddle, pelota, bloques).

8. **Dibujo completo.** Añadir las explosiones (4 frames según `elapsed / EXPLOSION_DURATION`) y el HUD en canvas: `Score:` a la izquierda, `Nivel:` centrado y las vidas como sprites de pelota a la derecha. Mientras `runtime.sheet` sea `null`, solo se pinta el fondo negro.

9. **Controles.** Listener `keydown`/`keyup` en `window` para `←`/`→` y `mousemove` sobre el canvas convirtiendo el puntero al espacio lógico. `P` y `Escape` alternan pausa por el mismo camino que el botón del HUD.

10. **Pausa.** `pause()` guarda `prevPhase`, detiene la actualización y silencia el audio; `resume()` restaura la fase y pone `lastTime = null` para no arrastrar un `dt` gigante. El overlay de pausa del original (con sus 5 botones de salto de nivel y su `click`) no se porta: lo cubre el panel `EN PAUSA` de `GamePlayer.tsx`.

11. **Fin de partida.** Un único `toGameOver(message)` con guard: fija `phase = "gameover"`, guarda `endMessage` y arranca `gameOverTimer`. Entra por tres caminos: vidas a 0 (`GAME OVER`), nivel 5 completado (`¡COMPLETASTE EL JUEGO!`) y el botón `FIN` (`GAME OVER`). El canvas dibuja el overlay durante `GAME_OVER_DELAY` (~1.2 s) y al agotarse invoca `onGameOver(score)` una sola vez.

12. **`restart()`.** Reinicia `score = 0`, `lives = START_LIVES`, `level = 1`, limpia explosiones, recentra el paddle y llama `loadLevel(1)`.

13. **Canvas responsive.** `measure()` con `getBoundingClientRect()` y `applyResize()` fijando `canvas.width/height = cssSize * devicePixelRatio` y el `setTransform` combinado de DPR y escala lógica, disparado por un `ResizeObserver` sobre el canvas. Sin reposicionar entidades: sus coordenadas son lógicas.

14. **Publicación de estado.** Emitir `onState` cada `STATE_INTERVAL` (0.1 s) más emisión inmediata al cambiar `phase`, `lives` o `level`, con `{ score, lives, level, phase, tripleShot: 0 }` y sin `lines`.

15. **`destroy()` idempotente.** Flag `destroyed`, `cancelAnimationFrame`, `observer.disconnect()`, `removeEventListener` de teclado y de `mousemove`, y `dispose()` del audio. Verificado con React Strict Mode en dev.

16. **Registry.** Añadir la línea `"bloque-buster"` a `GAME_REGISTRY` en `lib/games/registry.ts`. A partir de aquí `/game/bloque-buster/play` monta el juego real en vez del simulador.

17. **Migración.** Aplicar `enable_game_bloque_buster` con `mcp__supabase__apply_migration` (`update ... playable = true` + `delete from scores where game_id = 'bloque-buster'`) y verificar con `mcp__supabase__execute_sql`: `playable = true` en `bloque-buster`, `count(*) = 9` en `games`, `count(*) = 0` en sus `scores`. Sin regenerar tipos: el schema no cambia.

18. **Verificación.** `npm run lint` y `npm run build` sin errores. Prueba manual en `npm run dev`: jugar `/game/bloque-buster/play` (mover con flechas y con ratón, romper bloques, oír los dos sonidos, ver la explosión, perder una vida, pasar del nivel 1 al 2 y notar la subida de velocidad), pausar con botón, `P` y `Escape` comprobando que el audio calla, perder las 3 vidas → overlay + modal → guardar puntaje → verlo en `/hall-of-fame` y en `/game/bloque-buster`, `JUGAR DE NUEVO`, `SALIR` y volver a entrar, redimensionar durante la partida, y comprobar que `/game/asteroides/play` y `/game/caida/play` siguen igual y que los mocks siguen con el simulador.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] `lib/games/arkanoid/` no tiene variables de módulo mutables: dos instancias del juego pueden coexistir sin interferirse.
- [ ] `lib/games/types.ts`, `components/GamePlayer.tsx` y `app/globals.css` no se modifican.
- [ ] `lib/games/asteroids/` y `lib/games/tetris/` no se modifican, y `/game/asteroides/play` y `/game/caida/play` funcionan igual que antes del spec.
- [ ] `/games/bloque-buster/spritesheet-breakout.png`, `/games/bloque-buster/sounds/ball-bounce.mp3` y `/games/bloque-buster/sounds/break-sound.mp3` responden 200 en el navegador.
- [ ] `/game/bloque-buster/play` monta un `<canvas>` dentro del CRT y el paddle responde a `←`/`→`.
- [ ] Mover el ratón sobre el canvas centra el paddle en el puntero, y el paddle nunca sale del área (`0 ≤ x ≤ 800 - paddle.w` en coordenadas lógicas).
- [ ] La pelota rebota en los tres muros y en el paddle, y romper un bloque suma exactamente 10 puntos.
- [ ] Al romper un bloque se dibuja la animación de explosión de 4 frames y desaparece a los 150 ms.
- [ ] Suenan `ball-bounce.mp3` al rebotar y `break-sound.mp3` al romper un bloque, y dos rebotes seguidos se solapan sin cortarse.
- [ ] Los 5 niveles muestran sus patrones (parrilla, pirámide, ajedrez, filas con huecos, marco + cruz) y romper el último bloque de un nivel carga el siguiente sin reiniciar el `score`.
- [ ] La pelota va perceptiblemente más rápida en el nivel 5 que en el nivel 1.
- [ ] Perder la pelota descuenta una vida y la reposiciona sobre el paddle; con 0 vidas termina la partida.
- [ ] El HUD en canvas muestra `Score:`, `Nivel:` y las vidas como sprites de pelota, y desaparece durante los overlays de fin.
- [ ] El HUD React muestra `PUNTUACIÓN`, `VIDAS` y `NIVEL` con los valores del juego (no del simulador falso) y se actualizan al romper un bloque, perder una vida y cambiar de nivel.
- [ ] El HUD React **no** muestra el stat de `LÍNEAS` en `/game/bloque-buster/play`, y sí lo sigue mostrando en `/game/caida/play`.
- [ ] `PAUSA` congela la partida, silencia el audio y `REANUDAR` continúa sin que la pelota salte de posición (sin `dt` acumulado); `P` y `Escape` alternan igual que el botón.
- [ ] En pausa **no** aparece el selector de niveles del original: solo el panel `EN PAUSA` de la plataforma.
- [ ] `FIN` termina la partida y abre el modal con el puntaje actual.
- [ ] Al agotar las 3 vidas, el canvas muestra el overlay `GAME OVER` y después aparece el modal; `onGameOver` se invoca una sola vez.
- [ ] Al romper el último bloque del nivel 5, el canvas muestra `¡COMPLETASTE EL JUEGO!` y después aparece el mismo modal con el puntaje final.
- [ ] Guardar en el modal hace `POST /api/scores` con `gameId: "bloque-buster"` y devuelve el puesto obtenido.
- [ ] `JUGAR DE NUEVO` reinicia una partida limpia: nivel 1, puntuación 0, 3 vidas y velocidad base.
- [ ] `select playable from games where id = 'bloque-buster'` devuelve `true` y `select count(*) from games` sigue devolviendo 9.
- [ ] `select count(*) from scores where game_id = 'bloque-buster'` devuelve 0 antes de la primera partida real.
- [ ] La pestaña `BLOQUE BUSTER` del Hall of Fame muestra su estado vacío sin romper, y tras guardar una partida muestra ese puntaje; `/game/bloque-buster` muestra la misma tabla.
- [ ] `bloque-buster` aparece en Home y en Biblioteca con la portada `cover-bricks`, el título `BLOQUE BUSTER` y sus textos originales, ahora marcada como jugable.
- [ ] Redimensionar la ventana durante la partida escala el juego sin deformarlo y sin mover la pelota, el paddle ni los bloques respecto al tablero.
- [ ] El canvas se ve nítido con `devicePixelRatio > 1`.
- [ ] Si el spritesheet tarda en cargar, el canvas se ve negro y el juego no lanza errores en consola.
- [ ] Las flechas no scrollean la página mientras el juego está montado, y vuelven a hacerlo al salir de la ruta; el input de iniciales del modal sigue aceptando texto.
- [ ] `SALIR` o navegar fuera detiene el loop, quita listeners de teclado y ratón, desconecta el `ResizeObserver` y calla el audio; volver a entrar no duplica el loop ni la velocidad de la pelota (verificado en dev con React Strict Mode).
- [ ] Los ids sin juego real siguen mostrando el simulador falso sin cambios.
- [ ] En viewport pequeño se muestra el aviso `.keyboard-notice`.

## Decisiones tomadas y descartadas

- **Reusar la fila `bloque-buster` en vez de crear una `arkanoid` nueva.** Decisión explícita del usuario. Se descarta la fila nueva porque repetiría la deuda que dejó el spec 05 con `rocas` y `asteroides`: dos juegos gemelos en la biblioteca, uno real y uno falso. `bloque-buster` ya tiene categoría `ARCADE`, portada `cover-bricks`, color `cyan` y textos correctos para un rompe-bloques. Costo: la ruta pública es `/game/bloque-buster`, no `/game/arkanoid`.

- **Área lógica fija 800×600 con `setTransform`, en vez de unidades proporcionales.** Decisión explícita del usuario. Es el único portado del vault donde la relación de la fuente ya coincide con el CRT 4:3, así que toda la geometría y la física del original se portan **sin recalibrar** y el resize es una sola línea. Se descarta el enfoque proporcional de Asteroides porque obligaría a recalcular cada constante y a reposicionar entidades en cada resize, sin ganar nada. Costo: en un CRT pequeño el juego se ve más pequeño en vez de reajustarse.

- **Ratón y teclado a la vez.** Decisión explícita del usuario. El ratón es el control natural de un Arkanoid y el CRT ya tiene `touch-action: none`. Se descarta dejar solo teclado por paridad con Asteroides y Caída: aquí la fuente trae el ratón y quitarlo empeoraría el juego.

- **Fuera el overlay de pausa con salto de nivel.** Decisión explícita del usuario. Era una herramienta de desarrollo, y conservarlo **invalidaría el leaderboard**: cualquiera podría saltar al nivel 5 o farmear el nivel 1. Además convive mal con el panel `EN PAUSA` de `GamePlayer.tsx` y con su `click` hit-testeado en canvas, que habría que reconvertir a coordenadas lógicas. Se descarta también conservarlo como indicador pasivo del nivel: el HUD ya muestra `Nivel:`.

- **La victoria entra por `onGameOver`, sin tocar `GamePhase`.** Decisión explícita del usuario. Completar el nivel 5 muestra `¡COMPLETASTE EL JUEGO!` en canvas y luego el modal de siempre, así que la partida perfecta también puntúa. Se descarta añadir `"win"` a `GamePhase` porque obligaría a que el reproductor y los otros dos juegos conozcan una fase que solo usa este. Se descarta el bucle infinito tras el nivel 5 porque cambiaría el balance de la fuente y convertiría el portado en rediseño.

- **Sin extender `GameState` ni tocar el HUD.** El juego tiene `score`, `lives` y `level` nativos y los tres stats ya existen en `components/GamePlayer.tsx` desde el spec 05. Se descarta publicar métricas extra (bloques restantes, combo): serían un stat nuevo en el reproductor a cambio de nada.

- **El sonido entra en este spec, sin control de mute.** Decisión explícita del usuario. Son 2 MP3 de ~19 KB en total y el audio es parte de la fuente. Se descarta añadir un botón de mute con preferencia en `localStorage`: es un cambio del reproductor que afecta a los tres juegos y merece su propio spec. Costo aceptado: quien quiera silencio usa el volumen del sistema o el mute de la pestaña. El audio sí calla al pausar.

- **Carga del spritesheet por instancia, con `Promise`.** Se descartan los globals `ssImg` / `ssLoaded` / `ssCallbacks` del original: son exactamente el patrón que impide dos instancias y que duplica trabajo bajo React Strict Mode. El navegador ya cachea el PNG por HTTP, así que la segunda carga no cuesta red.

- **Assets bajo `public/games/bloque-buster/`.** Decisión explícita del usuario. Un directorio por juego mantiene ordenado `public/` cuando lleguen los portados siguientes, frente a un `public/sprites/` plano que acabaría mezclando assets de todos.

- **Se portan los sprites del original, sin repintar con la paleta neón del vault.** Decisión explícita del usuario. Mismo precedente que los specs 05 y 07: se respeta la estética de la fuente. Repintar es una fase de diseño propia.

- **Se borran los 12 puntajes sembrados de `bloque-buster`.** Decisión explícita del usuario. Se descarta conservarlos porque los juegos reales solo acumulan partidas reales; mantener puestos inventados por encima de los de un jugador real vacía de sentido el leaderboard. Costo: la pestaña del Hall of Fame arranca vacía.

- **Migración por `update`, no por `insert`.** La fila ya existe desde el seed del spec 06. Se descarta borrarla y reinsertarla porque el `on delete cascade` de `scores` y el `sort_order` quedarían expuestos a un error innecesario.

- **La fila no cambia de `title`, textos, `cover` ni `sort_order`.** Decisión explícita del usuario. `BLOQUE BUSTER` con `sort_order = 0` se queda primero de la grilla.

- **Se portan las rarezas de la física original.** Al romper un bloque solo se invierte `vy` (nunca `vx`) y se procesa un bloque por frame. Se descarta "arreglarlo" con reflexión por eje: cambiaría el comportamiento calibrado de la fuente y es un rediseño, no un portado.

## Riesgos identificados

| Riesgo                                                                                                                                                                                                                                                                                                         | Mitigación                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El autoplay del navegador bloquea el audio.** Chrome y Safari exigen un gesto del usuario antes de reproducir sonido. El juego arranca al montar la ruta, no al hacer clic, así que los primeros `play()` pueden ser rechazados con una promesa que nadie captura → error en consola.                        | Envolver cada reproducción en un `.catch(() => {})`: el juego nunca debe romperse por audio. En la práctica el usuario llegó pulsando `JUGAR`, así que el gesto suele existir; si no, el sonido entra en el primer rebote posterior a la primera tecla. Criterio de aceptación sobre la ausencia de errores en consola. |
| **`cloneNode()` por cada rebote crea nodos sin límite.** El original clona un `Audio` en cada colisión y nunca los libera; en una partida larga eso son cientos de elementos que el GC solo recoge cuando terminan.                                                                                            | El módulo `audio.ts` reproduce por instancia y `dispose()` pausa y suelta las referencias en `destroy()`. Si el solapamiento no lo exige, reusar el mismo nodo con `currentTime = 0` en vez de clonar.                                                                                                                  |
| **El spritesheet puede no haber cargado en los primeros frames.** El original simplemente no dibuja (`if (!ssLoaded) return`), lo que deja un canvas negro sin explicación.                                                                                                                                    | `runtime.sheet = null` es un estado explícito y el loop dibuja el fondo sin lanzar errores. Criterio de aceptación propio. Riesgo residual aceptado: son 30 KB desde el mismo origen.                                                                                                                                   |
| **La escala lógica multiplica el grosor de línea y el tamaño de fuente del HUD en canvas.** El `setTransform` escala todo, incluido el texto: en un CRT grande el `Score:` de 18 px lógicos se ve enorme, y en uno pequeño ilegible.                                                                           | Es el comportamiento deseado — el juego escala como una unidad — pero hay que verificar la legibilidad en ambos extremos durante el paso 18. Si no cuadra, se ajusta el tamaño en px lógicos, nunca el transform.                                                                                                       |
| **Un solo bloque por frame con la pelota rápida.** El `break` del bucle de colisiones deja que la pelota atraviese un segundo bloque en el mismo frame sin romperlo. Con `speed = 1.46` en el nivel 5 y `dt` capado a 50 ms, el desplazamiento por frame puede superar la altura de un bloque (24 px lógicos). | Portado tal cual por decisión de fidelidad. `dt` capado a 50 ms limita el peor caso. Riesgo residual aceptado: si en la prueba manual la pelota atraviesa bloques de forma visible, se corrige en un spec posterior, no improvisando durante la implementación.                                                         |
| **React Strict Mode monta dos veces en dev.** Si `destroy()` no cancela el `rAF`, los listeners de teclado y `mousemove`, el `ResizeObserver` y el audio, quedan dos loops: la pelota va al doble de velocidad y cada rebote suena doble.                                                                      | Paso 15 del plan y criterio de aceptación propio sobre Strict Mode.                                                                                                                                                                                                                                                     |
| **`preventDefault` global secuestra el teclado.** Las flechas están en `BLOCKED_KEYS`; si el listener sobrevive a la ruta o captura el foco del input de iniciales, no se puede escribir el nombre ni scrollear.                                                                                               | El bypass para `INPUT`/`TEXTAREA`/contentEditable ya existe en `components/GamePlayer.tsx` y no se toca. Criterio de aceptación sobre el input del modal y sobre el scroll al salir de la ruta.                                                                                                                         |
| **El `mousemove` mueve el paddle aunque el juego esté pausado o terminado.** El original no comprueba la fase, así que el paddle se desliza bajo el overlay de `GAME OVER`.                                                                                                                                    | Comprobar `phase === "playing"` en el handler. Es una corrección de una línea, no un rediseño.                                                                                                                                                                                                                          |
| **Pausa mal implementada teletransporta la pelota.** Si `resume()` no resetea `lastTime`, el primer frame tras la pausa trae todo el tiempo transcurrido y la pelota salta media pantalla, posiblemente atravesando bloques o el paddle.                                                                       | Paso 10 del plan lo trata explícitamente y hay criterio de aceptación sobre ello.                                                                                                                                                                                                                                       |
| **El `delete` de puntajes es irreversible.** Los 12 puntajes sembrados de `bloque-buster` no están en ninguna migración versionada del repo: una vez borrados, restaurarlos exige regenerarlos a mano.                                                                                                         | Son datos sembrados sin valor, documentados en el spec 06. Riesgo residual aceptado.                                                                                                                                                                                                                                    |

## Qué **no** está en este spec

- Controles táctiles para móvil.
- Control de mute o de volumen en el reproductor.
- El overlay de pausa con salto de nivel del original.
- Niveles más allá de los 5 de la fuente, power-ups, paddle variable y lanzamiento manual de la pelota.
- Repintado con la paleta neón del vault.
- Cambios en `lib/games/types.ts` o en el HUD de `components/GamePlayer.tsx`.
- Retirar los mocks duplicados ni portar los demás juegos de `references/started-games/`.
- Tests automatizados.

Cada uno de ellos, si entra, va en su propio spec.
