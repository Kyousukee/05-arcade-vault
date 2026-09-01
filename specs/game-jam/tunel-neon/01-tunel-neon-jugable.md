# Spec jam TÚNEL NEÓN — TÚNEL NEÓN (variante clásica) jugable

**Estado:** borrador
**Depende de:** 05-asteroides-jugable, 06-juegos-y-leaderboard
**Fecha:** 2026-08-31

**Objetivo:** Crear un rail-shooter radial en TypeScript bajo el contrato `GameFactory`, en el que el jugador gira alrededor de la boca de un túnel de neón y dispara a los drones y centinelas que trepan desde el fondo por sus carriles, y darlo de alta como `tunel-neon` en el registry, en la tabla `games` y en el leaderboard.

> Nota de contexto: elegido al azar de la tabla «🟡 Sugeridos» de `references/game-suggestion.-todo.md` (candidato #14, TÚNEL NEÓN, SHOOTER). Este spec es la **variante clásica** del jam: dispara y sobrevive. La segunda variante de la misma carpeta, `02-tunel-fase-jugable.md`, es el mismo túnel radial con la mecánica invertida — sin disparo, solo esquiva de compuertas — y es un juego independiente con su propio `id`, su propia fila en `games` y su propia entrada en el registry. Ninguno de los dos depende del otro para jugarse.

## Alcance

**Incluye:**

- **Juego nuevo en TypeScript** en `lib/games/tunel-neon/`, sin globals de módulo:
  - `constants.ts` — `LOGICAL_W = 800`, `LOGICAL_H = 600`, `CENTER = { x: 400, y: 300 }`, `LANES = 8`, `ANGLE_STEP = (Math.PI * 2) / 8`, `RING_RADIUS_NEAR = 220`, `RING_RADIUS_FAR = 20`, `ROTATE_INTERVAL_MS = 140`, `FIRE_COOLDOWN_MS = 220`, `PROJECTILE_SPEED = 1.4` (profundidad/s), `ENEMY_SPEED_BASE = 0.22` (profundidad/s), `ENEMY_SPEED_STEP = 0.08` (+8 %/nivel), `SPAWN_GAP_BASE = 1.1` (s), `SPAWN_GAP_MIN = 0.4`, `LEVEL_UP_SCORE = 300`, `SENTINEL_FROM_LEVEL = 2`, `OBSTACLE_FROM_LEVEL = 3`, `START_LIVES = 3`, `HIT_FLASH_MS = 300`, `GAME_OVER_DELAY = 1200`, `STATE_INTERVAL = 0.1`.
  - `entities.ts` — `Enemy` (dron/centinela que avanza en profundidad decreciente por su carril), `Obstacle` (pilar que solo bloquea, sin puntos), `Projectile` (disparo del jugador en profundidad creciente) y sus funciones `update(dt)` / `draw(ctx, depthToRadius)`.
  - `projection.ts` — `depthToRadius(depth: number): number`, interpolación lineal entre `RING_RADIUS_FAR` (profundidad 1, el fondo del túnel) y `RING_RADIUS_NEAR` (profundidad 0, la boca donde está el jugador), y `laneAngle(lane: number): number`. Toda posición en pantalla de cualquier entidad se deriva de `(lane, depth)` vía estas dos funciones — nunca se guarda `x`/`y` directamente.
  - `game.ts` — `createTunelNeonGame(opts)`: estado en un objeto `runtime` local a la factory, loop `requestAnimationFrame`, listeners de teclado, `ResizeObserver` y `destroy()` idempotente.
- **Área lógica fija 800×600** con el patrón de los specs 08, 09 y `agujas`: el canvas llena el CRT y el contexto aplica `ctx.setTransform(dpr * cssW / 800, 0, 0, dpr * cssH / 600, 0, 0)`. El resize solo recalcula ese transform; la proyección radial no cambia, porque todo se define en `(lane, depth)` sobre el centro lógico fijo `(400, 300)`.
- **El túnel:** 8 anillos concéntricos dibujados con `depthToRadius` en pasos fijos de profundidad (0.1, 0.2, … 1.0), más 8 líneas radiales que marcan el límite de cada carril, todo en cian/magenta con opacidad decreciente hacia el fondo para reforzar la sensación de profundidad.
- **Jugador:** una nave triangular fija sobre el anillo `RING_RADIUS_NEAR`, en el carril `runtime.playerLane` (0–7). `←`/`→` (o `A`/`D`) mueven un carril por pulsación, con `ROTATE_INTERVAL_MS` de repetición si se mantiene pulsada. El jugador nunca cambia de profundidad: solo de carril.
- **Disparo:** `Space` crea un `Projectile` en el carril del jugador con profundidad inicial 0, que avanza hacia el fondo a `PROJECTILE_SPEED`. Se descarta al superar profundidad 1 (fallo) o al alcanzar a un enemigo de su mismo carril (`projectile.depth >= enemy.depth`). Cooldown `FIRE_COOLDOWN_MS` entre disparos.
- **Enemigos:** drones (1 impacto, `10 × nivel` puntos) desde el nivel 1; centinelas (2 impactos, `25 × nivel` puntos) desde `SENTINEL_FROM_LEVEL`. Aparecen en un carril aleatorio con profundidad 1 y avanzan hacia profundidad 0 a `ENEMY_SPEED_BASE` escalada por nivel. Si un enemigo alcanza profundidad ≤ 0 **en el carril del jugador** → `lives--`, `HIT_FLASH_MS` de parpadeo y el enemigo desaparece; si alcanza profundidad ≤ 0 en otro carril, desaparece sin penalizar.
- **Obstáculos:** pilares sin vida ni puntos desde `OBSTACLE_FROM_LEVEL`, mismo movimiento que los enemigos; solo bloquean — alcanzar profundidad ≤ 0 en el carril del jugador también resta una vida.
- **Progresión:** el `score` acumulado dispara `level++` cada `LEVEL_UP_SCORE` puntos, sin techo. Cada nivel: `ENEMY_SPEED_BASE` sube `ENEMY_SPEED_STEP` (acumulativo) y el intervalo de aparición baja hasta `SPAWN_GAP_MIN`. Subir de nivel suma un bonus fijo de `+50` al `score` (el «bonus de nivel» de la sugerencia original).
- **Vidas:** `START_LIVES = 3`, publicadas en `lives?`.
- **Controles: solo teclado.** `←`/`→`/`A`/`D` para rotar, `Space` para disparar, `P`/`Escape` para pausar. Sin ratón ni táctil en este spec.
- **Dibujo con formas y color**, sin assets: túnel en cian con anillos y radios, jugador como triángulo magenta, drones como rombos verdes, centinelas como hexágonos amarillos con doble contorno (2 impactos), obstáculos como rectángulos grises con textura de rayas, disparos como líneas cian cortas que se alargan con la velocidad.
- **Fin de partida:** `HIT_FLASH_MS` de parpadeo sobre el impacto; al agotar la última vida, overlay `GAME OVER` en canvas ~1.2 s y un único `onGameOver(score)`.
- **`restart()`** reconstruye el `runtime` inicial: `score = 0`, `level = 1`, `lives = 3`, carril central (`playerLane = 0`), sin enemigos, obstáculos ni disparos en vuelo.
- **Entrada `tunel-neon`** en `GAME_REGISTRY` (`lib/games/registry.ts`) con `import()` dinámico.
- **Portada nueva `cover-tunel-neon`** en `app/globals.css`, en la línea de las existentes (CSS puro sobre pseudo-elementos): fondo casi negro con anillos concéntricos magenta que se difuminan hacia un punto de fuga cian.
- **Migración `add_game_tunel_neon`** con el `insert` completo y `sort_order = 11`.
- **Verificación:** `npm run lint`, `npm run build` y prueba manual del recorrido completo en navegador.

**NO incluye (fuera de este spec):**

- La variante `tunel-fase` de `02-tunel-fase-jugable.md`: es otro juego, con otro `id`, otra fila en `games` y otra entrada en el registry.
- Cambios en `lib/games/types.ts` ni en `components/GamePlayer.tsx`: Túnel Neón no necesita ningún campo nuevo.
- Jefes de fin de oleada, power-ups (disparo múltiple, escudo temporal), ítems recolectables o combos de puntuación.
- Input de ratón o táctil; solo teclado, con el aviso `.keyboard-notice` que ya existe.
- Rotación continua/analógica del jugador: el movimiento es discreto por carriles, como Tempest.
- Assets en `public/games/tunel-neon/` y audio.
- High-score local en `localStorage` y tests automatizados.
- Los demás juegos no jugables del catálogo (`gloton`, `invasores`, `rocas`, `duelo-pixel`, y las specs sin implementar `agujas`/`garfio`), que siguen con el simulador falso.

**Consecuencias aceptadas de este scope:**

- Sin jefes ni power-ups, la partida es supervivencia pura: la dificultad solo crece por velocidad y densidad de enemigos, nunca por variedad de amenazas nuevas más allá del nivel 3.
- El movimiento discreto de 8 carriles es deliberadamente "duro": no hay posiciones intermedias, así que esquivar exige anticipar el carril correcto con antelación, no deslizarse en el último instante.
- Sin ratón ni táctil, el juego es inaccesible en móvil, como el resto del vault hasta que pase por `@mobile-porter`.
- El bonus de `+50` por nivel hace que subir de nivel siempre convenga, aunque suba también la dificultad: es la tensión de riesgo/recompensa del juego.

## Modelo de datos

Este spec no crea tablas nuevas ni extiende el contrato: reusa `public.games` y `public.scores` del spec 06 e inserta una fila nueva. Define el estado interno del juego, la proyección radial y la mecánica completa, por ser un juego diseñado desde cero.

### Mapeo al `GameState`

| Campo `GameState` | Origen en Túnel Neón                                                |
| ----------------- | ------------------------------------------------------------------- |
| `score`           | `runtime.score` — enemigos destruidos × nivel + bonus de nivel      |
| `level`           | `runtime.level` — sube cada `LEVEL_UP_SCORE` puntos, sin techo      |
| `lives`           | `runtime.lives` — 3 iniciales                                       |
| `phase`           | `runtime.phase`                                                     |
| `lines`           | **no se publica**                                                   |
| `fruits`          | **no se publica**                                                   |
| `tripleShot`      | `0` fijo (campo obligatorio del contrato, específico de Asteroides) |

Túnel Neón **no toca `lib/games/types.ts`**: los tres stats que necesita (puntuación, vidas, nivel) ya existen en el HUD.

### Proyección radial — `lib/games/tunel-neon/projection.ts`

```ts
export function depthToRadius(depth: number): number {
  // depth 0 = boca del túnel (jugador), depth 1 = fondo (punto de fuga)
  return RING_RADIUS_NEAR + (RING_RADIUS_FAR - RING_RADIUS_NEAR) * clamp01(depth);
}

export function laneAngle(lane: number): number {
  return lane * ANGLE_STEP - Math.PI / 2; // carril 0 apunta hacia arriba
}

export function polarToPoint(lane: number, depth: number): { x: number; y: number } {
  const r = depthToRadius(depth);
  const a = laneAngle(lane);
  return { x: CENTER.x + Math.cos(a) * r, y: CENTER.y + Math.sin(a) * r };
}
```

Ninguna entidad guarda `x`/`y` propios: siempre se derivan de `(lane, depth)` en el momento del dibujo. Esto hace el resize trivial — el transform del canvas escala la salida, no la lógica.

### Estado interno — `lib/games/tunel-neon/game.ts`

No se exporta. Todo el juego vive en el espacio lógico de `(lane, depth)`; `cssW` / `cssH` solo alimentan el transform del canvas y nunca entran en la lógica.

```ts
type EnemyKind = "drone" | "sentinel";

interface Enemy {
  id: number;
  lane: number; // 0–7
  depth: number; // 1 (aparición) → 0 (boca del túnel)
  kind: EnemyKind;
  hp: number; // 1 (drone) o 2 (sentinel)
  speed: number; // profundidad/s, escalada por nivel
}

interface Obstacle {
  id: number;
  lane: number;
  depth: number;
  speed: number;
}

interface Projectile {
  id: number;
  lane: number;
  depth: number; // 0 (boca) → 1+ (fondo, se descarta al superarlo)
}

interface TunelNeonRuntime {
  playerLane: number; // 0–7
  rotateAccum: number; // ms desde el último cambio de carril, para ROTATE_INTERVAL_MS
  keys: { left: boolean; right: boolean; fire: boolean };
  fireCooldown: number; // ms restantes hasta poder disparar de nuevo
  enemies: Enemy[];
  obstacles: Obstacle[];
  projectiles: Projectile[];
  nextId: number; // contador incremental para ids de entidades
  spawnTimer: number; // s hasta la próxima aparición
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

- **Rotación:** `keydown` de `←`/`→`/`A`/`D` marca `keys.left`/`keys.right`; en `update(dt)`, si la tecla sigue pulsada y `rotateAccum >= ROTATE_INTERVAL_MS`, `playerLane = (playerLane ± 1 + LANES) % LANES` y se reinicia `rotateAccum`. Un solo `keydown` sin mantener mueve un carril y para.
- **Disparo:** `keydown` de `Space` con `fireCooldown <= 0` crea un `Projectile` en `playerLane`, profundidad 0, y fija `fireCooldown = FIRE_COOLDOWN_MS`. Cada frame `fireCooldown -= dt * 1000`.
- **Avance de enemigos/obstáculos:** `depth -= speed * dt`. Si `depth <= 0`:
  - Si `lane === playerLane` → `lives--`, `hitFlash = HIT_FLASH_MS`, se elimina la entidad.
  - Si no, se elimina sin penalizar (pasó de largo, fuera del carril del jugador).
- **Avance de disparos:** `depth += PROJECTILE_SPEED * dt`. Se elimina si `depth > 1` (falló) o si coincide con un enemigo de su mismo `lane` con `enemy.depth <= projectile.depth`: entonces `enemy.hp--`; si `hp <= 0`, `score += (kind === "drone" ? 10 : 25) * level` y se elimina el enemigo; el disparo se consume siempre en el impacto, acierte o no derribe.
- **Aparición:** cada `spawnTimer` (que arranca en `SPAWN_GAP_BASE` y decrece con el nivel hasta `SPAWN_GAP_MIN`) se crea un enemigo en un carril aleatorio; a partir de `SENTINEL_FROM_LEVEL` hay 30 % de probabilidad de que sea centinela en vez de dron; a partir de `OBSTACLE_FROM_LEVEL` hay además 20 % de probabilidad de que en su lugar aparezca un obstáculo.
- **Progresión de nivel:** cuando `score` cruza el siguiente múltiplo de `LEVEL_UP_SCORE`, `level++`, `score += 50` (bonus), la velocidad base de enemigos/obstáculos sube `ENEMY_SPEED_STEP` (aplicada a las nuevas apariciones, no retroactiva a las que ya están en vuelo) y `spawnTimer` máximo baja proporcionalmente hasta el piso `SPAWN_GAP_MIN`.
- **Muerte:** `lives === 0` → overlay `GAME OVER` durante `GAME_OVER_DELAY` y un único `onGameOver(score)`.
- **Victoria:** no hay. La progresión es infinita; la partida termina por vidas agotadas o por el botón `FIN`.

### Registry — `lib/games/registry.ts`

```ts
"tunel-neon": async () => (await import("./tunel-neon/game")).createTunelNeonGame,
```

### Portada — `app/globals.css`

Clase nueva junto a las existentes (`cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`, `cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo`, `cover-agujas`, `cover-garfio`), en CSS puro sobre pseudo-elementos, sin imágenes:

```css
.cover-tunel-neon {
  background: radial-gradient(circle at 50% 50%, #1a0022, #05000a 70%);
}
.cover-tunel-neon::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 50%, transparent 8%, var(--magenta) 9% 10%, transparent 11%),
    radial-gradient(circle at 50% 50%, transparent 22%, var(--magenta) 23% 24%, transparent 25%),
    radial-gradient(circle at 50% 50%, transparent 40%, var(--cyan) 41% 42%, transparent 43%);
  opacity: 0.6;
  filter: drop-shadow(0 0 6px rgba(255, 0, 200, 0.4));
}
```

### Fila en `games` — migración `add_game_tunel_neon`

`tunel-neon` no existe hoy en `public.games`. Las 9 filas sembradas (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `asteroides`, `ranaria`, `duelo-pixel`) usan `sort_order` 0–8; las specs sin implementar `garfio` y `agujas` (misma carpeta de otro jam) reservan 9 y 10. Se inserta con el siguiente libre:

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order)
values ('tunel-neon', 'TÚNEL NEÓN', 'Gira y dispara antes de que trepen hasta ti.', 'Estás en la boca de un túnel de neón infinito. Los drones y centinelas suben desde el fondo por sus carriles y tú solo puedes girar de carril en carril y disparar. Cada nivel acelera el ascenso y añade obstáculos que no perdonan un giro tardío.', 'SHOOTER', 'cover-tunel-neon', 'magenta', true, 11);
```

Sin filas en `scores`: el juego arranca vacío y solo acumula partidas reales.

## Plan de implementación

Cada paso deja el repo compilando (`npm run build` verde). El juego no aparece como jugable hasta el paso 11.

1. **Consultar la doc vendored.** Repasar en `node_modules/next/dist/docs/` lo relativo a componentes cliente e `import()` dinámico antes de escribir código.
2. **Constantes.** `lib/games/tunel-neon/constants.ts` con la geometría radial, las velocidades, los tiempos de aparición y los umbrales de progresión.
3. **Proyección.** `lib/games/tunel-neon/projection.ts` con `depthToRadius`, `laneAngle` y `polarToPoint`. Verificar a mano: `depthToRadius(0) === RING_RADIUS_NEAR`, `depthToRadius(1) === RING_RADIUS_FAR`, y `laneAngle(0)` apunta hacia arriba.
4. **Dibujo del túnel.** `lib/games/tunel-neon/game.ts` con la función de fondo: 8 anillos concéntricos y 8 radios usando `depthToRadius`/`laneAngle`, con opacidad decreciente hacia el fondo. En este paso ya se ve el túnel estático.
5. **Entidades.** `lib/games/tunel-neon/entities.ts`: `Enemy`, `Obstacle`, `Projectile` con su `update(dt)` (avance en profundidad) y `draw(ctx)` (rombo/hexágono/rectángulo/línea, usando `polarToPoint` para su posición).
6. **Factory y jugador.** `createTunelNeonGame(opts)`: objeto `runtime` local, loop `requestAnimationFrame` con `dt` capado a 0.05 s, orden `update → draw → publishState`. Dibujo del triángulo del jugador en `playerLane`. Jugable a mano moviendo el carril, aún no registrado.
7. **Rotación y disparo.** Listener de teclado atado a la instancia: `←`/`→`/`A`/`D` con `ROTATE_INTERVAL_MS` de repetición, `Space` con `FIRE_COOLDOWN_MS`; `P`/`Escape` alternan pausa guardando `prevPhase` y poniendo `lastTime = null` al reanudar.
8. **Aparición y colisiones.** Spawn ponderado por nivel (dron/centinela/obstáculo), avance de disparos, impacto disparo-enemigo con resta de `hp`, y la resolución de `depth <= 0` (daño si coincide el carril del jugador, descarte silencioso si no).
9. **Progresión de nivel.** Recalcular `level`, aplicar el bonus de `+50`, escalar `ENEMY_SPEED_STEP` y reducir `spawnTimer` hasta `SPAWN_GAP_MIN`.
10. **Vidas y fin.** `hitFlash`, `lives`, camino único a `GAME OVER` con guard de un solo `onGameOver`. `end()` (botón FIN) entra por el mismo camino. `restart()` reconstruye el `runtime` inicial.
11. **Canvas responsive.** `measure()` con `getBoundingClientRect()`, `applyResize()` que fija `canvas.width/height = cssSize * devicePixelRatio` y aplica `ctx.setTransform(dpr * cssW / 800, 0, 0, dpr * cssH / 600, 0, 0)`, disparado por un `ResizeObserver`. La proyección no se recalcula: solo el transform.
12. **`onState` y limpieza.** Emisión cada `STATE_INTERVAL` (0.1 s) más emisión inmediata al cambiar `phase`, `level` o `lives`. `destroy()` idempotente: flag `destroyed`, `cancelAnimationFrame`, `observer.disconnect()` y `removeEventListener`.
13. **Registry y portada.** Añadir la línea `"tunel-neon"` a `GAME_REGISTRY` y la clase `.cover-tunel-neon` a `app/globals.css`.
14. **Migración.** Aplicar `add_game_tunel_neon` con `mcp__supabase__apply_migration`. Verificar con `mcp__supabase__execute_sql`: la fila nueva con `playable = true` y `sort_order = 11` (ajustar al valor libre real si `garfio`/`agujas` ya se implementaron con otro número), `count(*) = 0` en sus `scores`, y `mcp__supabase__get_advisors` sin hallazgos nuevos. No hace falta regenerar `lib/supabase/database.types.ts`: un `insert` no cambia el schema.
15. **Verificación.** `npm run lint`, `npm run build` y prueba manual: rotar por los 8 carriles, disparar y derribar drones y centinelas (2 impactos), dejar pasar un enemigo por un carril distinto sin penalización, recibir daño al dejar llegar un enemigo u obstáculo en el propio carril, subir de nivel y notar el bonus y la aceleración, pausar con botón y con teclas, redimensionar en partida, agotar las 3 vidas, guardar el puntaje en el modal y volver a entrar a la ruta comprobando que el loop no se duplica en dev.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] `lib/games/tunel-neon/` no tiene variables de módulo mutables ni escribe en `window`: dos instancias del juego coexisten sin interferirse.
- [ ] `/game/tunel-neon/play` monta un `<canvas>` dentro del CRT y muestra el túnel con sus anillos y radios.
- [ ] `←`/`→` y `A`/`D` mueven al jugador un carril por pulsación y repiten cada `ROTATE_INTERVAL_MS` si se mantienen pulsadas; el jugador nunca sale de los 8 carriles (el índice hace wrap).
- [ ] `Space` dispara con un cooldown perceptible: pulsaciones muy seguidas no generan un disparo por frame.
- [ ] Un disparo que alcanza un dron en su mismo carril lo destruye en un impacto y suma `10 × nivel`.
- [ ] Un disparo que alcanza un centinela lo daña pero no lo destruye hasta el segundo impacto, que suma `25 × nivel`.
- [ ] Un enemigo que llega a profundidad 0 en un carril distinto al del jugador desaparece sin restar vidas.
- [ ] Un enemigo o un obstáculo que llega a profundidad 0 en el carril del jugador resta una vida y dispara el parpadeo de impacto.
- [ ] Los centinelas solo aparecen desde el nivel `SENTINEL_FROM_LEVEL` y los obstáculos solo desde `OBSTACLE_FROM_LEVEL`.
- [ ] Cada `LEVEL_UP_SCORE` puntos, `NIVEL` sube en 1, el `score` recibe el bonus de `+50` y las apariciones son visiblemente más rápidas y más frecuentes.
- [ ] El HUD muestra Puntuación, Vidas y Nivel con los valores del juego (no del simulador falso), y **no** muestra los stats de líneas ni de frutas.
- [ ] `GameState` publicado por Túnel Neón no incluye ningún campo que no exista hoy en `lib/games/types.ts`; ni `types.ts` ni `components/GamePlayer.tsx` han sido modificados por este spec.
- [ ] `PAUSA` congela enemigos, obstáculos y disparos, y `REANUDAR` continúa sin salto de posición (sin `dt` acumulado); `P` y `Escape` alternan igual que el botón.
- [ ] `FIN` termina la partida y abre el modal con el puntaje actual.
- [ ] Agotar la tercera vida muestra el parpadeo (~300 ms), el overlay `GAME OVER` en canvas (~1.2 s) y después el modal, con un solo `onGameOver`.
- [ ] `JUGAR DE NUEVO` reinicia con `score` 0, `NIVEL` 1, 3 vidas, carril central, sin enemigos ni disparos en vuelo.
- [ ] Guardar en el modal hace `POST /api/scores` con `gameId: "tunel-neon"` y devuelve el puesto obtenido.
- [ ] La fila `tunel-neon` de `games` tiene `playable = true`, `cat = 'SHOOTER'`, `cover = 'cover-tunel-neon'`, `color = 'magenta'`, y `select count(*) from scores where game_id = 'tunel-neon'` devuelve 0 antes de la primera partida.
- [ ] Túnel Neón aparece en Home, Biblioteca y `/game/tunel-neon` con su portada `cover-tunel-neon` renderizada (no un rectángulo vacío), y su pestaña del Hall of Fame muestra el estado vacío sin romper.
- [ ] Redimensionar durante la partida mantiene la relación 4:3, no deforma el túnel y no altera la posición lógica (carril, profundidad) de ninguna entidad.
- [ ] El canvas se ve nítido con `devicePixelRatio > 1`.
- [ ] Las flechas y `Space` no scrollean la página durante la partida, y el input de iniciales del modal sigue aceptando texto.
- [ ] `SALIR` o navegar fuera detiene el loop y quita listeners y `ResizeObserver`; volver a entrar no lo duplica (verificado en dev con React Strict Mode).
- [ ] Asteroides, Caída, Bloque Buster, Serpentina y Ranaria siguen funcionando igual.

## Decisiones tomadas y descartadas

- **Movimiento discreto de 8 carriles, sin rotación analógica.** Es lo que hace la colisión trivial (comparar índices enteros) y es fiel al espíritu del rail-shooter radial (Tempest). Se descarta un ángulo continuo en radianes: obligaría a una tolerancia angular para "mismo carril" y complicaría el disparo y la colisión sin aportar variedad real de jugabilidad.
- **Posición derivada de `(lane, depth)`, nunca de `x`/`y` propios.** Se descarta que cada entidad guarde su posición en píxeles: forzaría a recalcularla en cada resize. Con la proyección como única fuente de verdad, el resize es un `setTransform` y nada más.
- **El jugador dispara hacia el fondo; los enemigos trepan hacia la boca.** Es la variante "clásica" del jam: el jugador es agresivo. Se descarta invertir los roles (que el jugador huya de algo que lo persigue desde la boca) porque esa lectura es la de la variante `tunel-fase`, que además elimina el disparo — son las dos lecturas del mismo túnel, no la misma con otro nombre.
- **Enemigos fuera del carril del jugador no penalizan al llegar a profundidad 0.** Se descarta penalizar cualquier enemigo que llegue al final, esté donde esté: convertiría el juego en "no dejes pasar nada", que con spawn aleatorio en 8 carriles sería punitivo en exceso y anularía el propósito de moverse de carril.
- **Progresión por umbral de puntuación (`LEVEL_UP_SCORE`), no por oleadas fijas.** Se descartan las plantillas de oleada del estilo `agujas`: aquí no hay una red que diseñar a mano, solo densidad y velocidad, así que un umbral simple basta y la partida escala de forma continua e infinita.
- **Bonus fijo de `+50` al subir de nivel.** Es la lectura literal de "puntos + bonus de nivel" de la sugerencia original. Se descarta un bonus proporcional al tiempo o a la vida restante: añadiría una variable más sin cambiar la sensación de recompensa.
- **Centinelas de 2 impactos desde el nivel 2, obstáculos desde el nivel 3.** Se descarta introducir ambos desde el nivel 1: la curva de aprendizaje necesita empezar solo con drones de un impacto para que el jugador entienda el disparo por carril antes de sumar amenazas.
- **Solo teclado, sin ratón ni táctil.** Se descarta el ratón para rotar (arrastrar en círculo): sería el primer input de puntero angular de la plataforma y añade un riesgo entero (cálculo de ángulo desde el centro, `pointer: coarse`) a un juego que ya funciona bien con teclado discreto.
- **Túnel Neón no toca `GameState`.** Los tres stats que necesita (`score`, `lives`, `level`) ya existen. Es también lo que permite implementar este spec y `02-tunel-fase-jugable.md` sin conflicto de merge entre sí.
- **`cat = SHOOTER`.** Coincide con la sugerencia original y con el hueco real del catálogo: SHOOTER solo tiene Asteroides (vuelo libre vectorial) e Invasores (formación fija sugerida, sin implementar); un rail-shooter radial es una tercera lectura distinta de "disparar".
- **Dibujo con formas, sin assets.** No hay sprites en el repo para este juego y el spec no inventa archivos.
- **Sin audio.** El vault no tiene control de mute (fuera de scope desde el spec 08).

## Riesgos identificados

- **La proyección radial puede ser difícil de calibrar a simple vista** ("estimación incierta" ya señalada en la sugerencia original). Mitigación: `depthToRadius` es una interpolación lineal simple y verificable con dos casos de borde (`depth = 0` y `depth = 1`); si la sensación de profundidad no convence en la prueba manual, se ajusta solo esa función, sin tocar el resto de la mecánica.
- **El canvas responsive altera el balance calibrado en píxeles.** `RING_RADIUS_NEAR`/`RING_RADIUS_FAR` están en px lógicos sobre un centro fijo. Mitigación: toda la lógica vive en `(lane, depth)` y el escalado es un puro `setTransform`; criterio de aceptación explícito sobre que el resize no altera la posición lógica.
- **El reescalado al redimensionar puede dejar entidades en estado inválido.** Como ninguna entidad guarda `x`/`y`, no hay estado que quede inválido: `applyResize()` solo recalcula el transform y `cssW`/`cssH`, que ninguna entidad lee.
- **React Strict Mode monta dos veces en dev.** Dos loops dispararían el spawn al doble de frecuencia y el disparo se duplicaría. Mitigación: `destroy()` idempotente con flag `destroyed` que cancela `rAF`, desconecta el `ResizeObserver` y quita los listeners de teclado; criterio de aceptación propio.
- **El `preventDefault` global secuestra el teclado.** Las flechas y `Space` están en `BLOCKED_KEYS` de `components/GamePlayer.tsx`, con su bypass ya existente para `INPUT`/`TEXTAREA`/contentEditable. Mitigación: no tocar `BLOCKED_KEYS` y verificar en la prueba manual que el input de iniciales del modal sigue aceptando texto.
- **Con 8 carriles y spawn aleatorio uniforme, la dificultad puede sentirse desigual entre partidas** (una racha de apariciones en el mismo carril es más fácil que una repartida). Mitigación: es una fuente de rejugabilidad aceptada — el vault ya tiene ejemplos de aleatoriedad en spawn (Serpentina); si en la prueba manual resulta demasiado desigual, se puede introducir un sesgo anti-repetición en un spec posterior.
- **Detección de colisión disparo-enemigo por comparación de profundidad puede saltarse un frame con `dt` grande.** A `PROJECTILE_SPEED = 1.4`/s y `dt` capado a 0.05 s, el avance máximo por frame es 0.07 de profundidad — muy por debajo del margen de detección (`projectile.depth >= enemy.depth`, que no exige igualdad exacta). Riesgo residual aceptado: la propia condición de desigualdad evita el problema clásico de "atravesar sin tocar" que sí afecta a Bloque Buster.
- **`sort_order = 11` asume que `garfio` y `agujas` (specs de otro jam, sin implementar) ya tomaron el 9 y el 10.** Si se implementa este spec antes que ellos, no hay conflicto porque `sort_order` no es único, solo un desorden visual temporal. Mitigación: al implementar, verificar el `sort_order` libre real con `mcp__supabase__execute_sql` antes de aplicar la migración.

## Qué **no** está en este spec

- La variante `tunel-fase` de `02-tunel-fase-jugable.md`: otro juego, otro `id`, otra fila, otra entrada en el registry.
- Jefes de fin de oleada, power-ups, ítems recolectables o combos de puntuación.
- Cualquier cambio en `lib/games/types.ts`, en `components/GamePlayer.tsx`, en `POST /api/scores`, en `lib/queries.ts` o en el schema de Supabase más allá del `insert` de la fila `tunel-neon`.
- Input de ratón o táctil, controles alternativos, dificultad seleccionable.
- Audio, assets externos, persistencia local y tests automatizados.
