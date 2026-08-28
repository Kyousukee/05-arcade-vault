# Spec jam travesía peligrosa — AGUJAS jugable

**Estado:** borrador
**Depende de:** 05-asteroides-jugable, 06-juegos-y-leaderboard
**Fecha:** 2026-08-27

**Objetivo:** Crear un juego de travesía indirecta en TypeScript bajo el contrato `GameFactory`, en el que el jugador **no controla al viajero** sino los desvíos de la red por la que avanza, esquivando vagonetas patrulla y entregando cápsulas antes de que expire el reloj de la oleada, y darlo de alta como `agujas` en el registry, en la tabla `games` y en el leaderboard.

> Nota de contexto: jam del tema **«travesía peligrosa: cruzar obstáculos en movimiento contra reloj»**. Es la tercera lectura del tema y la única que invierte el punto de vista: en Ranaria y en Garfio el jugador **es** quien cruza; aquí el jugador es la torre de control y lo que cruza avanza solo, sin frenos. La tensión no está en los reflejos del avatar sino en decidir qué aguja conmutar antes de que sea tarde. Este spec entrega el juego mínimo jugable; `02-agujas-extension.md` (misma carpeta) añade compuertas, tramos de velocidad, destinos por color y presión de tráfico.

## Alcance

**Incluye:**

- **Juego nuevo en TypeScript** en `lib/games/agujas/`, sin globals de módulo:
  - `constants.ts` — `LOGICAL_W = 800`, `LOGICAL_H = 600`, `HEADER_H = 80`, `COLS = 10`, `ROWS = 8`, `CELL = 65` (rejilla de 650×520 centrada bajo el header), `CAPSULE_SPEED = 130` (px lógicos/s), `PATROL_SPEED = 110`, `WAVE_TIME = 45` (s), `SPAWN_GAP = 3.5` (s entre cápsulas), `START_LIVES = 3`, `SWITCH_COOLDOWN_MS = 120`, `COMBO_MAX = 5`, `DEATH_FLASH = 350` (ms), `GAME_OVER_DELAY = 1200`, `STATE_INTERVAL = 0.1`.
  - `network.ts` — la red como grafo de celdas tipadas (`straight`, `curve`, `switch`, `entry`, `exit`, `empty`) y las **plantillas de oleada** (`WAVE_TEMPLATES`): 6 disposiciones fijas que se recorren cíclicamente, cada una con sus agujas numeradas, sus patrullas y su número de cápsulas.
  - `entities.ts` — `Capsule` (viajero que avanza solo por la vía), `Patrol` (vagoneta que recorre un circuito cerrado en bucle) y el dibujo de la red, las agujas y sus números.
  - `game.ts` — `createAgujasGame(opts)`: estado en un objeto `runtime` local a la factory, loop `requestAnimationFrame`, listeners de teclado, `ResizeObserver` y `destroy()` idempotente.
- **Área lógica fija 800×600** con el patrón de los specs 08 y 09: el canvas llena el CRT y el contexto aplica `ctx.setTransform(dpr * cssW / 800, 0, 0, dpr * cssH / 600, 0, 0)`. El resize solo recalcula ese transform; la rejilla nunca cambia.
- **Rejilla fija** de 10×8 celdas de 65 px, centrada horizontalmente (`x` de 75 a 725) y colocada bajo la franja `HEADER_H` (`y` de 80 a 600). Cada celda tiene un tipo y una orientación; la vía se dibuja como línea de neón por el centro de las celdas conectadas.
- **Cápsulas:** entran por la celda `entry` del borde izquierdo cada `SPAWN_GAP` segundos y avanzan a `CAPSULE_SPEED` constante siguiendo la vía. **No se pueden parar, frenar ni girar directamente.** Al llegar a una celda `switch`, toman la salida que esa aguja tenga seleccionada en ese instante.
- **Agujas:** entre 3 y 6 por plantilla, numeradas del 1 al 6 y dibujadas con su número en grande sobre la celda. Cada una tiene dos salidas posibles; pulsar su número conmuta entre ellas con un `SWITCH_COOLDOWN_MS` de gracia visual. **Conmutar una aguja con una cápsula encima no la afecta**: la ruta de una cápsula se decide en el instante en que entra en la celda.
- **Patrullas:** vagonetas que recorren un circuito cerrado de la red en bucle determinista a `PATROL_SPEED`, atravesando las agujas sin conmutarlas. Si una patrulla y una cápsula ocupan la misma celda → **colisión**: ambas desaparecen, se pierde una vida y el combo baja a 1.
- **Salidas:** la celda `exit` del borde derecho. Una cápsula que la alcanza se entrega: `+100 × combo`, y el combo sube en 1 hasta `COMBO_MAX`.
- **Vías muertas:** una cápsula que llega a una celda sin continuación descarrila: se pierde una vida y el combo baja a 1. Es el castigo por dejar una aguja mal puesta.
- **Reloj de oleada:** `WAVE_TIME = 45 s` por oleada, dibujado como barra en la franja `HEADER_H` del canvas junto a `SCORE`, `NIVEL`, combo y corazones. **No se publica en `GameState`.** Al llegar a 0, las cápsulas aún en ruta se pierden (una vida en total, no una por cápsula) y arranca la oleada siguiente.
- **Cierre de oleada:** entregar todas las cápsulas de la plantilla antes del reloj cierra la oleada anticipadamente: `+25 × floor(timeLeft)` de bonus, `level += 1` y siguiente plantilla con `PATROL_SPEED` un 10 % mayor y una patrulla más a partir de la oleada 3.
- **Vidas:** `START_LIVES = 3`, publicadas en `lives?`.
- **Controles: solo teclado.** Teclas `1`–`6` conmutan la aguja de ese número (las teclas sobrantes no hacen nada si la plantilla tiene menos agujas). `P` y `Escape` alternan pausa. Sin ratón en este spec.
- **Dibujo con formas y color**, sin assets: red como líneas cian con nodos, agujas resaltadas en amarillo con su número y una flecha que indica la salida activa, cápsulas como cápsulas verdes con estela corta, patrullas como rombos magenta, entrada y salida como arcos etiquetados.
- **Fin de partida:** `DEATH_FLASH` de 350 ms sobre la colisión; al agotar la última vida, overlay `GAME OVER` en canvas ~1,2 s y un único `onGameOver(score)`.
- **`restart()`** reconstruye el `runtime` inicial: plantilla 0, `score = 0`, `level = 1`, `lives = 3`, combo 1, reloj a 45 y agujas en su posición por defecto.
- **Entrada `agujas`** en `GAME_REGISTRY` (`lib/games/registry.ts`) con `import()` dinámico.
- **Portada nueva `cover-agujas`** en `app/globals.css`, en la línea de las existentes (CSS puro sobre pseudo-elementos): fondo oscuro con una vía amarilla que se bifurca en dos y un punto verde sobre el tronco común.
- **Migración `add_game_agujas`** con el `insert` completo y `sort_order = 10`.
- **Verificación:** `npm run lint`, `npm run build` y prueba manual del recorrido completo en navegador.

**NO incluye (fuera de este spec):**

- Todo lo del `02-agujas-extension.md`: compuertas temporizadas, tramos de aceleración y frenado, cápsulas con destino de color y varias salidas, patrullas que cambian de circuito y el modo de presión con solapamiento de oleadas.
- Cambios en `lib/games/types.ts` ni en `components/GamePlayer.tsx`: Agujas no necesita ningún campo nuevo.
- Control directo sobre las cápsulas (frenar, acelerar, invertir): el juego se define por su ausencia.
- Input de ratón o táctil sobre las agujas; solo teclas numéricas, con el aviso `.keyboard-notice` que ya existe.
- Redes generadas por procedimiento o editor de niveles: las 6 plantillas son fijas y están escritas a mano en `network.ts`.
- Assets en `public/games/agujas/` y audio.
- High-score local en `localStorage` y tests automatizados.
- Los demás juegos no jugables del catálogo (`gloton`, `invasores`, `rocas`, `duelo-pixel`), que siguen con el simulador falso.

**Consecuencias aceptadas de este scope:**

- Con 6 plantillas fijas, a partir de la séptima oleada el trazado se repite y la dificultad la aporta solo la velocidad de las patrullas y su número.
- Solo teclado numérico: en un portátil sin teclado numérico dedicado las teclas de la fila superior sirven igual, pero el juego es inaccesible en móvil (como el resto del vault).
- Que conmutar una aguja no afecte a la cápsula que ya está encima puede leerse como un fallo la primera vez; es la regla que hace el juego justo y se comunica visualmente con el resaltado de la celda ocupada.
- El ritmo es más pausado que el de Ranaria o Garfio: la partida dura 2–5 min por acumulación de oleadas, no por intensidad continua.
- Un jugador experto puede encadenar combos altos desde la primera oleada, así que el rango de puntajes es amplio desde el principio.

## Modelo de datos

Este spec no crea tablas nuevas ni extiende el contrato: reusa `public.games` y `public.scores` del spec 06 e inserta una fila. Define el estado interno del juego y la mecánica completa, por ser un juego diseñado desde cero.

### Mapeo al `GameState`

| Campo `GameState` | Origen en Agujas                                                    |
| ----------------- | ------------------------------------------------------------------- |
| `score`           | `runtime.score` — entregas × combo y bonus de cierre de oleada      |
| `level`           | `runtime.level` — número de oleada, empezando en 1                  |
| `lives`           | `runtime.lives` — 3 iniciales                                       |
| `phase`           | `runtime.phase`                                                     |
| `lines`           | **no se publica**                                                   |
| `fruits`          | **no se publica**                                                   |
| `tripleShot`      | `0` fijo (campo obligatorio del contrato, específico de Asteroides) |

Ni el reloj de oleada, ni el combo, ni las cápsulas pendientes viajan en `GameState`: se dibujan en la franja `HEADER_H` del canvas. Agujas **no toca `lib/games/types.ts`**.

### La red — `lib/games/agujas/network.ts`

```ts
export type CellKind = "empty" | "straight" | "curve" | "switch" | "entry" | "exit";
export type Side = "N" | "E" | "S" | "W";

export interface CellDef {
  kind: CellKind;
  /** Lados conectados. `straight` y `curve` tienen 2; `switch` tiene 3 (1 entrada, 2 salidas). */
  sides: Side[];
  /** Solo `switch`: número 1–6 que lo conmuta desde el teclado. */
  switchId?: number;
  /** Solo `switch`: índice dentro de `sides` de la salida activa por defecto. */
  defaultExit?: number;
}

export interface PatrolDef {
  /** Circuito cerrado como lista de celdas (col,row) consecutivas y conectadas. */
  loop: { col: number; row: number }[];
  offset: number; // posición inicial dentro del circuito, 0…1
}

export interface WaveTemplate {
  cells: CellDef[][]; // ROWS × COLS
  patrols: PatrolDef[];
  capsules: number; // cápsulas de la oleada
}

export const WAVE_TEMPLATES: WaveTemplate[] = [/* 6 plantillas escritas a mano */];
```

Las 6 plantillas van de menos a más: la primera tiene 3 agujas, 1 patrulla y 4 cápsulas; la sexta tiene 6 agujas, 3 patrullas y 8 cápsulas. A partir de la oleada 7 se reciclan cíclicamente (`WAVE_TEMPLATES[(level - 1) % 6]`) con la velocidad de patrulla escalada.

### Estado interno — `lib/games/agujas/game.ts`

No se exporta. Todo vive en el espacio lógico 800×600; `cssW` / `cssH` solo alimentan el transform del canvas y nunca entran en la lógica.

```ts
interface Traveller {
  col: number; // celda actual
  row: number;
  from: Side; // lado por el que entró en la celda
  to: Side; // lado por el que saldrá (fijado al entrar)
  t: number; // progreso dentro de la celda, 0…1
}

interface Capsule extends Traveller {
  id: number;
}

interface Patrol extends Traveller {
  loopIndex: number; // posición dentro de PatrolDef.loop
}

interface SwitchState {
  switchId: number;
  col: number;
  row: number;
  exitIndex: number; // índice dentro de CellDef.sides de la salida activa
  flashMs: number; // ms de resaltado tras conmutar
}

interface AgujasRuntime {
  template: WaveTemplate; // plantilla de la oleada en curso
  switches: SwitchState[]; // estado vivo de las agujas
  capsules: Capsule[];
  patrols: Patrol[];
  spawnTimer: number; // s hasta la próxima cápsula
  spawned: number; // cápsulas ya emitidas en la oleada
  delivered: number; // cápsulas entregadas en la oleada
  combo: number; // 1…COMBO_MAX
  patrolSpeed: number; // PATROL_SPEED escalado por nivel
  timeLeft: number; // s, de WAVE_TIME a 0
  score: number;
  level: number; // = número de oleada
  lives: number;
  phase: GamePhase;
  prevPhase: GamePhase; // fase previa a la pausa
  deathFlash: number; // ms restantes de parpadeo, 0 si no aplica
  flashAt: { col: number; row: number } | null; // celda de la última colisión
  gameOverTimer: number; // ms de overlay antes de onGameOver
  stateAccum: number; // acumulador de la emisión de onState
  lastTime: number | null; // null tras resume() para no arrastrar dt
  cssW: number;
  cssH: number;
}
```

### Mecánica (juego diseñado desde cero)

- **Avance:** cada viajero (cápsula o patrulla) tiene una celda, un lado de entrada, un lado de salida y un progreso `t` que crece con `speed * dt / CELL`. Su posición en pantalla se interpola por el centro de la celda: en `straight` es una recta entre los dos lados, en `curve` un arco de cuarto de círculo.
- **Cambio de celda:** al llegar `t >= 1`, el viajero pasa a la celda vecina por el lado `to`, entra por el lado opuesto y **fija su nuevo `to` en ese instante**:
  - `straight` y `curve`: el otro lado de `sides`.
  - `switch`: el lado indicado por `exitIndex` de la aguja en ese momento. Conmutar después no lo cambia.
  - `exit`: entrega.
  - `empty` o lado sin conexión: descarrilamiento.
- **Conmutar:** `keydown` de `1`–`6` busca la aguja con ese `switchId` en `runtime.switches` y alterna `exitIndex` entre las dos salidas, con `flashMs` de resaltado. No hay coste, no hay límite de conmutaciones y no afecta a los viajeros ya dentro de la celda.
- **Colisión:** tras mover a todos los viajeros, se comparan las celdas ocupadas. Si una cápsula y una patrulla comparten `(col, row)` → colisión: ambas se eliminan, `lives -= 1`, `combo = 1`, `deathFlash = 350`, `flashAt` en esa celda.
- **Descarrilamiento:** cápsula sin continuación → se elimina, `lives -= 1`, `combo = 1`, `deathFlash = 350`.
- **Entrega:** cápsula en `exit` → `score += 100 * combo`, `combo = min(COMBO_MAX, combo + 1)`, `delivered += 1`.
- **Spawn:** cada `SPAWN_GAP` segundos entra una cápsula por `entry`, hasta agotar `template.capsules`.
- **Cierre de oleada:** cuando `delivered + perdidas === template.capsules` **y** no queda ninguna cápsula en la red → `score += 25 * floor(timeLeft)` si `timeLeft > 0`, `level += 1`, plantilla siguiente, `patrolSpeed *= 1.1`, `timeLeft = WAVE_TIME`, combo **se conserva** entre oleadas.
- **Reloj a 0:** las cápsulas aún en la red se pierden, `lives -= 1` (una sola vez, no una por cápsula), `combo = 1` y arranca la oleada siguiente sin bonus.
- **Muerte:** `lives === 0` → overlay `GAME OVER` durante `GAME_OVER_DELAY` y un único `onGameOver(score)`.
- **Victoria:** no hay. Las oleadas son infinitas; la partida termina por vidas agotadas o por el botón `FIN`.

### Marcador dibujado en canvas — franja `y ∈ [0, 80)`

`SCORE`, `OLEADA`, `COMBO ×N`, cápsulas entregadas / totales de la oleada y corazones de vida, más una **barra de tiempo de oleada** de 800×10 px en `y = 70` que se vacía de derecha a izquierda (verde > 15 s, amarilla 15–5 s, magenta parpadeante < 5 s).

### Registry — `lib/games/registry.ts`

```ts
agujas: async () => (await import("./agujas/game")).createAgujasGame,
```

### Portada — `app/globals.css`

Clase nueva junto a las existentes (`cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`, `cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo`), en CSS puro sobre pseudo-elementos, sin imágenes:

```css
.cover-agujas {
  background: linear-gradient(180deg, #1a1600, #0a0a18);
}
.cover-agujas::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(var(--yellow), var(--yellow)) 0 50%/52% 3px no-repeat,
    linear-gradient(28deg, transparent 48%, var(--yellow) 48% 51%, transparent 51%) 52% 20%/48% 30%
      no-repeat,
    linear-gradient(-28deg, transparent 48%, var(--yellow) 48% 51%, transparent 51%) 52% 50%/48% 30%
      no-repeat,
    radial-gradient(circle at 24% 50%, var(--green) 0 6px, transparent 7px);
  filter: drop-shadow(0 0 7px rgba(245, 255, 0, 0.45));
}
```

### Fila en `games` — migración `add_game_agujas`

`agujas` no existe hoy en `public.games` (las 9 filas actuales son `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `asteroides`, `ranaria`, `duelo-pixel`, con `sort_order` 0–8). Se inserta detrás de `garfio`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order)
values ('agujas', 'AGUJAS', 'No conduces: decides por dónde pasan.', 'Desde la torre de control ves llegar las cápsulas por la red de vías. No puedes pararlas ni desviarlas a mano: solo conmutar las agujas antes de que lleguen. Las vagonetas patrullan sus circuitos sin avisar y el reloj de la oleada no espera a nadie.', 'PUZZLE', 'cover-agujas', 'yellow', true, 10);
```

Sin filas en `scores`: el juego arranca vacío y solo acumula partidas reales. Tras esta migración y la de `garfio`, `select count(*) from games` devuelve 11.

## Plan de implementación

Cada paso deja el repo compilando (`npm run build` verde). El juego no aparece como jugable hasta el paso 11.

1. **Consultar la doc vendored.** Repasar en `node_modules/next/dist/docs/` lo relativo a componentes cliente e `import()` dinámico antes de escribir código.
2. **Constantes.** `lib/games/agujas/constants.ts` con la geometría de la rejilla, las velocidades, los tiempos de oleada y los umbrales del alcance.
3. **Red y plantillas.** `lib/games/agujas/network.ts` con `CellKind`, `CellDef`, `PatrolDef`, `WaveTemplate` y las 6 plantillas escritas a mano, de 3 agujas / 1 patrulla / 4 cápsulas a 6 agujas / 3 patrullas / 8 cápsulas. Verificar a mano que cada plantilla tiene camino de `entry` a `exit` para **toda** combinación de agujas o que la combinación sin salida es un descarrilamiento deliberado y alcanzable.
4. **Dibujo de la red.** `lib/games/agujas/entities.ts`: trazado de `straight`, `curve`, `switch` (con su número y la flecha de salida activa), `entry` y `exit`. En este paso ya se ve el tablero estático.
5. **Factory y avance.** `lib/games/agujas/game.ts` — `createAgujasGame(opts)`: objeto `runtime` local, loop `requestAnimationFrame` con `dt` capado a 0,05 s, orden `update → draw → publishState`. Movimiento de un viajero por la red con interpolación recta y en arco. Jugable a mano, aún no registrado.
6. **Cápsulas y patrullas.** Spawn por `SPAWN_GAP`, patrullas recorriendo su `loop` en bucle, y el paso por `switch` leyendo `exitIndex` en el instante de entrada.
7. **Conmutación.** Listener de teclado atado a la instancia: `1`–`6` alternan la aguja correspondiente con su `flashMs`. Verificar que una cápsula ya dentro de la celda no cambia de rumbo.
8. **Colisiones y entregas.** Comparación de celdas ocupadas, colisión cápsula-patrulla, descarrilamiento, entrega en `exit`, combo y puntuación.
9. **Oleadas y reloj.** `timeLeft`, cierre anticipado con bonus, paso a la plantilla siguiente, escalado de `patrolSpeed`, pérdida de vida al agotarse el reloj y recálculo de `level`.
10. **Vidas y fin.** `deathFlash` con `flashAt`, `lives`, camino único a `GAME OVER` con guard de un solo `onGameOver`. `end()` entra por el mismo camino. `restart()` reconstruye el `runtime` inicial.
11. **Canvas responsive.** `measure()` con `getBoundingClientRect()`, `applyResize()` que fija `canvas.width/height = cssSize * devicePixelRatio` y aplica `ctx.setTransform(dpr * cssW / 800, 0, 0, dpr * cssH / 600, 0, 0)`, disparado por un `ResizeObserver`. La rejilla no se recalcula: solo el transform.
12. **`onState` y limpieza.** Emisión cada `STATE_INTERVAL` (0,1 s) más emisión inmediata al cambiar `phase`, `level` o `lives`. `destroy()` idempotente: flag `destroyed`, `cancelAnimationFrame`, `observer.disconnect()` y `removeEventListener`.
13. **Registry y portada.** Añadir la línea `agujas` a `GAME_REGISTRY` y la clase `.cover-agujas` a `app/globals.css`.
14. **Migración.** Aplicar `add_game_agujas` con `mcp__supabase__apply_migration`. Verificar con `mcp__supabase__execute_sql`: la fila nueva con `playable = true` y `sort_order = 10`, `count(*) = 0` en sus `scores`, y `mcp__supabase__get_advisors` sin hallazgos nuevos. No hace falta regenerar `lib/supabase/database.types.ts`: un `insert` no cambia el schema.
15. **Verificación.** `npm run lint`, `npm run build` y prueba manual: conmutar agujas con las teclas, entregar cápsulas encadenando combo, provocar una colisión con una patrulla, provocar un descarrilamiento dejando una aguja mal puesta, dejar expirar el reloj, cerrar una oleada anticipadamente y cobrar el bonus, pausar con botón y con teclas, redimensionar en partida, guardar el puntaje en el modal y volver a entrar a la ruta comprobando que el loop no se duplica en dev.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] `lib/games/agujas/` no tiene variables de módulo mutables ni escribe en `window`: dos instancias del juego coexisten sin interferirse.
- [ ] `/game/agujas/play` monta un `<canvas>` dentro del CRT y muestra la red con las agujas numeradas y su salida activa señalada.
- [ ] Las cápsulas entran por la izquierda cada ~3,5 s y avanzan solas: ninguna tecla las frena, las acelera ni las gira.
- [ ] Pulsar `1`–`6` conmuta la aguja de ese número y el cambio se ve al instante en la flecha de salida activa; las teclas sin aguja asignada no hacen nada.
- [ ] Conmutar una aguja mientras una cápsula está dentro de esa celda **no** cambia el rumbo de esa cápsula, y la celda ocupada se resalta para explicarlo.
- [ ] Una cápsula que llega a la salida suma `100 × combo` y sube el combo en 1 hasta un máximo de 5.
- [ ] Una cápsula que llega a una celda sin continuación descarrila, resta una vida y pone el combo a 1.
- [ ] Una cápsula y una patrulla en la misma celda colisionan: ambas desaparecen, se resta una vida y el combo baja a 1.
- [ ] Las patrullas recorren su circuito en bucle sin conmutar ninguna aguja y sin salirse de él.
- [ ] La barra de tiempo de la oleada se vacía durante la partida, se congela en `PAUSA` y al llegar a 0 se pierden las cápsulas en ruta, se resta **una sola** vida y empieza la oleada siguiente.
- [ ] Entregar todas las cápsulas de la oleada antes del reloj suma `25 × floor(timeLeft)`, sube `NIVEL` en 1 y carga la plantilla siguiente con patrullas visiblemente más rápidas.
- [ ] A partir de la oleada 7 las plantillas se repiten cíclicamente y las patrullas siguen acelerando.
- [ ] El HUD muestra Puntuación, Vidas y Nivel con los valores del juego (no del simulador falso), y **no** muestra los stats de líneas ni de frutas.
- [ ] `GameState` publicado por Agujas no incluye ningún campo que no exista hoy en `lib/games/types.ts`; ni `types.ts` ni `components/GamePlayer.tsx` han sido modificados por este spec.
- [ ] `PAUSA` congela cápsulas, patrullas y reloj, y `REANUDAR` continúa sin salto de posición (sin `dt` acumulado); `P` y `Escape` alternan igual que el botón.
- [ ] `FIN` termina la partida y abre el modal con el puntaje actual.
- [ ] Agotar la tercera vida muestra el parpadeo (~350 ms) en la celda del incidente, el overlay `GAME OVER` en canvas (~1,2 s) y después el modal, con un solo `onGameOver`.
- [ ] `JUGAR DE NUEVO` reinicia en la plantilla 0 con `score` 0, `NIVEL` 1, 3 vidas, combo 1, reloj a 45 s y las agujas en su posición por defecto.
- [ ] Guardar en el modal hace `POST /api/scores` y devuelve el puesto obtenido.
- [ ] La fila `agujas` de `games` tiene `playable = true`, `cat = 'PUZZLE'`, `cover = 'cover-agujas'`, `color = 'yellow'` y `sort_order = 10`, y `select count(*) from scores where game_id = 'agujas'` devuelve 0 antes de la primera partida.
- [ ] Agujas aparece en Home, Biblioteca y `/game/agujas` con su portada `cover-agujas` renderizada (no un rectángulo vacío), y su pestaña del Hall of Fame muestra el estado vacío sin romper.
- [ ] Redimensionar durante la partida mantiene la relación 4:3, no deforma la rejilla y no altera la posición lógica de cápsulas ni patrullas.
- [ ] El canvas se ve nítido con `devicePixelRatio > 1`.
- [ ] Las teclas numéricas no scrollean ni disparan atajos durante la partida, y el input de iniciales del modal sigue aceptando texto y números.
- [ ] `SALIR` o navegar fuera detiene el loop y quita listeners y `ResizeObserver`; volver a entrar no lo duplica (verificado en dev con React Strict Mode).
- [ ] Asteroides, Caída, Bloque Buster y Serpentina siguen funcionando igual.

## Decisiones tomadas y descartadas

- **El jugador no controla al viajero.** Es la decisión que define el juego y lo separa de los otros dos del jam. Se descarta dar control directo sobre la cápsula (sería Ranaria con otra piel) y se descarta poder frenarla o pararla: el freno convierte cualquier red en trivial, porque siempre se puede esperar a que pase la patrulla.
- **La ruta se fija al entrar en la celda de la aguja, no al salir.** Se descarta que conmutar afecte a la cápsula que ya está encima: produce cambios de rumbo a mitad de curva, imposibles de dibujar con sentido y de anticipar. Coste aceptado: la primera vez se lee como un fallo, y se mitiga resaltando la celda ocupada.
- **Teclas numéricas `1`–`6`, sin ratón.** Se descarta el clic sobre la aguja: sería el primer input de puntero de la plataforma, con su `getBoundingClientRect`, su DPR y su `pointer: coarse`, y añade un riesgo entero a un juego que no lo necesita. Se descarta también seleccionar la aguja con flechas y confirmar: dos pulsaciones donde bastaba una, en un juego contrarreloj.
- **Máximo 6 agujas por plantilla.** Se descartan las redes con 8 o 10 desvíos: exceden las teclas cómodas de una mano y convierten el juego en memorizar un teclado, no en leer la red.
- **Seis plantillas fijas escritas a mano, recicladas cíclicamente.** Se descarta la generación por procedimiento: una red generada puede ser irresoluble o trivial, y validarla exige un solucionador entero — esfuerzo propio de un juego L. Coste: el trazado se repite a partir de la oleada 7.
- **Combo hasta ×5 que se conserva entre oleadas.** Se descarta el multiplicador sin techo (puntuaciones explosivas, incomparables) y se descarta reiniciar el combo en cada oleada, que anularía el incentivo de encadenar la partida entera.
- **Reloj por oleada, no por partida ni por cápsula.** Se descarta el reloj global: haría que perder tiempo en la oleada 1 arruinara la 10, sin poder recuperarlo. El reloj por oleada da a cada travesía su propia presión, que es lo que pide el tema.
- **Expirar el reloj cuesta una sola vida, no una por cápsula pendiente.** Se descarta el castigo proporcional: con 8 cápsulas en ruta acabaría la partida de golpe y haría el fallo incomprensible.
- **Descarrilamiento como castigo por vía muerta.** Se descarta hacer que la cápsula rebote o se detenga en la vía muerta: eliminaría la consecuencia de dejar una aguja mal puesta, que es el error que el juego enseña a no cometer.
- **Patrullas en circuito cerrado y determinista, sin IA.** Se descarta la persecución: convertiría el juego en un maze-chase (el hueco que ya cubre `gloton` en la cola de sugerencias) y haría el resultado dependiente del pathfinding en vez de la planificación.
- **Área lógica fija 800×600 con rejilla de 65 px.** Se descarta recalcular la rejilla al redimensionar: cambiaría la escala de tiempo de la travesía en mitad de la oleada. Mismo patrón que los specs 08 y 09.
- **Agujas no toca `GameState`.** Se descartan campos opcionales para combo, tiempo o cápsulas pendientes: los tres se dibujan en el canvas. Es también lo que permite implementar este spec y el de Ranaria del mismo jam sin conflicto de merge.
- **`cat = PUZZLE`.** Se descarta `ARCADE`: la mecánica es de planificación bajo presión, no de reflejos, y PUZZLE solo tiene `caida`.
- **Dibujo con formas, sin assets.** No hay sprites en el repo para este juego y el spec no inventa archivos.
- **Sin audio.** El vault no tiene control de mute (fuera de scope desde el spec 08).

## Riesgos identificados

- **El canvas responsive altera el balance calibrado en píxeles.** `CAPSULE_SPEED` y `PATROL_SPEED` están en px lógicos/s sobre una celda de 65 px. Mitigación: toda la lógica vive en el espacio lógico fijo y el escalado es un puro `setTransform`; criterio de aceptación explícito.
- **El reescalado al redimensionar puede dejar entidades en estado inválido.** Un viajero a mitad de celda mantiene `col`, `row`, `from`, `to` y `t`. Mitigación: `applyResize()` solo recalcula el transform y `cssW`/`cssH`; ningún viajero lee esos valores.
- **React Strict Mode monta dos veces en dev.** Dos loops emitirían cápsulas al doble y vaciarían el reloj en la mitad de tiempo. Mitigación: `destroy()` idempotente con flag `destroyed` que cancela `rAF`, desconecta el `ResizeObserver` y quita el `keydown`; criterio de aceptación propio.
- **El `preventDefault` global secuestra el teclado.** Las teclas `1`–`6` **no** están en `BLOCKED_KEYS` de `components/GamePlayer.tsx`, así que no hay bloqueo que quitar; el riesgo es el inverso — si la implementación las añadiera, el input de iniciales dejaría de aceptar números. Mitigación: no tocar `BLOCKED_KEYS` y verificar el modal en la prueba manual.
- **La detección de colisión por celda puede fallar con `dt` grande.** Si en un frame la cápsula y la patrulla se cruzan dentro de la misma celda y salen antes de la comparación, la colisión se pierde. Mitigación: `dt` capado a 0,05 s (a 130 px/s son 6,5 px, un 10 % de celda) y comparación de celdas **después** de mover a todos; además, comparar también el par (celda de origen intercambiada) para el cruce frontal.
- **Una plantilla mal diseñada puede ser irresoluble.** Con 6 agujas hay 64 combinaciones y una red puede no tener camino en ninguna. Mitigación: paso 3 del plan — validación manual de cada plantilla, y criterio de aceptación de que las 6 se juegan hasta el final al menos una vez.
- **La ambigüedad del arco en las celdas `curve` puede desalinear el dibujo.** Un cuarto de círculo mal orientado hace que el viajero salte visualmente al cambiar de celda. Mitigación: la posición se deriva siempre de `from`, `to` y `t`, nunca se acumula; el salto sería inmediatamente visible en la prueba manual.
- **El ritmo puede resultar demasiado lento.** Con 4 cápsulas cada 3,5 s, la oleada 1 deja mucho tiempo muerto. Mitigación: `SPAWN_GAP` y `WAVE_TIME` son constantes en `constants.ts`, ajustables en la prueba manual; el 02 añade solapamiento de oleadas.
- **`sort_order = 10` asume que `garfio` (mismo jam) entra antes con el 9.** Si se implementa Agujas primero, habría un hueco en el orden pero no un conflicto (`sort_order` no es único). Mitigación: al implementar el segundo juego del jam, tomar el siguiente valor libre y verificar el orden en Biblioteca.

## Qué **no** está en este spec

- Compuertas temporizadas, tramos de aceleración y frenado, cápsulas con destino de color y varias salidas, patrullas que cambian de circuito y el modo de presión con oleadas solapadas: todo eso es `02-agujas-extension.md`.
- Cualquier cambio en `lib/games/types.ts`, en `components/GamePlayer.tsx`, en `POST /api/scores`, en `lib/queries.ts` o en el schema de Supabase más allá del `insert` de la fila `agujas`.
- Los otros dos juegos del jam (`ranaria` y `garfio`), cada uno con su carpeta en `specs/game-jam/`.
- Audio, controles táctiles o de ratón, redes generadas por procedimiento, editor de niveles, dificultad seleccionable, persistencia local y tests automatizados.
