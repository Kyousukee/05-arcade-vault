# Spec jam TÚNEL NEÓN — TÚNEL FASE (variante con twist) jugable

**Estado:** borrador
**Depende de:** 05-asteroides-jugable, 06-juegos-y-leaderboard
**Fecha:** 2026-08-31

**Objetivo:** Crear un esquivador radial en TypeScript bajo el contrato `GameFactory`, en el que el jugador **no dispara**: solo gira alrededor de la boca del mismo túnel de neón para colarse por el hueco abierto de cada compuerta que llega desde el fondo, encadenando combo sin fallar un carril, y darlo de alta como `tunel-fase` en el registry, en la tabla `games` y en el leaderboard.

> Nota de contexto: elegido al azar de la tabla «🟡 Sugeridos» de `references/game-suggestion.-todo.md` (candidato #14, TÚNEL NEÓN, SHOOTER). Este es el **twist** del jam: mismo túnel radial de 8 carriles y la misma proyección `(lane, depth)` que `01-tunel-neon-jugable.md`, pero invirtiendo la premisa — de "dispara antes de que te alcancen" a "no puedes disparar, solo elegir bien el hueco". Es un juego independiente con su propio `id`, su propia fila en `games` y su propia entrada en el registry; **no depende** del spec `01` para jugarse ni comparte código con él (cada uno tiene su propia carpeta en `lib/games/`, con su propia copia de la proyección radial).

## Alcance

**Incluye:**

- **Juego nuevo en TypeScript** en `lib/games/tunel-fase/`, sin globals de módulo:
  - `constants.ts` — `LOGICAL_W = 800`, `LOGICAL_H = 600`, `CENTER = { x: 400, y: 300 }`, `LANES = 8`, `ANGLE_STEP = (Math.PI * 2) / 8`, `RING_RADIUS_NEAR = 220`, `RING_RADIUS_FAR = 20`, `ROTATE_INTERVAL_MS = 130`, `GATE_SPEED_BASE = 0.28` (profundidad/s), `GATE_SPEED_STEP = 0.09` (+9 %/nivel), `GATE_GAP_BASE = 1.6` (s entre compuertas), `GATE_GAP_MIN = 0.8`, `OPEN_LANES_START = 3`, `OPEN_LANES_MIN = 1`, `NARROW_EVERY_LEVELS = 3` (cada 3 niveles se cierra un carril más, hasta el mínimo), `LEVEL_UP_SCORE = 250`, `START_LIVES = 3`, `COMBO_MAX = 8`, `HIT_FLASH_MS = 300`, `GAME_OVER_DELAY = 1200`, `STATE_INTERVAL = 0.1`.
  - `projection.ts` — copia local (sin import cruzado con `lib/games/tunel-neon/`) de `depthToRadius(depth)`, `laneAngle(lane)` y `polarToPoint(lane, depth)`, idénticas en fórmula a las de la variante clásica pero **archivo propio**: los dos juegos deben poder evolucionar por separado sin acoplarse.
  - `entities.ts` — `Gate` (anillo con un subconjunto de carriles abiertos que avanza en profundidad decreciente) y su `update(dt)` / `draw(ctx)`: el anillo cerrado en rojo, los huecos abiertos en verde.
  - `game.ts` — `createTunelFaseGame(opts)`: estado en un objeto `runtime` local a la factory, loop `requestAnimationFrame`, listeners de teclado, `ResizeObserver` y `destroy()` idempotente.
- **Área lógica fija 800×600**, mismo patrón que los specs 08, 09, `agujas` y `01-tunel-neon-jugable`: el canvas llena el CRT y el contexto aplica `ctx.setTransform(dpr * cssW / 800, 0, 0, dpr * cssH / 600, 0, 0)`. El resize solo recalcula ese transform; la proyección radial no cambia.
- **El túnel:** mismo fondo visual que la variante clásica (anillos concéntricos y radios en cian/magenta con opacidad decreciente), sin jugador que dispare.
- **Jugador:** una nave triangular fija sobre el anillo `RING_RADIUS_NEAR`, en el carril `runtime.playerLane` (0–7). `←`/`→` (o `A`/`D`) mueven un carril por pulsación, con `ROTATE_INTERVAL_MS` de repetición si se mantiene pulsada. **No hay tecla de disparo**: `Space` no hace nada en este juego.
- **Compuertas:** anillos completos que aparecen en profundidad 1 con un subconjunto de carriles "abiertos" (el resto, "cerrados") y avanzan hacia profundidad 0 a `GATE_SPEED_BASE` escalada por nivel. El número de carriles abiertos empieza en `OPEN_LANES_START = 3` y se reduce en 1 cada `NARROW_EVERY_LEVELS` niveles hasta el piso `OPEN_LANES_MIN = 1`; los carriles abiertos de cada compuerta se sortean uniformemente entre los 8.
- **Resolución al llegar la compuerta:** cuando una compuerta alcanza profundidad ≤ 0:
  - Si `playerLane` está entre sus carriles abiertos → **paso limpio**: `score += 10 × combo`, `combo = min(COMBO_MAX, combo + 1)`.
  - Si no → **choque**: `lives--`, `combo = 1`, `HIT_FLASH_MS` de parpadeo.
  - En ambos casos la compuerta se elimina; solo puede resolverse una vez.
- **Progresión:** el `score` acumulado dispara `level++` cada `LEVEL_UP_SCORE` puntos, sin techo. Cada nivel, `GATE_SPEED_BASE` sube `GATE_SPEED_STEP` (acumulativo, aplicada a las nuevas compuertas) y el intervalo entre compuertas baja hasta `GATE_GAP_MIN`; cada `NARROW_EVERY_LEVELS` niveles se resta 1 al número de carriles abiertos hasta `OPEN_LANES_MIN`.
- **Vidas:** `START_LIVES = 3`, publicadas en `lives?`.
- **Controles: solo teclado.** `←`/`→`/`A`/`D` para rotar, `P`/`Escape` para pausar. Sin disparo, sin ratón ni táctil en este spec.
- **Dibujo con formas y color**, sin assets: túnel en cian con anillos y radios (idéntico al de la variante clásica), compuertas dibujadas como un anillo grueso en rojo con arcos verdes brillantes en los carriles abiertos, jugador como triángulo magenta, combo mostrado como una franja de brillo creciente alrededor del triángulo del jugador (puramente decorativa, no forma parte del `GameState`).
- **Fin de partida:** `HIT_FLASH_MS` de parpadeo sobre el choque; al agotar la última vida, overlay `GAME OVER` en canvas ~1.2 s y un único `onGameOver(score)`.
- **`restart()`** reconstruye el `runtime` inicial: `score = 0`, `level = 1`, `lives = 3`, `combo = 1`, carril central (`playerLane = 0`), sin compuertas en vuelo.
- **Entrada `tunel-fase`** en `GAME_REGISTRY` (`lib/games/registry.ts`) con `import()` dinámico.
- **Portada nueva `cover-tunel-fase`** en `app/globals.css`, en la línea de las existentes (CSS puro sobre pseudo-elementos): mismo fondo de anillos concéntricos que `cover-tunel-neon` pero en cian con un arco verde destacado, para distinguir el twist a simple vista sin repetir la portada.
- **Migración `add_game_tunel_fase`** con el `insert` completo y `sort_order = 12`.
- **Verificación:** `npm run lint`, `npm run build` y prueba manual del recorrido completo en navegador.

**NO incluye (fuera de este spec):**

- La variante `tunel-neon` de `01-tunel-neon-jugable.md`: es otro juego, con otro `id`, otra fila en `games` y otra entrada en el registry. Este spec no reutiliza su código.
- Cualquier forma de disparo, ataque o daño a las compuertas: el twist es que **no se puede** interactuar con ellas más allá de elegir el carril.
- Compuertas con más de un anillo de huecos, compuertas móviles (que roten mientras avanzan) o compuertas que exijan más de un carril simultáneo.
- Cambios en `lib/games/types.ts` ni en `components/GamePlayer.tsx`: Túnel Fase no necesita ningún campo nuevo (el combo se dibuja en canvas, no viaja en `GameState`).
- Input de ratón o táctil; solo teclado, con el aviso `.keyboard-notice` que ya existe.
- Assets en `public/games/tunel-fase/` y audio.
- High-score local en `localStorage` y tests automatizados.
- Los demás juegos no jugables del catálogo (`gloton`, `invasores`, `rocas`, `duelo-pixel`, y las specs sin implementar `agujas`/`garfio`), que siguen con el simulador falso.

**Consecuencias aceptadas de este scope:**

- Al no poder atacar, el único margen de error del jugador es la anticipación: si dos compuertas llegan muy seguidas a distintos carriles, puede no dar tiempo a reposicionarse, y es intencional — es la presión que define el twist.
- El combo se resetea a 1 en cada choque, así que una partida con varios errores tempranos tiene un techo de puntuación bajo comparado con una racha limpia; es lo que hace el ranking sensible a la constancia, no solo a la duración.
- Sin ratón ni táctil, el juego es inaccesible en móvil, como el resto del vault hasta que pase por `@mobile-porter`.
- Compartir la geometría del túnel con la variante clásica (mismo `LANES`, mismo `RING_RADIUS_NEAR/FAR`) sin compartir código hace que un futuro cambio visual del túnel deba aplicarse dos veces si se quiere consistencia; es el coste aceptado de mantener los dos juegos totalmente independientes.

## Modelo de datos

Este spec no crea tablas nuevas ni extiende el contrato: reusa `public.games` y `public.scores` del spec 06 e inserta una fila nueva, distinta de la de `tunel-neon`. Define el estado interno del juego, la proyección radial (copia local) y la mecánica completa.

### Mapeo al `GameState`

| Campo `GameState` | Origen en Túnel Fase                                                |
| ----------------- | ------------------------------------------------------------------- |
| `score`           | `runtime.score` — `10 × combo` por cada paso limpio                 |
| `level`           | `runtime.level` — sube cada `LEVEL_UP_SCORE` puntos, sin techo      |
| `lives`           | `runtime.lives` — 3 iniciales                                       |
| `phase`           | `runtime.phase`                                                     |
| `lines`           | **no se publica**                                                   |
| `fruits`          | **no se publica**                                                   |
| `tripleShot`      | `0` fijo (campo obligatorio del contrato, específico de Asteroides) |

El combo **no viaja en `GameState`**: se dibuja como brillo alrededor del jugador en el canvas. Túnel Fase **no toca `lib/games/types.ts`**.

### Proyección radial — `lib/games/tunel-fase/projection.ts`

```ts
export function depthToRadius(depth: number): number {
  return RING_RADIUS_NEAR + (RING_RADIUS_FAR - RING_RADIUS_NEAR) * clamp01(depth);
}

export function laneAngle(lane: number): number {
  return lane * ANGLE_STEP - Math.PI / 2;
}

export function polarToPoint(lane: number, depth: number): { x: number; y: number } {
  const r = depthToRadius(depth);
  const a = laneAngle(lane);
  return { x: CENTER.x + Math.cos(a) * r, y: CENTER.y + Math.sin(a) * r };
}
```

Mismas fórmulas que `01-tunel-neon-jugable.md`, en un módulo propio de `lib/games/tunel-fase/`: los dos juegos no comparten import para poder divergir sin coordinación entre specs.

### Estado interno — `lib/games/tunel-fase/game.ts`

No se exporta. Todo el juego vive en el espacio lógico de `(lane, depth)`; `cssW` / `cssH` solo alimentan el transform del canvas y nunca entran en la lógica.

```ts
interface Gate {
  id: number;
  depth: number; // 1 (aparición) → 0 (boca del túnel)
  speed: number; // profundidad/s, escalada por nivel
  openLanes: Set<number>; // carriles abiertos (0–7)
  resolved: boolean; // guard: solo se resuelve una vez
}

interface TunelFaseRuntime {
  playerLane: number; // 0–7
  rotateAccum: number; // ms desde el último cambio de carril, para ROTATE_INTERVAL_MS
  keys: { left: boolean; right: boolean };
  gates: Gate[];
  nextId: number; // contador incremental para ids de compuertas
  spawnTimer: number; // s hasta la próxima compuerta
  gateSpeed: number; // GATE_SPEED_BASE escalada por nivel
  gateGap: number; // GATE_GAP_BASE escalado por nivel, con piso GATE_GAP_MIN
  openLanesCount: number; // OPEN_LANES_START escalado a la baja por nivel
  combo: number; // 1…COMBO_MAX
  score: number;
  level: number;
  lives: number;
  phase: GamePhase;
  prevPhase: GamePhase; // fase previa a la pausa
  hitFlash: number; // ms restantes de parpadeo, 0 si no aplica
  gameOverTimer: number; // ms de overlay antes de onGameOver
  stateAccum: number; // acumulador de la emisión de onState
  lastTime: number | null; // null tras resume() para no arrastrar dt
  cssW: number;
  cssH: number;
}
```

### Mecánica (juego diseñado desde cero)

- **Rotación:** idéntica a `01-tunel-neon-jugable.md` — `keydown` de `←`/`→`/`A`/`D` marca `keys.left`/`keys.right`; en `update(dt)`, si la tecla sigue pulsada y `rotateAccum >= ROTATE_INTERVAL_MS`, `playerLane = (playerLane ± 1 + LANES) % LANES` y se reinicia `rotateAccum`.
- **Aparición de compuertas:** cada `spawnTimer` segundos (que arranca en `GATE_GAP_BASE` y decrece con el nivel hasta `GATE_GAP_MIN`) se crea una `Gate` en profundidad 1, con `openLanesCount` carriles abiertos sorteados uniformemente sin repetición entre los 8.
- **Avance:** `gate.depth -= gate.speed * dt` para cada compuerta no resuelta.
- **Resolución:** cuando `gate.depth <= 0` y `!gate.resolved`:
  - `openLanes.has(playerLane)` → `score += 10 * combo`, `combo = min(COMBO_MAX, combo + 1)`.
  - si no → `lives--`, `combo = 1`, `hitFlash = HIT_FLASH_MS`.
  - `gate.resolved = true` y se elimina en el mismo frame (no se dibuja una compuerta ya resuelta).
- **Progresión de nivel:** cuando `score` cruza el siguiente múltiplo de `LEVEL_UP_SCORE`, `level++`; `gateSpeed` sube `GATE_SPEED_STEP` (acumulativo), `gateGap` decrece proporcionalmente hasta `GATE_GAP_MIN`, y cada `NARROW_EVERY_LEVELS` niveles `openLanesCount` baja en 1 hasta el piso `OPEN_LANES_MIN`. A diferencia de la variante clásica, aquí **no hay bonus fijo** al subir de nivel: la recompensa ya está en mantener el combo, y añadir un bonus aparte duplicaría el mismo incentivo con otro nombre.
- **Muerte:** `lives === 0` → overlay `GAME OVER` durante `GAME_OVER_DELAY` y un único `onGameOver(score)`.
- **Victoria:** no hay. La progresión es infinita; la partida termina por vidas agotadas o por el botón `FIN`.

### Registry — `lib/games/registry.ts`

```ts
"tunel-fase": async () => (await import("./tunel-fase/game")).createTunelFaseGame,
```

### Portada — `app/globals.css`

Clase nueva junto a las existentes (incluida `cover-tunel-neon` del spec `01`), en CSS puro sobre pseudo-elementos, sin imágenes:

```css
.cover-tunel-fase {
  background: radial-gradient(circle at 50% 50%, #001a1a, #05000a 70%);
}
.cover-tunel-fase::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 50%, transparent 8%, var(--cyan) 9% 10%, transparent 11%),
    radial-gradient(circle at 50% 50%, transparent 22%, var(--cyan) 23% 24%, transparent 25%),
    conic-gradient(
      from 0deg at 50% 50%,
      transparent 0 300deg,
      var(--green) 300deg 340deg,
      transparent 340deg 360deg
    );
  opacity: 0.65;
  filter: drop-shadow(0 0 6px rgba(0, 255, 220, 0.4));
}
```

### Fila en `games` — migración `add_game_tunel_fase`

`tunel-fase` no existe hoy en `public.games`. Asumiendo que `01-tunel-neon-jugable.md` se implementa primero y toma `sort_order = 11`, este spec toma el siguiente libre:

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order)
values ('tunel-fase', 'TÚNEL FASE', 'No disparas: eliges bien el hueco.', 'El mismo túnel de neón, sin cañón. Las compuertas llegan desde el fondo con un solo hueco abierto entre ocho carriles y solo tienes tiempo de girar, nunca de frenar. Encadena pasos limpios para disparar el combo; un carril equivocado lo tira todo a uno.', 'ARCADE', 'cover-tunel-fase', 'cyan', true, 12);
```

Sin filas en `scores`: el juego arranca vacío y solo acumula partidas reales.

## Plan de implementación

Cada paso deja el repo compilando (`npm run build` verde). El juego no aparece como jugable hasta el paso 10.

1. **Consultar la doc vendored.** Repasar en `node_modules/next/dist/docs/` lo relativo a componentes cliente e `import()` dinámico antes de escribir código. No hay convención nueva: el reproductor ya existe.
2. **Constantes.** `lib/games/tunel-fase/constants.ts` con la geometría radial, las velocidades de compuerta, los tiempos de aparición y los umbrales de estrechamiento y de progresión.
3. **Proyección.** `lib/games/tunel-fase/projection.ts` con `depthToRadius`, `laneAngle` y `polarToPoint` (copia local, sin import de `lib/games/tunel-neon/`). Verificar a mano los mismos dos casos de borde que en el spec `01`.
4. **Dibujo del túnel.** En `lib/games/tunel-fase/game.ts`, la función de fondo: mismos anillos y radios que la variante clásica. En este paso ya se ve el túnel estático.
5. **Compuertas.** `lib/games/tunel-fase/entities.ts`: `Gate` con su `update(dt)` (avance en profundidad) y `draw(ctx)` (anillo grueso rojo con arcos verdes en los carriles abiertos, usando `polarToPoint` para ubicar cada arco).
6. **Factory y jugador.** `createTunelFaseGame(opts)`: objeto `runtime` local, loop `requestAnimationFrame` con `dt` capado a 0.05 s, orden `update → draw → publishState`. Dibujo del triángulo del jugador en `playerLane`. Jugable a mano moviendo el carril, aún no registrado.
7. **Rotación, aparición y resolución.** Listener de teclado atado a la instancia: `←`/`→`/`A`/`D` con `ROTATE_INTERVAL_MS` de repetición (`Space` no hace nada); `P`/`Escape` alternan pausa guardando `prevPhase` y poniendo `lastTime = null` al reanudar. Spawn de compuertas por `spawnTimer`, avance y resolución al llegar a profundidad 0 (paso limpio o choque), con el guard `resolved`.
8. **Progresión de nivel.** Recalcular `level`, escalar `gateSpeed`, reducir `gateGap` hasta `GATE_GAP_MIN` y `openLanesCount` hasta `OPEN_LANES_MIN` cada `NARROW_EVERY_LEVELS` niveles.
9. **Vidas, combo y fin.** `hitFlash`, `combo`, `lives`, camino único a `GAME OVER` con guard de un solo `onGameOver`. `end()` (botón FIN) entra por el mismo camino. `restart()` reconstruye el `runtime` inicial.
10. **Canvas responsive.** `measure()` con `getBoundingClientRect()`, `applyResize()` que fija `canvas.width/height = cssSize * devicePixelRatio` y aplica `ctx.setTransform(dpr * cssW / 800, 0, 0, dpr * cssH / 600, 0, 0)`, disparado por un `ResizeObserver`. La proyección no se recalcula: solo el transform.
11. **`onState` y limpieza.** Emisión cada `STATE_INTERVAL` (0.1 s) más emisión inmediata al cambiar `phase`, `level` o `lives`. `destroy()` idempotente: flag `destroyed`, `cancelAnimationFrame`, `observer.disconnect()` y `removeEventListener`.
12. **Registry y portada.** Añadir la línea `"tunel-fase"` a `GAME_REGISTRY` y la clase `.cover-tunel-fase` a `app/globals.css`.
13. **Migración.** Aplicar `add_game_tunel_fase` con `mcp__supabase__apply_migration`. Verificar con `mcp__supabase__execute_sql`: la fila nueva con `playable = true` y el `sort_order` libre real (ajustar al valor que corresponda si `01-tunel-neon-jugable` u otros specs pendientes ya tomaron el 11 y el 12), `count(*) = 0` en sus `scores`, y `mcp__supabase__get_advisors` sin hallazgos nuevos. No hace falta regenerar `lib/supabase/database.types.ts`: un `insert` no cambia el schema.
14. **Verificación.** `npm run lint`, `npm run build` y prueba manual: rotar por los 8 carriles, pasar limpio por una compuerta y ver crecer el combo, chocar contra un carril cerrado y ver el combo reiniciarse a 1, subir de nivel y notar que las compuertas llegan más rápido y con menos huecos, comprobar que `Space` no hace nada, pausar con botón y con teclas, redimensionar en partida, agotar las 3 vidas, guardar el puntaje en el modal y volver a entrar a la ruta comprobando que el loop no se duplica en dev.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] `lib/games/tunel-fase/` no tiene variables de módulo mutables ni escribe en `window`: dos instancias del juego coexisten sin interferirse.
- [ ] `lib/games/tunel-fase/` no importa nada de `lib/games/tunel-neon/`: son juegos independientes, aunque compartan la misma fórmula de proyección.
- [ ] `/game/tunel-fase/play` monta un `<canvas>` dentro del CRT y muestra el túnel con sus anillos y radios.
- [ ] `←`/`→` y `A`/`D` mueven al jugador un carril por pulsación y repiten cada `ROTATE_INTERVAL_MS` si se mantienen pulsadas; el índice hace wrap entre 0 y 7.
- [ ] `Space` no dispara nada ni produce ningún efecto visible: no hay tecla de ataque en este juego.
- [ ] Una compuerta que llega con el jugador en uno de sus carriles abiertos suma `10 × combo` al `score` y sube el combo en 1, hasta un máximo de 8.
- [ ] Una compuerta que llega con el jugador en un carril cerrado resta una vida, reinicia el combo a 1 y dispara el parpadeo de impacto.
- [ ] Cada compuerta se resuelve una sola vez: no es posible sumar puntos ni perder una vida dos veces por la misma compuerta.
- [ ] El número de carriles abiertos por compuerta empieza en 3 y baja en 1 cada `NARROW_EVERY_LEVELS` niveles, sin bajar de 1.
- [ ] Cada `LEVEL_UP_SCORE` puntos, `NIVEL` sube en 1 y las compuertas llegan visiblemente más rápido y más seguidas, sin ningún bonus fijo de puntuación al subir (a diferencia de `tunel-neon`).
- [ ] El HUD muestra Puntuación, Vidas y Nivel con los valores del juego (no del simulador falso), y **no** muestra los stats de líneas ni de frutas; el combo se ve en el canvas, no en el HUD React.
- [ ] `GameState` publicado por Túnel Fase no incluye ningún campo que no exista hoy en `lib/games/types.ts`; ni `types.ts` ni `components/GamePlayer.tsx` han sido modificados por este spec.
- [ ] `PAUSA` congela las compuertas, y `REANUDAR` continúa sin salto de posición (sin `dt` acumulado); `P` y `Escape` alternan igual que el botón.
- [ ] `FIN` termina la partida y abre el modal con el puntaje actual.
- [ ] Agotar la tercera vida muestra el parpadeo (~300 ms), el overlay `GAME OVER` en canvas (~1.2 s) y después el modal, con un solo `onGameOver`.
- [ ] `JUGAR DE NUEVO` reinicia con `score` 0, `NIVEL` 1, 3 vidas, combo 1, carril central, sin compuertas en vuelo.
- [ ] Guardar en el modal hace `POST /api/scores` con `gameId: "tunel-fase"` y devuelve el puesto obtenido.
- [ ] La fila `tunel-fase` de `games` tiene `playable = true`, `cat = 'ARCADE'`, `cover = 'cover-tunel-fase'`, `color = 'cyan'`, y `select count(*) from scores where game_id = 'tunel-fase'` devuelve 0 antes de la primera partida.
- [ ] Túnel Fase aparece en Home, Biblioteca y `/game/tunel-fase` con su portada `cover-tunel-fase` renderizada (no un rectángulo vacío, y visualmente distinguible de `cover-tunel-neon`), y su pestaña del Hall of Fame muestra el estado vacío sin romper.
- [ ] Redimensionar durante la partida mantiene la relación 4:3, no deforma el túnel y no altera la posición lógica (carril, profundidad) de ninguna compuerta.
- [ ] El canvas se ve nítido con `devicePixelRatio > 1`.
- [ ] Las flechas no scrollean la página durante la partida, y el input de iniciales del modal sigue aceptando texto.
- [ ] `SALIR` o navegar fuera detiene el loop y quita listeners y `ResizeObserver`; volver a entrar no lo duplica (verificado en dev con React Strict Mode).
- [ ] Asteroides, Caída, Bloque Buster, Serpentina, Ranaria y (si ya está implementado) Túnel Neón siguen funcionando igual.

## Decisiones tomadas y descartadas

- **Sin disparo, sin ataque: el único input es rotar.** Es la decisión que define el twist frente a `01-tunel-neon-jugable.md`. Se descarta cualquier forma de interactuar con la compuerta (empujarla, frenarla, romperla): el juego se define por la ausencia de esa opción, igual que `agujas` se define por que el jugador no controla al viajero.
- **Compuertas de anillo completo con huecos, en vez de obstáculos puntuales por carril.** Se descarta el enfoque de `tunel-neon` (entidades individuales por carril) porque aquí la unidad de decisión es "¿qué carril tiene el hueco?", no "¿qué carril está libre en este instante?" — el anillo comunica de un vistazo el patrón completo antes de que llegue.
- **Cada compuerta se resuelve una sola vez, con guard `resolved`.** Se descarta dejar que una compuerta sin eliminar pueda evaluarse en dos frames consecutivos si `depth` queda exactamente en 0 durante más de un frame: duplicaría el combo o la pérdida de vida por el mismo evento.
- **Sin bonus fijo al subir de nivel** (a diferencia de `tunel-neon`, que sí lo tiene). Se descarta duplicar el incentivo: aquí la recompensa de progresar ya está en el multiplicador de combo, que crece con cada paso limpio: añadir un bonus aparte premiaría dos veces el mismo comportamiento.
- **El número de carriles abiertos baja con el nivel, hasta un piso de 1.** Se descarta bajar hasta 0 (compuerta imposible) y se descarta que nunca baje de 3 (la dificultad se estancaría). El piso de 1 hace que el juego más difícil siga siendo teóricamente superable: siempre hay un carril correcto.
- **Proyección radial duplicada en un módulo propio, sin import cruzado con `tunel-neon`.** Se descarta compartir `lib/games/tunel-neon/projection.ts` entre los dos juegos: acoplaría dos specs independientes a un tercer archivo compartido que ninguno de los dos "posee", complicando qué spec es responsable de mantenerlo. El coste es duplicar ~15 líneas de fórmulas idénticas.
- **Combo dibujado en canvas, no publicado en `GameState`.** Se descarta un campo opcional nuevo (`combo?`): el HUD React ya tiene tres stats suficientes (puntuación, vidas, nivel) y el combo es información de apoyo visual, no un resultado que el leaderboard necesite comparar entre partidas.
- **`cat = ARCADE`, no `SHOOTER`.** Se descarta heredar la categoría de la sugerencia original: sin disparo, clasificarlo como SHOOTER induciría a error. ARCADE encaja mejor con la familia de "reflejos y ritmo" (Serpentina, Garfio) a la que pertenece este twist.
- **Rotación con el mismo `ROTATE_INTERVAL_MS` de orden de magnitud que `tunel-neon` (130 ms frente a 140 ms).** Ligeramente más ágil porque aquí la rotación es la única herramienta del jugador: sin poder disparar para ganar tiempo, el margen de reacción debe compensarse con un giro algo más rápido.
- **Solo teclado, sin ratón ni táctil.** Mismo razonamiento que `01-tunel-neon-jugable.md`: evita el primer input de puntero angular de la plataforma en un juego que ya funciona con teclado discreto.
- **Túnel Fase no toca `GameState`.** Permite implementar este spec y `01-tunel-neon-jugable.md` sin conflicto de merge entre sí, y sin que ninguno dependa de que el otro exista.
- **Dibujo con formas, sin assets, y sin audio.** Mismo criterio que el resto de juegos desde cero del vault: no hay sprites de este juego en el repo y el vault aún no tiene control de mute.

## Riesgos identificados

- **El canvas responsive altera el balance calibrado en píxeles.** Mismo riesgo que en `01-tunel-neon-jugable.md`: `RING_RADIUS_NEAR`/`RING_RADIUS_FAR` en px lógicos sobre un centro fijo. Mitigación: toda la lógica vive en `(lane, depth)` y el escalado es un puro `setTransform`; criterio de aceptación explícito.
- **El reescalado al redimensionar puede dejar entidades en estado inválido.** Como ninguna compuerta guarda `x`/`y` propios (solo `depth` y el `Set` de carriles abiertos), no hay estado que quede inválido tras un resize.
- **React Strict Mode monta dos veces en dev.** Dos loops dispararían el spawn de compuertas al doble de frecuencia y podrían resolver la misma compuerta dos veces si el guard `resolved` no está bien aislado por instancia. Mitigación: `destroy()` idempotente con flag `destroyed`, y `resolved` vive en el objeto `Gate` dentro del `runtime` de cada instancia, nunca en un array compartido.
- **El `preventDefault` global secuestra el teclado.** Las flechas están en `BLOCKED_KEYS` de `components/GamePlayer.tsx`, con su bypass ya existente para formularios. Mitigación: no tocar `BLOCKED_KEYS` y verificar en la prueba manual que el input de iniciales sigue aceptando texto.
- **Con `openLanesCount = 1` en niveles altos, el margen de reacción puede ser extremadamente estrecho** si dos compuertas seguidas exigen carriles opuestos. Mitigación: `GATE_GAP_MIN = 0.8` s deja tiempo para hasta 6 rotaciones de `ROTATE_INTERVAL_MS = 130` ms; si en la prueba manual resulta injugable, se ajusta solo esa constante, sin rediseñar la mecánica.
- **Dos compuertas pueden solaparse visualmente si `spawnTimer` es menor que el tiempo que tarda una compuerta en cruzar el túnel.** A profundidad 1→0 y `GATE_SPEED_BASE` inicial de 0.28/s, una compuerta tarda ~3.6 s en cruzar; con `GATE_GAP_MIN = 0.8` s puede haber hasta 4 compuertas visibles a la vez. Mitigación: es el comportamiento deseado en niveles altos (más presión visual); el `resolved` por compuerta evita que se interfieran en la lógica, solo se superponen en el dibujo.
- **La fórmula de proyección duplicada entre `tunel-neon` y `tunel-fase` puede divergir sin que nadie lo note** si un spec futuro ajusta una y no la otra. Riesgo residual aceptado: es el coste explícito de la decisión de no compartir código entre los dos juegos del jam.
- **`sort_order = 12` asume que `01-tunel-neon-jugable` tomó el 11 y que `garfio`/`agujas` (otro jam, sin implementar) tomaron el 9 y el 10.** Si el orden de implementación cambia, no hay conflicto porque `sort_order` no es único, solo un desorden visual temporal. Mitigación: verificar el valor libre real con `mcp__supabase__execute_sql` antes de aplicar la migración.

## Qué **no** está en este spec

- La variante `tunel-neon` de `01-tunel-neon-jugable.md`: otro juego, otro `id`, otra fila, otra entrada en el registry, otro módulo en `lib/games/`.
- Cualquier forma de disparo o ataque a las compuertas.
- Compuertas con más de un anillo de huecos o compuertas que roten mientras avanzan.
- Cualquier cambio en `lib/games/types.ts`, en `components/GamePlayer.tsx`, en `POST /api/scores`, en `lib/queries.ts` o en el schema de Supabase más allá del `insert` de la fila `tunel-fase`.
- Input de ratón o táctil, controles alternativos, dificultad seleccionable.
- Audio, assets externos, persistencia local y tests automatizados.
