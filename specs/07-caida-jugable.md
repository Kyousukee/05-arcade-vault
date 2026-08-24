# Spec 07 — Caída (Tetris) jugable

**Estado:** aprobado
**Depende de:** 05-asteroides-jugable, 06-juegos-y-leaderboard
**Fecha:** 2026-08-24

**Objetivo:** Portar el Tetris de `references/started-games/03-tetris` a TypeScript bajo el contrato `GameFactory`, registrarlo como `caida` y marcar esa fila de `games` como jugable para que compita en el leaderboard con puntajes reales.

> Se apoya en el contrato del registry y el reproductor del spec 05 (`lib/games/types.ts`, `components/GamePlayer.tsx`) y en las tablas `games` / `scores` y el endpoint `POST /api/scores` del spec 06.

## Alcance

**Incluye:**

- **Portado a TypeScript** de `references/started-games/03-tetris/game.js` (332 líneas) a `lib/games/tetris/`:
  - `constants.ts` — `COLS = 10`, `ROWS = 20`, `COLORS` (8 colores + `null` en el índice 0), `PIECES` (las 8 matrices, incluida la tuerca `N`), `LINE_SCORES`, `KICKS`, `GRID_LINE_COLOR`, `DROP_BASE_MS`, `DROP_STEP_MS`, `DROP_MIN_MS`, `GAME_OVER_DELAY`, `STATE_INTERVAL`.
  - `board.ts` — lógica pura sin estado de módulo: `createBoard()`, `collide(board, shape, x, y)`, `rotateCW(shape)`, `merge(board, piece)`, `clearLines(board)`, `ghostY(board, piece)`, `randomPiece()`.
  - `game.ts` — `createCaidaGame(opts)`: estado en un objeto `runtime` local a la factory, loop `requestAnimationFrame`, listener de teclado, `ResizeObserver` y `destroy()` idempotente.
- **Un solo canvas** que dibuja tablero, rejilla, ghost piece, pieza actual y el panel `NEXT` en el hueco lateral. Desaparece el `#next-canvas` del original.
- **Layout letterbox dentro del CRT 4:3:** el tablero ocupa la altura completa con `BLOCK = h / ROWS`, y el ancho sobrante aloja el panel `NEXT`.
- **Extensión del contrato** en `lib/games/types.ts`: `lives?: number` (pasa a opcional) y `lines?: number` (nuevo). Ningún campo obligatorio cambia de tipo para Asteroides.
- **HUD** en `components/GamePlayer.tsx`: nuevo `hud-stat` de `LÍNEAS` visible solo cuando el juego publica `lines`, y el `hud-stat.lives` se oculta cuando `lives` llega `undefined`. Asteroides sigue publicando `lives` y no cambia.
- **Estilos** en `app/globals.css`: la clase del nuevo `hud-stat` de líneas, siguiendo las CSS vars existentes. `cover-tetro` se reusa sin tocarla.
- **Controles:** `←`/`→` mover, `↑` o `X` rotar con wall kicks `[0,-1,1,-2,2]`, `↓` soft drop, `Espacio` hard drop, `P` y `Escape` alternan pausa. `preventDefault` en flechas y `Espacio` (ya cubierto por `BLOCKED_KEYS`), con el bypass existente para campos de formulario.
- **Fin de partida:** overlay `GAME OVER` dibujado en canvas ~1.2 s y un único `onGameOver(score)` después. `restart()` reinicia tablero, `score`, `lines`, `level` y `dropInterval`.
- **Entrada `caida`** en `GAME_REGISTRY` con `import()` dinámico.
- **Migración `enable_game_caida`:** `update public.games set playable = true where id = 'caida'` y `delete from public.scores where game_id = 'caida'` (los 12 puntajes sembrados del spec 06).
- **Verificación:** `npm run lint`, `npm run build` y prueba manual del recorrido completo en navegador.

**NO incluye (fuera de este spec):**

- Controles táctiles para móvil — solo teclado, con el aviso `.keyboard-notice` que ya existe.
- El botón de tema claro/oscuro del original y su `localStorage['tetris-theme']`.
- Sonido — el original no tiene y no se agrega.
- Repintado con la paleta neón del vault: se portan los 8 colores pastel del original tal cual.
- SRS completo, 7-bag randomizer, hold, lock delay y T-spins. Se mantienen `Math.random()` por pieza y los wall kicks simples del original.
- Portar Arkanoid (`references/started-games/04-arkanoid`) — otro spec.
- Retirar el mock `rocas` ni consolidar los juegos duplicados de la biblioteca.
- Cambiar el `title` de la fila (`CAÍDA` se queda), sus textos, su `cover` o su `sort_order`.
- Tests automatizados (no hay test runner configurado).

**Consecuencias aceptadas de este scope:**

- La pestaña `CAÍDA` del Hall of Fame pasa de 12 puntajes sembrados a **vacía** hasta que alguien juegue. Es intencional: los juegos reales solo acumulan partidas reales.
- La pieza `N` (tuerca, anillo 3×3 con hueco) es propia de esta fuente y no del Tetris estándar. Sale 1 de cada 8 veces y hace las líneas más difíciles; se porta por fidelidad a la fuente.
- `lives` deja de ser obligatorio en `GameState`, así que un juego futuro puede olvidarse de publicarlo sin que el compilador avise.

## Modelo de datos

Este spec no crea tablas nuevas: reusa `public.games` y `public.scores` del spec 06 y actualiza una fila existente. Lo que sí define es el estado interno del juego, la extensión del contrato y el layout del canvas.

### Estado interno — `lib/games/tetris/game.ts`

No se exporta. Sustituye a los doce globals de módulo del original (`board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId`):

```ts
/** Celda: 0 = vacía; 1–8 = índice en COLORS de la pieza que la ocupa. */
type Cell = number;

interface Piece {
  shape: Cell[][]; // matriz cuadrada, rotada in situ
  x: number; // columna de la esquina superior izquierda
  y: number; // fila de la esquina superior izquierda
}

interface TetrisRuntime {
  board: Cell[][]; // ROWS × COLS
  current: Piece;
  next: Piece;
  score: number;
  lines: number;
  level: number;
  phase: GamePhase;
  prevPhase: GamePhase; // fase previa a la pausa
  dropAccum: number; // ms acumulados desde la última bajada
  dropInterval: number; // ms entre bajadas, derivado del nivel
  gameOverTimer: number; // ~1.2 s de overlay antes de onGameOver
  stateAccum: number; // acumulador de la emisión de onState
  lastTime: number | null; // null tras resume() para no arrastrar dt
  /** Dimensiones lógicas en px CSS del canvas completo (el CRT 4:3). */
  w: number;
  h: number;
  /** Lado de celda en px CSS: h / ROWS. Sustituye al BLOCK = 30 fijo. */
  block: number;
  /** Esquina superior izquierda del tablero dentro del canvas. */
  boardX: number;
  boardY: number;
}
```

### Layout dentro del CRT 4:3

El tablero es 10×20 (1:2) y el CRT es 4:3. El canvas ocupa el CRT entero y el contenido se compone en él:

- `block = h / ROWS` — el tablero llena la altura completa (`boardY = 0`).
- Ancho del tablero: `COLS * block = h / 2`.
- Ancho del panel `NEXT`: `4 * block`. Separación tablero–panel: `1 * block`.
- Ancho total del contenido: `15 * block = 0.75 * h`. Como el CRT mide `w ≈ 1.333 * h`, sobra espacio: el conjunto se centra horizontalmente con `boardX = (w - 15 * block) / 2`.
- El panel `NEXT` se dibuja en `boardX + 11 * block`, con el rótulo encima y la pieza siguiente centrada en su caja de 4×4 celdas.

Al redimensionar solo se recalculan `w`, `h`, `block`, `boardX` y `boardY` y se redibuja: el tablero es una rejilla en coordenadas de celda, así que **no hay reescalado de posiciones**.

### Puntuación y progresión (portadas sin cambios)

- Líneas: `LINE_SCORES = [0, 100, 300, 500, 800]`, multiplicado por el nivel actual.
- Soft drop: +1 punto por fila. Hard drop: +2 puntos por celda recorrida.
- Nivel: `Math.floor(lines / 10) + 1`.
- Velocidad: `dropInterval = Math.max(DROP_MIN_MS, DROP_BASE_MS - (level - 1) * DROP_STEP_MS)`, con `DROP_BASE_MS = 1000`, `DROP_STEP_MS = 90`, `DROP_MIN_MS = 100`.
- Fin de partida: la pieza recién generada ya colisiona al aparecer.

### Extensión del contrato — `lib/games/types.ts`

```ts
export interface GameState {
  score: number;
  level: number;
  phase: GamePhase;
  /** Vidas restantes. Ausente en juegos que no tienen vidas (Caída). */
  lives?: number;
  /** Líneas eliminadas. Solo lo publican los juegos que llevan la cuenta (Caída). */
  lines?: number;
  /** Segundos restantes de disparo triple; 0 si no está activo. */
  tripleShot: number;
}
```

`lives` pasa de obligatorio a opcional; `lines` es nuevo y opcional. Ningún campo cambia de tipo, así que `lib/games/asteroids/game.ts` no se toca.

**Mapeo de Caída al `GameState`:**

| Campo del contrato | Qué publica Caída                                     |
| ------------------ | ----------------------------------------------------- |
| `score`            | `runtime.score`                                       |
| `level`            | `runtime.level`                                       |
| `lines`            | `runtime.lines`                                       |
| `phase`            | `runtime.phase`                                       |
| `lives`            | no se publica (`undefined`) — el juego no tiene vidas |
| `tripleShot`       | `0` constante — es específico de Asteroides           |

**HUD en `components/GamePlayer.tsx`:** el `hud-stat.lives` se renderiza solo si `gameState?.lives !== undefined`; se añade un `hud-stat.lines` con rótulo `LÍNEAS` que se renderiza solo si `gameState?.lines !== undefined`. El simulador falso de los juegos mock sigue mostrando `lives` como hasta ahora.

### Entrada en el registry — `lib/games/registry.ts`

```ts
export const GAME_REGISTRY: Record<string, () => Promise<GameFactory>> = {
  asteroides: async () => (await import("./asteroids/game")).createAsteroidsGame,
  caida: async () => (await import("./tetris/game")).createCaidaGame,
};
```

### Migración `enable_game_caida`

La fila ya existe desde el seed del spec 06 (`sort_order = 1`, `cat = 'PUZZLE'`, `cover = 'cover-tetro'`, `color = 'magenta'`), así que es un `update`, no un `insert`:

```sql
update public.games set playable = true where id = 'caida';
delete from public.scores where game_id = 'caida';
```

El `delete` retira los 12 puntajes sembrados: a partir de aquí `caida` solo acumula partidas reales, igual que `asteroides`. El schema no cambia, así que **no** hay que regenerar `lib/supabase/database.types.ts`.

## Plan de implementación

1. **Consultar la doc vendored.** Revisar `node_modules/next/dist/docs/` antes de escribir código: `01-app/02-guides` (lazy loading e `import()` dinámico) y las convenciones de client component con `useRef`/`useEffect` sobre `<canvas>` en Next 16.2.10 con React 19. No hay ruta nueva ni fichero de convención nuevo: el reproductor ya existe.

2. **Extender el contrato.** En `lib/games/types.ts`, volver `lives` opcional y añadir `lines?: number`. Compila sin tocar Asteroides, que sigue publicando ambos campos.

3. **Constantes.** Crear `lib/games/tetris/constants.ts` con `COLS`, `ROWS`, `COLORS`, `PIECES` (las 8, incluida la tuerca), `LINE_SCORES`, `KICKS`, `GRID_LINE_COLOR`, `DROP_BASE_MS`, `DROP_STEP_MS`, `DROP_MIN_MS`, `GAME_OVER_DELAY`, `STATE_INTERVAL`. Sin consumidores todavía.

4. **Lógica pura del tablero.** Crear `lib/games/tetris/board.ts` con `createBoard`, `collide`, `rotateCW`, `merge`, `clearLines`, `ghostY` y `randomPiece`. Todas reciben el tablero y la pieza como parámetros — cero estado de módulo.

5. **Factory y loop.** Crear `lib/games/tetris/game.ts` con `createCaidaGame(opts)`: `runtime` local, `spawn`, `lockPiece`, `softDrop`, `hardDrop`, `tryRotate`, y el loop `rAF` con `dt` capado a 50 ms que acumula en `dropAccum` y baja la pieza al superar `dropInterval`. Devuelve un `GameInstance` con los cinco métodos, de momento con `draw()` mínimo (tablero y pieza).

6. **Dibujo completo.** Añadir `layout()` (calcula `block`, `boardX`, `boardY`), rejilla, ghost piece con `globalAlpha = 0.2`, marco del tablero y panel `NEXT` con su rótulo, todo en el mismo canvas. `GRID_LINE_COLOR` es constante: se elimina la lectura de `--grid-line` con `getComputedStyle`.

7. **Pausa.** `pause()` guarda `prevPhase` y detiene la actualización; `resume()` restaura la fase y pone `lastTime = null` para no arrastrar un `dt` gigante ni `dropAccum` acumulado. `P` y `Escape` alternan la pausa desde el listener del juego.

8. **Fin de partida.** Cuando `spawn()` colisiona al aparecer, `phase = "gameover"`, el canvas dibuja el overlay `GAME OVER` durante `GAME_OVER_DELAY` (~1.2 s) y al agotarse se invoca `onGameOver(score)` una sola vez, con guard. `end()` (botón FIN) entra por el mismo camino. `restart()` reinicia tablero, `score`, `lines`, `level` y `dropInterval`.

9. **Canvas responsive.** `measure()` con `getBoundingClientRect()`, `applyResize()` fijando `canvas.width/height = cssSize * devicePixelRatio` y `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`, disparado por un `ResizeObserver` sobre el canvas. Recalcula `w`, `h`, `block`, `boardX`, `boardY` y redibuja. Sin reposicionar nada.

10. **Publicación de estado.** Emitir `onState` cada `STATE_INTERVAL` (0.1 s) más emisión inmediata al cambiar `phase`, `level` o `lines`, con `{ score, level, lines, phase, tripleShot: 0 }` y sin `lives`.

11. **`destroy()` idempotente.** Flag `destroyed`, `cancelAnimationFrame`, `observer.disconnect()` y `removeEventListener` del teclado. Verificado con React Strict Mode en dev.

12. **Registry.** Añadir la línea `caida` a `GAME_REGISTRY` en `lib/games/registry.ts`. A partir de aquí `/game/caida/play` monta el juego real en vez del simulador.

13. **HUD.** En `components/GamePlayer.tsx`, condicionar el `hud-stat.lives` a `lives !== undefined` y añadir el `hud-stat.lines` (`LÍNEAS`) condicionado a `lines !== undefined`. En `app/globals.css`, la regla del nuevo `hud-stat.lines` siguiendo las CSS vars existentes.

14. **Migración.** Aplicar `enable_game_caida` con `mcp__supabase__apply_migration` (`update ... playable = true` + `delete from scores where game_id = 'caida'`) y verificar con `mcp__supabase__execute_sql`: `playable = true` en `caida`, `count(*) = 9` en `games`, `count(*) = 0` en sus `scores`. Sin regenerar tipos: el schema no cambia.

15. **Verificación.** `npm run lint` y `npm run build` sin errores. Prueba manual en `npm run dev`: jugar `/game/caida/play` (mover, rotar contra la pared, soft y hard drop, limpiar una línea y un tetris, subir de nivel a las 10 líneas), pausar con botón, `P` y `Escape`, perder → overlay + modal → guardar puntaje → verlo en `/hall-of-fame` y en `/game/caida`, `JUGAR DE NUEVO`, `SALIR` y volver a entrar, redimensionar durante la partida, y comprobar que `/game/asteroides/play` sigue igual y que los mocks siguen con el simulador.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] `lib/games/tetris/` no tiene variables de módulo mutables: dos instancias del juego pueden coexistir sin interferirse.
- [ ] `lib/games/asteroids/` no se modifica y Asteroides sigue publicando `lives` y `tripleShot`.
- [ ] `/game/caida/play` monta un `<canvas>` dentro del CRT y la pieza responde a `←`/`→` (mover), `↑` o `X` (rotar), `↓` (soft drop) y `Espacio` (hard drop).
- [ ] El tablero se dibuja 10×20 ocupando la altura completa del CRT, con la rejilla, el marco y el panel `NEXT` a su derecha, todo en el mismo canvas (no hay segundo `<canvas>`).
- [ ] La ghost piece se dibuja translúcida en la posición de aterrizaje y sigue a la pieza al moverla y rotarla.
- [ ] Rotar pegado a la pared desplaza la pieza (wall kick) en vez de descartar el giro.
- [ ] Completar una línea la elimina y suma `100 × nivel`; un tetris (4 líneas) suma `800 × nivel`.
- [ ] A las 10 líneas el nivel sube a 2 y la caída se acelera de forma perceptible.
- [ ] Las 8 piezas aparecen en el juego, incluida la tuerca `N` (anillo 3×3 gris con hueco).
- [ ] El HUD muestra `PUNTUACIÓN`, `NIVEL` y `LÍNEAS` con los valores del juego (no del simulador falso) y se actualizan al limpiar líneas y al hacer soft/hard drop.
- [ ] El HUD **no** muestra el stat de vidas en `/game/caida/play`, y **sí** lo muestra en `/game/asteroides/play` y en los juegos mock.
- [ ] `PAUSA` congela la partida y `REANUDAR` continúa sin que la pieza salte una fila de golpe (sin `dt` ni `dropAccum` acumulados); `P` y `Escape` alternan igual que el botón.
- [ ] `FIN` termina la partida y abre el modal con el puntaje actual.
- [ ] Cuando una pieza nueva no cabe al aparecer, el canvas muestra el overlay `GAME OVER` y después aparece el modal de la plataforma; `onGameOver` se invoca una sola vez.
- [ ] Guardar en el modal hace `POST /api/scores` con `gameId: "caida"` y devuelve el puesto obtenido.
- [ ] `JUGAR DE NUEVO` reinicia una partida limpia: tablero vacío, puntuación 0, 0 líneas, nivel 1 y velocidad inicial.
- [ ] `select playable from games where id = 'caida'` devuelve `true` y `select count(*) from games` sigue devolviendo 9.
- [ ] `select count(*) from scores where game_id = 'caida'` devuelve 0 antes de la primera partida real.
- [ ] La pestaña `CAÍDA` del Hall of Fame muestra su estado vacío sin romper, y tras guardar una partida muestra ese puntaje; `/game/caida` muestra la misma tabla.
- [ ] `caida` aparece en Home y en Biblioteca con la portada `cover-tetro`, el título `CAÍDA` y sus textos originales, ahora marcada como jugable.
- [ ] Redimensionar la ventana durante la partida mantiene la relación del tablero, recoloca el panel `NEXT` y no deja celdas fuera del área.
- [ ] El canvas se ve nítido con `devicePixelRatio > 1`.
- [ ] Las flechas y `Espacio` no scrollean la página mientras el juego está montado, y vuelven a hacerlo al salir de la ruta; el input de iniciales del modal sigue aceptando texto.
- [ ] `SALIR` o navegar fuera detiene el loop y quita listeners y `ResizeObserver`; volver a entrar no duplica el loop ni acelera la caída (verificado en dev con React Strict Mode).
- [ ] `/game/asteroides/play` funciona igual que antes del spec y los demás ids siguen mostrando el simulador falso sin cambios.
- [ ] En viewport pequeño se muestra el aviso `.keyboard-notice`.

## Decisiones tomadas y descartadas

- **Reusar la fila `caida` en vez de crear una `tetris` nueva.** Decisión explícita del usuario. Se descarta la fila nueva porque repetiría la deuda que dejó el spec 05 con `rocas` y `asteroides`: dos juegos gemelos en la biblioteca, uno real y uno falso. `caida` ya tiene categoría, portada, color y textos correctos para un Tetris. Costo: la ruta pública es `/game/caida`, no `/game/tetris`.

- **El título sigue siendo `CAÍDA`, no `TETRIS`.** Decisión explícita del usuario. Se descarta renombrar porque el `id` no cambia y dejaría la URL desalineada del nombre visible.

- **Se borran los 12 puntajes sembrados de `caida`.** Decisión explícita del usuario. Se descarta conservarlos porque los juegos reales solo acumulan partidas reales; mantener puestos inventados por encima de los de un jugador real vacía de sentido el leaderboard. Costo: la pestaña del Hall of Fame arranca vacía.

- **Se porta la pieza `N` (tuerca).** Decisión explícita del usuario. Se descarta reducir el juego a las 7 piezas estándar: la fuente es la que es, y la tuerca es su rasgo propio. Costo aceptado: sale 1 de cada 8 veces, tiene un hueco interior imposible de rellenar desde arriba y hace las líneas notablemente más difíciles que en un Tetris clásico.

- **`lines` como campo opcional nuevo del `GameState`, y `lives` vuelto opcional.** Se descarta reetiquetar el hueco de `lives` como líneas: sería un HUD que miente sobre lo que muestra y ataría el reproductor a un juego concreto. Se descarta también publicar `lives: 0` y ocultar el stat cuando vale 0, porque eso lo ocultaría en Asteroides justo al morir. La ausencia del campo (`undefined`) es la señal correcta. Costo: `lives` deja de ser obligatorio y el compilador ya no avisa si un juego futuro se olvida de publicarlo.

- **Letterbox con el hueco lateral aprovechado para el panel `NEXT`.** Decisión explícita del usuario. Se descarta rediseñar el tablero a más columnas para llenar el 4:3, porque a esa altura ya no es Tetris. Se descarta también una relación de aspecto propia para esta ruta, porque tocaría `.crt-screen`, que comparten todos los juegos. El hueco deja de ser franja negra y `BLOCK` pasa de 30 px fijos a `h / ROWS`.

- **Un solo canvas.** Se descarta mantener el `#next-canvas` del original: el contrato `GameMountOptions` entrega un único `canvas` y añadir un segundo obligaría a cambiar el contrato y el reproductor para un detalle decorativo.

- **`P` y `Escape` alternan pausa.** Decisión explícita del usuario. El original solo tenía `P`; se añade `Escape` por paridad con Asteroides y con el botón `PAUSA` del HUD.

- **Overlay `GAME OVER` en canvas + modal de la plataforma.** Mismo patrón que Asteroides. Se descartan el `#overlay` HTML del original y su botón `REINICIAR`: habría dos formas de reiniciar compitiendo con `JUGAR DE NUEVO` del modal.

- **Sin reescalado de posiciones al redimensionar.** Decisión explícita del usuario. El tablero vive en coordenadas de celda, así que basta recalcular `block` y los offsets. Se descarta el reescalado proporcional que necesita Asteroides — aquí no aporta nada y añadiría un camino de error.

- **Se portan los 8 colores pastel del original tal cual.** Decisión explícita del usuario. Se descarta repintar con la paleta neón del vault: es una fase de diseño propia, y el spec 05 ya sentó el precedente de respetar la estética de la fuente.

- **`GRID_LINE_COLOR` como constante.** Se descarta seguir leyendo `--grid-line` con `getComputedStyle(document.body)`: esa var pertenece al `style.css` de la fuente, no existe en `app/globals.css`, y forzaría un acceso al DOM desde la lógica del juego.

- **Randomizer `Math.random()` por pieza, sin 7-bag ni SRS.** Se descarta modernizar la mecánica: cambiaría el balance del juego portado y convertiría un portado en un rediseño. Costo: son posibles rachas largas de la misma pieza.

- **Migración por `update`, no por `insert`.** La fila ya existe desde el seed del spec 06. Se descarta borrarla y reinsertarla porque el `on delete cascade` de `scores` y el `sort_order` quedarían expuestos a un error innecesario.

## Riesgos identificados

| Riesgo                                                                                                                                                                                                                                 | Mitigación                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`lives` opcional debilita el contrato.** Un juego futuro puede olvidarse de publicarlo y el compilador no avisa: el HUD simplemente no muestra el stat y parece un bug del juego, no del contrato.                                   | Documentar el campo en `types.ts` con el comentario de por qué es opcional. Criterio de aceptación explícito de que Asteroides sigue mostrando vidas.                                                                         |
| **La pieza `N` puede hacer el juego frustrante.** Un anillo 3×3 con hueco interior deja un agujero irrellenable cada vez que aterriza; con 1/8 de probabilidad, las partidas largas se vuelven improbables.                            | Riesgo residual aceptado — decisión explícita del usuario. Si en la prueba manual el juego resulta injugable, la salida es bajar su probabilidad o retirarla en un spec posterior, no improvisarlo durante la implementación. |
| **`block = h / ROWS` en CRT pequeño deja celdas de pocos píxeles.** En un CRT de 300 px de alto la celda mide 15 px y el panel `NEXT` queda ilegible.                                                                                  | El rótulo y la pieza del panel se dimensionan en múltiplos de `block`, no en px fijos, así que escalan con el tablero. Verificar la legibilidad en el redimensionado del paso 15.                                             |
| **React Strict Mode monta dos veces en dev.** Si `destroy()` no cancela el `rAF`, el listener de teclado y el `ResizeObserver`, quedan dos loops: la pieza baja al doble de velocidad y una sola pulsación mueve dos veces.            | Paso 11 del plan y criterio de aceptación propio sobre Strict Mode.                                                                                                                                                           |
| **`preventDefault` global secuestra el teclado.** `Espacio` y las flechas están en `BLOCKED_KEYS`; si el listener sobrevive a la ruta o captura el foco del input de iniciales, no se puede escribir el nombre ni scrollear.           | El bypass para `INPUT`/`TEXTAREA`/contentEditable ya existe en `GamePlayer.tsx` y no se toca. Criterio de aceptación sobre el input del modal y sobre el scroll al salir de la ruta.                                          |
| **Pausa mal implementada salta una fila.** Si `resume()` no resetea `lastTime` **y** `dropAccum`, el primer frame tras la pausa trae el tiempo acumulado y la pieza baja de golpe — peor que en Asteroides, donde solo teletransporta. | Paso 7 del plan lo trata explícitamente y hay criterio de aceptación sobre ello.                                                                                                                                              |
| **El `delete` de puntajes es irreversible.** Los 12 puntajes sembrados de `caida` no están en ninguna migración versionada del repo: una vez borrados, restaurarlos exige regenerarlos a mano.                                         | Son datos sembrados sin valor, documentados en el spec 06. Riesgo residual aceptado.                                                                                                                                          |
| **`clearLines` con `splice` + `unshift` dentro del bucle.** El original compensa el índice con `r++` tras eliminar una fila; portarlo mal rompe la eliminación de líneas múltiples y hace que un tetris cuente como una línea.         | Criterio de aceptación que verifica explícitamente el tetris de 4 líneas y su puntuación.                                                                                                                                     |

## Qué **no** está en este spec

- Controles táctiles para móvil.
- Botón de tema claro/oscuro y su `localStorage`.
- Sonido.
- Repintado con la paleta neón del vault.
- SRS completo, 7-bag, hold, lock delay y T-spins.
- Portar Arkanoid.
- Retirar el mock `rocas` ni consolidar juegos duplicados.
- Tests automatizados.

Cada uno de ellos, si entra, va en su propio spec.
