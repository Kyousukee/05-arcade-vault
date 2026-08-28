# Spec jam travesía peligrosa — GARFIO jugable

**Estado:** borrador
**Depende de:** 05-asteroides-jugable, 06-juegos-y-leaderboard
**Fecha:** 2026-08-27

**Objetivo:** Crear un juego de travesía por balanceo en TypeScript bajo el contrato `GameFactory`, en el que el jugador cruza un abismo de neón colgándose con un garfio de anclas móviles mediante una sola tecla, con un reloj que solo se recarga alcanzando balizas, y darlo de alta como `garfio` en el registry, en la tabla `games` y en el leaderboard.

> Nota de contexto: jam del tema **«travesía peligrosa: cruzar obstáculos en movimiento contra reloj»**. Donde Ranaria resuelve el tema con una rejilla y saltos discretos, Garfio lo resuelve con **física continua**: no hay casillas, hay inercia. El obstáculo en movimiento es también el único apoyo — las anclas se desplazan — y el reloj no se reinicia por intento sino que se recarga solo avanzando. Este spec entrega el juego mínimo jugable; `02-garfio-extension.md` (misma carpeta) añade anclas frágiles, viento, dash e impulsores.

## Alcance

**Incluye:**

- **Juego nuevo en TypeScript** en `lib/games/garfio/`, sin globals de módulo:
  - `constants.ts` — `LOGICAL_W = 800`, `LOGICAL_H = 600`, `GRAVITY = 1200` (px lógicos/s²), `MAX_FALL = 900`, `SWING_DAMPING = 0.999`, `PUMP_ACCEL = 2.2` (rad/s² sobre el ángulo del péndulo), `ROPE_MIN = 60`, `ROPE_MAX = 240`, `GRAPPLE_RANGE = 260`, `RELEASE_BOOST = 1.08`, `START_LIVES = 3`, `TIME_LIMIT = 20` (s), `BEACON_TIME = 8` (s), `BEACON_EVERY = 1200` (px lógicos), `SEGMENT_LEN = 400`, `PIXELS_PER_METER = 20`, `ABYSS_Y = 640`, `DEATH_FLASH = 350` (ms), `GAME_OVER_DELAY = 1200`, `STATE_INTERVAL = 0.1`.
  - `world.ts` — generación por tramos (`Segment`) de anclas, drones y balizas a partir de un PRNG **por instancia** con semilla fija, más el reciclado de tramos que quedan detrás de la cámara.
  - `entities.ts` — `Anchor` (fija u oscilante), `Drone` (patrulla vertical), `Beacon`, y `Runner` (el jugador) con su dibujo.
  - `game.ts` — `createGarfioGame(opts)`: estado en un objeto `runtime` local a la factory, loop `requestAnimationFrame`, listeners de teclado, `ResizeObserver` y `destroy()` idempotente.
- **Área lógica fija 800×600** con el patrón de los specs 08 y 09: el canvas llena el CRT y el contexto aplica `ctx.setTransform(dpr * cssW / 800, 0, 0, dpr * cssH / 600, 0, 0)`. El mundo es infinito en `x`; la **cámara** desplaza el dibujo (`ctx.translate(-camX, 0)`), no la lógica.
- **Física del jugador (dos estados y solo dos):**
  - **Libre:** integración semi-implícita con `GRAVITY`, velocidad de caída limitada a `MAX_FALL`. Sin control direccional en el aire salvo el enganche.
  - **Colgado:** péndulo de longitud fija `ropeLen` alrededor del ancla. Se integra el ángulo `theta` con `theta'' = -(GRAVITY / ropeLen) * sin(theta) + pump`, se aplica `SWING_DAMPING` por frame y la posición se deriva del ángulo. `pump` es `±PUMP_ACCEL` según flecha izquierda/derecha.
- **Un solo botón para lo esencial:** `Space` (o `ArrowUp`, o `W`) engancha al pulsar y **suelta al soltar**. Al enganchar se elige el ancla válida más cercana al jugador dentro de `GRAPPLE_RANGE` que esté **por encima** de él; `ropeLen` es la distancia en ese instante, recortada a `[ROPE_MIN, ROPE_MAX]`. Al soltar, la velocidad pasa a ser la tangencial del péndulo multiplicada por `RELEASE_BOOST`.
- **Bombeo:** flechas izquierda/derecha y `A`/`D` aplican `pump` mientras se está colgado. En estado libre no hacen nada.
- **Anclas:** puntos de amarre suspendidos. Dos tipos en este spec: **fijas** y **oscilantes** (recorren un segmento vertical de amplitud `60–140` px lógicos con un seno de periodo propio). La oscilación es determinista, función del tiempo de mundo y de la fase del ancla.
- **Drones:** obstáculos móviles que patrullan un segmento vertical a velocidad constante. Tocar uno mata. Son el «obstáculo en movimiento» que no sirve de apoyo.
- **Balizas:** cada `BEACON_EVERY` px lógicos hay una baliza. Atravesarla suma `+100`, recarga el reloj con `BEACON_TIME` (acumulable hasta `TIME_LIMIT`) y fija el punto de reaparición.
- **Reloj:** `TIME_LIMIT = 20 s` al empezar. Corre solo en `phase === "playing"` y **nunca se reinicia solo**: solo lo recargan las balizas. A 0 → muerte. Se dibuja como barra en la franja superior del canvas junto a `SCORE`, `NIVEL`, metros y vidas. **No se publica en `GameState`.**
- **Muerte** (resta una vida y reaparece en la última baliza con el reloj a `TIME_LIMIT`): caer por debajo de `ABYSS_Y`, tocar un drone y reloj a 0.
- **Puntuación:** `+1` por cada metro lógico nuevo de avance máximo (`PIXELS_PER_METER = 20`), `+100` por baliza y `+25` por cada enganche encadenado a partir del segundo sin haber muerto (racha, sin techo). Retroceder no resta ni vuelve a puntuar.
- **Progresión:** `level = 1 + floor(balizas / 3)`. Cada nivel acelera los drones un 12 %, aumenta la amplitud de las anclas oscilantes y separa más las anclas dentro del tramo generado.
- **Vidas:** `START_LIVES = 3`, publicadas en `lives?`.
- **Dibujo con formas y color**, sin assets: fondo de abismo con degradado y líneas de fuga, anclas como aros cian, cuerda como línea recta con brillo, jugador como cápsula magenta con estela corta, drones como rombos amarillos con núcleo pulsante, balizas como columnas verdes verticales.
- **Fin de partida:** `DEATH_FLASH` de 350 ms; al agotar la última vida, overlay `GAME OVER` en canvas ~1,2 s y un único `onGameOver(score)`.
- **`restart()`** reconstruye el `runtime` inicial: jugador en `x = 100` sobre la plataforma de salida, cámara a 0, mundo regenerado con la semilla base, `score = 0`, `level = 1`, `lives = 3`, reloj a 20.
- **Entrada `garfio`** en `GAME_REGISTRY` (`lib/games/registry.ts`) con `import()` dinámico.
- **Portada nueva `cover-garfio`** en `app/globals.css`, en la línea de las existentes (CSS puro sobre pseudo-elementos): fondo oscuro con degradado vertical, una diagonal cian de cuerda y dos aros cian a distinta altura.
- **Migración `add_game_garfio`** con el `insert` completo y `sort_order = 9`.
- **Verificación:** `npm run lint`, `npm run build` y prueba manual del recorrido completo en navegador.

**NO incluye (fuera de este spec):**

- Todo lo del `02-garfio-extension.md`: anclas frágiles, anclas móviles horizontales, viento por tramo, dash con carga, células de tiempo y tramos con puerta.
- Cambios en `lib/games/types.ts` ni en `components/GamePlayer.tsx`: Garfio no necesita ningún campo nuevo.
- Niveles diseñados a mano: el mundo se genera por tramos con un PRNG sembrado.
- Cuerda elástica, longitud variable durante el swing o rebobinado: `ropeLen` es fija mientras dura el enganche.
- Controles táctiles o por puntero; solo teclado, con el aviso `.keyboard-notice` que ya existe.
- Assets en `public/games/garfio/` y audio.
- High-score local en `localStorage` y tests automatizados.
- Los demás juegos no jugables del catálogo (`gloton`, `invasores`, `rocas`, `duelo-pixel`), que siguen con el simulador falso.

**Consecuencias aceptadas de este scope:**

- Sin control direccional en caída libre, un mal soltado es irrecuperable: es la fuente principal de muerte y es deliberada — obliga a decidir **cuándo** soltar, que es la mecánica del juego.
- El mundo generado con semilla fija hace todas las partidas idénticas en trazado. Se acepta a cambio de que los puntajes sean comparables entre jugadores, que es lo que pide el leaderboard.
- Con el área lógica fija, en un CRT pequeño el juego se ve más pequeño en vez de reajustarse.
- La racha sin techo permite puntuaciones muy altas a un jugador experto; el reloj de 20 s acota la partida, no la racha.
- Solo dos tipos de ancla hacen el nivel 1 monótono para un jugador experimentado; la variedad llega en el 02.

## Modelo de datos

Este spec no crea tablas nuevas ni extiende el contrato: reusa `public.games` y `public.scores` del spec 06 e inserta una fila. Define el estado interno del juego y la mecánica completa, por ser un juego diseñado desde cero.

### Mapeo al `GameState`

| Campo `GameState` | Origen en Garfio                                                    |
| ----------------- | ------------------------------------------------------------------- |
| `score`           | `runtime.score` — metros, balizas y racha de enganches              |
| `level`           | `runtime.level` — `1 + floor(beacons / 3)`                          |
| `lives`           | `runtime.lives` — 3 iniciales                                       |
| `phase`           | `runtime.phase`                                                     |
| `lines`           | **no se publica**                                                   |
| `fruits`          | **no se publica**                                                   |
| `tripleShot`      | `0` fijo (campo obligatorio del contrato, específico de Asteroides) |

Ni el reloj, ni los metros, ni la racha viajan en `GameState`: se dibujan en la franja superior del canvas. Garfio **no toca `lib/games/types.ts`**.

### Estado interno — `lib/games/garfio/game.ts`

No se exporta. Todo vive en coordenadas de **mundo** (`x` crece sin límite, `y` en el rango del canvas lógico); `camX` traduce a coordenadas de pantalla solo al dibujar.

```ts
type RunnerMode = "free" | "hooked";

interface Anchor {
  id: number;
  x: number;
  baseY: number;
  amplitude: number; // 0 = ancla fija
  period: number; // s, si amplitude > 0
  phase: number; // rad, desfase propio
}

interface Drone {
  x: number;
  y: number; // posición actual
  minY: number;
  maxY: number;
  speed: number; // px lógicos/s, signo = sentido
}

interface Beacon {
  x: number;
  index: number; // 0, 1, 2 … — orden en la travesía
  taken: boolean;
}

interface Segment {
  startX: number; // múltiplo de SEGMENT_LEN
  anchors: Anchor[];
  drones: Drone[];
  beacons: Beacon[];
}

interface GarfioRuntime {
  segments: Segment[]; // ventana de tramos vivos alrededor de la cámara
  nextSegmentX: number; // startX del próximo tramo a generar
  seed: number; // estado del PRNG por instancia
  mode: RunnerMode;
  x: number; // posición del jugador en mundo
  y: number;
  vx: number; // solo en modo "free"
  vy: number;
  anchor: Anchor | null; // ancla activa en modo "hooked"
  ropeLen: number;
  theta: number; // ángulo de la cuerda respecto a la vertical, rad
  omega: number; // velocidad angular, rad/s
  pump: -1 | 0 | 1; // bombeo pedido por el teclado
  camX: number; // borde izquierdo de la cámara, en mundo
  maxX: number; // avance máximo alcanzado, para los metros
  streak: number; // enganches encadenados sin morir
  beacons: number; // balizas atravesadas
  respawnX: number; // última baliza, punto de reaparición
  respawnY: number;
  score: number;
  level: number;
  lives: number;
  timeLeft: number; // s, de TIME_LIMIT a 0
  phase: GamePhase;
  prevPhase: GamePhase; // fase previa a la pausa
  deathFlash: number; // ms restantes de parpadeo, 0 si no aplica
  gameOverTimer: number; // ms de overlay antes de onGameOver
  stateAccum: number; // acumulador de la emisión de onState
  lastTime: number | null; // null tras resume() para no arrastrar dt
  worldT: number; // s de mundo, alimenta la oscilación de las anclas
  cssW: number;
  cssH: number;
}
```

### Mecánica (juego diseñado desde cero)

- **Salida:** el jugador arranca quieto sobre una plataforma en `x = 100`, `y = 420`. La primera pulsación lo lanza: pasa a `free` con `vx = 180`, `vy = -60`.
- **Enganche:** al pulsar la tecla de garfio en modo `free`, se recorren las anclas de los tramos vivos y se elige la de menor distancia al jugador que cumpla `dist <= GRAPPLE_RANGE` **y** `anchor.y < runner.y` (por encima). Si no hay ninguna, la pulsación no hace nada (y no penaliza). Con ancla: `mode = "hooked"`, `ropeLen = clamp(dist, ROPE_MIN, ROPE_MAX)`, `theta` y `omega` se derivan de la posición y la velocidad actuales para que el swing arranque sin salto visual, `streak += 1` y `score += 25` a partir del segundo enganche de la racha.
- **Swing:** mientras `hooked`, el ancla puede moverse (oscilante); el pivote se recalcula cada frame y la posición del jugador es `pivot + ropeLen * (sin θ, cos θ)`. `omega += (-(GRAVITY / ropeLen) * sin(theta) + pump * PUMP_ACCEL) * dt`, luego `omega *= SWING_DAMPING`, luego `theta += omega * dt`.
- **Soltar:** al soltar la tecla, `mode = "free"` y la velocidad pasa a la tangencial: `v = omega * ropeLen` en la dirección perpendicular a la cuerda, escalada por `RELEASE_BOOST`.
- **Cámara:** `camX` sigue al jugador con un margen fijo, de modo que el jugador queda a un tercio del ancho lógico. Nunca retrocede: `camX = max(camX, x - LOGICAL_W / 3)`.
- **Generación de mundo:** cuando `camX + LOGICAL_W * 2 > nextSegmentX`, se genera un `Segment` nuevo con el PRNG sembrado: 3–5 anclas con `x` separadas 90–160 px, `baseY` entre 120 y 400, un 40 % de ellas oscilantes; 0–2 drones; y una baliza si el tramo cruza un múltiplo de `BEACON_EVERY`. Los tramos con `startX + SEGMENT_LEN < camX` se descartan.
- **Baliza:** al superar `beacon.x` con `beacon.taken === false`: `taken = true`, `beacons += 1`, `score += 100`, `timeLeft = min(TIME_LIMIT, timeLeft + BEACON_TIME)`, `respawnX/respawnY` pasan a la baliza y `level` se recalcula.
- **Metros:** cada frame, `if (x > maxX) { score += floor((x - maxX) / PIXELS_PER_METER); maxX = x; }`, contabilizando solo metros completos y guardando el resto en `maxX`.
- **Muerte:** `y > ABYSS_Y`, colisión círculo-rombo con un drone, o `timeLeft <= 0`. `lives -= 1`, `phase = "dead"`, `deathFlash = 350`, `streak = 0`. Con `lives > 0` el jugador reaparece en `respawnX/respawnY` en modo `free` con velocidad nula y `timeLeft = TIME_LIMIT`; `maxX` **no** se reduce, para que el tramo repetido no vuelva a puntuar. Con `lives === 0`, overlay `GAME OVER` durante `GAME_OVER_DELAY` y un único `onGameOver(score)`.
- **Victoria:** no hay. La travesía es infinita; la partida termina por vidas agotadas o por el botón `FIN`.

### Marcador dibujado en canvas — franja superior

`SCORE`, `NIVEL`, metros recorridos, racha actual y corazones de vida, más una **barra de tiempo** que se vacía de derecha a izquierda (verde > 8 s, amarilla 8–4 s, magenta parpadeante < 4 s) y un destello al recargarse en una baliza.

### Registry — `lib/games/registry.ts`

```ts
garfio: async () => (await import("./garfio/game")).createGarfioGame,
```

### Portada — `app/globals.css`

Clase nueva junto a las existentes (`cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`, `cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo`), en CSS puro sobre pseudo-elementos, sin imágenes:

```css
.cover-garfio {
  background: linear-gradient(180deg, #001824, #0a0a18);
}
.cover-garfio::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, transparent 46%, var(--cyan) 46% 48%, transparent 48%),
    radial-gradient(circle at 28% 28%, transparent 0 6px, var(--cyan) 6px 8px, transparent 9px),
    radial-gradient(circle at 72% 62%, transparent 0 6px, var(--cyan) 6px 8px, transparent 9px);
  filter: drop-shadow(0 0 8px rgba(0, 245, 255, 0.5));
}
```

### Fila en `games` — migración `add_game_garfio`

`garfio` no existe hoy en `public.games` (las 9 filas actuales son `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `asteroides`, `ranaria`, `duelo-pixel`, con `sort_order` 0–8). Se inserta con el siguiente libre:

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order)
values ('garfio', 'GARFIO', 'Cruza el abismo colgado de un cable de luz.', 'No hay suelo bajo tus pies: solo anclas de neón que se balancean sobre el vacío. Engancha, columpia y suelta en el instante exacto para encadenar el impulso. Cada baliza te devuelve unos segundos; fallar el enganche te devuelve al abismo.', 'ARCADE', 'cover-garfio', 'cyan', true, 9);
```

Sin filas en `scores`: el juego arranca vacío y solo acumula partidas reales. Tras la migración, `select count(*) from games` devuelve 10.

## Plan de implementación

Cada paso deja el repo compilando (`npm run build` verde). El juego no aparece como jugable hasta el paso 10.

1. **Consultar la doc vendored.** Repasar en `node_modules/next/dist/docs/` lo relativo a componentes cliente e `import()` dinámico antes de escribir código.
2. **Constantes.** `lib/games/garfio/constants.ts` con la física, la geometría, los tiempos y los umbrales del alcance.
3. **PRNG y mundo.** `lib/games/garfio/world.ts`: PRNG determinista (LCG o xorshift de 32 bits) **con estado en el objeto que se le pasa**, nunca en el módulo; `generateSegment(seedState, startX, level)` y el reciclado de tramos fuera de cámara.
4. **Entidades.** `lib/games/garfio/entities.ts`: `Anchor` con su posición efectiva `y(worldT)`, `Drone` con su patrulla vertical, `Beacon` y `Runner`, cada uno con su `draw(ctx)`. Sin estado de módulo.
5. **Factory y física libre.** `lib/games/garfio/game.ts` — `createGarfioGame(opts)`: objeto `runtime` local, loop `requestAnimationFrame` con `dt` capado a 0,05 s, orden `update → draw → publishState`. En este paso solo el modo `free` con gravedad, la cámara y el dibujo del fondo. Jugable a mano, aún no registrado.
6. **Enganche y swing.** Selección del ancla, conversión de posición/velocidad a `theta`/`omega`, integración del péndulo con amortiguación, bombeo con flechas y soltado con conversión a velocidad tangencial. Dibujo de la cuerda.
7. **Mundo vivo.** Generación y reciclado de tramos según `camX`, anclas oscilantes con `worldT`, drones patrullando y colisión con el jugador.
8. **Balizas, reloj y puntuación.** Recarga de `timeLeft`, `respawn`, metros por `maxX`, `+100` por baliza, `+25` por enganche encadenado y recálculo de `level`.
9. **Vidas y fin.** `deathFlash`, reaparición en la última baliza, `lives`, camino único a `GAME OVER` con guard de un solo `onGameOver`. `end()` entra por el mismo camino. `restart()` reconstruye el `runtime` inicial con la semilla base.
10. **Canvas responsive.** `measure()` con `getBoundingClientRect()`, `applyResize()` que fija `canvas.width/height = cssSize * devicePixelRatio` y aplica `ctx.setTransform(dpr * cssW / 800, 0, 0, dpr * cssH / 600, 0, 0)`, disparado por un `ResizeObserver`. La física no se recalcula: solo el transform.
11. **`onState` y limpieza.** Emisión cada `STATE_INTERVAL` (0,1 s) más emisión inmediata al cambiar `phase`, `level` o `lives`. `destroy()` idempotente: flag `destroyed`, `cancelAnimationFrame`, `observer.disconnect()` y `removeEventListener` de `keydown` y `keyup`.
12. **Registry y portada.** Añadir la línea `garfio` a `GAME_REGISTRY` y la clase `.cover-garfio` a `app/globals.css`.
13. **Migración.** Aplicar `add_game_garfio` con `mcp__supabase__apply_migration`. Verificar con `mcp__supabase__execute_sql`: la fila nueva con `playable = true` y `sort_order = 9`, `count(*) = 10` en `games`, `count(*) = 0` en sus `scores`, y `mcp__supabase__get_advisors` sin hallazgos nuevos. No hace falta regenerar `lib/supabase/database.types.ts`: un `insert` no cambia el schema.
14. **Verificación.** `npm run lint`, `npm run build` y prueba manual: engancharse, bombear, soltar en el punto alto, encadenar tres anclas seguidas, morir por abismo, por drone y por reloj, reaparecer en la baliza, pausar con botón y con teclas, redimensionar en partida, guardar el puntaje en el modal y volver a entrar a la ruta comprobando que el loop no se duplica en dev.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] `lib/games/garfio/` no tiene variables de módulo mutables (el estado del PRNG incluido) ni escribe en `window`: dos instancias del juego coexisten sin interferirse.
- [ ] `/game/garfio/play` monta un `<canvas>` dentro del CRT y la primera pulsación de `Space` lanza al jugador.
- [ ] Mantener pulsada la tecla de garfio engancha el ancla válida más cercana **por encima** del jugador dentro de `GRAPPLE_RANGE`, y soltarla lo libera con la velocidad tangencial del swing.
- [ ] Pulsar sin ancla válida a tiro no engancha, no mata y no rompe la racha.
- [ ] Al enganchar no hay salto visual de posición: el jugador continúa desde donde estaba.
- [ ] Las flechas izquierda/derecha (y `A`/`D`) aumentan visiblemente la amplitud del balanceo mientras se está colgado, y no hacen nada en caída libre.
- [ ] Las anclas oscilantes se mueven mientras el jugador está colgado de ellas y lo arrastran consigo.
- [ ] Tocar un drone resta una vida; caer por debajo del abismo resta una vida; el reloj a 0 resta una vida.
- [ ] Tras morir con vidas restantes, el jugador reaparece en la última baliza con el reloj lleno y la racha a 0, y el tramo ya recorrido **no** vuelve a sumar metros.
- [ ] Atravesar una baliza suma 100 puntos, recarga el reloj (sin superar 20 s) y produce un destello visible en la barra.
- [ ] El score sube 1 punto por cada 20 px lógicos de avance máximo nuevo, y retroceder no resta ni vuelve a puntuar al reavanzar.
- [ ] Encadenar enganches sin morir suma 25 puntos a partir del segundo, y morir pone la racha a 0.
- [ ] Cada 3 balizas el `NIVEL` sube en 1 y los drones se mueven visiblemente más rápido.
- [ ] El HUD muestra Puntuación, Vidas y Nivel con los valores del juego (no del simulador falso), y **no** muestra los stats de líneas ni de frutas.
- [ ] `GameState` publicado por Garfio no incluye ningún campo que no exista hoy en `lib/games/types.ts`; ni `types.ts` ni `components/GamePlayer.tsx` han sido modificados por este spec.
- [ ] `PAUSA` congela física, mundo y reloj, y `REANUDAR` continúa sin salto de posición (sin `dt` acumulado); `P` y `Escape` alternan igual que el botón.
- [ ] `FIN` termina la partida y abre el modal con el puntaje actual.
- [ ] Agotar la tercera vida muestra el parpadeo (~350 ms), el overlay `GAME OVER` en canvas (~1,2 s) y después el modal, con un solo `onGameOver`.
- [ ] `JUGAR DE NUEVO` reinicia en la plataforma de salida con `score` 0, `NIVEL` 1, 3 vidas, reloj a 20 s y el mismo trazado de mundo que la partida anterior.
- [ ] Guardar en el modal hace `POST /api/scores` y devuelve el puesto obtenido.
- [ ] `select count(*) from games` devuelve 10 y la fila `garfio` tiene `playable = true`, `cat = 'ARCADE'`, `cover = 'cover-garfio'`, `color = 'cyan'` y `sort_order = 9`.
- [ ] `select count(*) from scores where game_id = 'garfio'` devuelve 0 antes de la primera partida.
- [ ] Garfio aparece en Home, Biblioteca y `/game/garfio` con su portada `cover-garfio` renderizada (no un rectángulo vacío), y su pestaña del Hall of Fame muestra el estado vacío sin romper.
- [ ] Redimensionar durante la partida mantiene la relación 4:3, no deforma el mundo y no altera la posición lógica del jugador ni de las anclas.
- [ ] El canvas se ve nítido con `devicePixelRatio > 1`.
- [ ] Las flechas y `Space` no scrollean la página durante la partida, y el input de iniciales del modal sigue aceptando texto.
- [ ] `SALIR` o navegar fuera detiene el loop y quita listeners y `ResizeObserver`; volver a entrar no lo duplica (verificado en dev con React Strict Mode).
- [ ] Asteroides, Caída, Bloque Buster y Serpentina siguen funcionando igual.

## Decisiones tomadas y descartadas

- **Péndulo de longitud fija en vez de cuerda elástica.** Se descarta el muelle amortiguado (más «realista»): añade dos constantes de tuning acopladas, oscila de forma difícil de leer y hace que soltar en el punto exacto deje de ser una decisión clara. Con longitud fija, la velocidad de salida es exactamente `omega * ropeLen` y el jugador puede predecirla.
- **Un solo botón: enganchar al pulsar, soltar al soltar.** Se descarta el enganche por conmutación (una pulsación engancha, otra suelta): en un juego de timing, el estado del garfio debe estar en el dedo del jugador, no en una variable que hay que recordar.
- **Selección automática del ancla más cercana por encima.** Se descartan la selección con el ratón (sería el primer input de puntero de la plataforma, con su lío de DPR y `getBoundingClientRect`) y la selección direccional con flechas (compite con el bombeo, que es el uso natural de esas teclas en este juego).
- **Sin control direccional en caída libre.** Se descarta el control aéreo tipo plataformas: convertiría el juego en «volar» y anularía el peso de la decisión de soltar. Coste aceptado: un mal soltado es irrecuperable.
- **Mundo generado con PRNG de semilla fija, igual en todas las partidas.** Se descarta el mundo aleatorio por partida (haría los puntajes incomparables y arruinaría el leaderboard) y se descartan los niveles diseñados a mano (volumen de contenido propio de un juego de esfuerzo L). Coste: el trazado se memoriza.
- **Reloj que solo recargan las balizas, sin reinicio por muerte de tramo.** Se descarta el reloj por intento estilo Ranaria: aquí la travesía es continua y el reloj es lo que la empuja hacia delante. Al reaparecer sí se llena, para que morir en una baliza no encadene muertes.
- **`maxX` no retrocede al morir.** Se descarta permitir volver a puntuar el tramo repetido: sería una fábrica de puntos consistente en morir a propósito, y rompería la monotonía del score respecto a la habilidad.
- **Racha sin techo, con `+25` por enganche encadenado.** Se descarta el multiplicador de score total (crecería exponencialmente y aplastaría el resto de fuentes de puntos) y se descarta el techo bajo, que desactivaría la racha para el jugador que mejor juega.
- **Drones como único obstáculo hostil del 01.** Se descartan las vigas fijas y los proyectiles: con el abismo y el reloj ya hay tres formas de morir, suficientes para que el 01 sea un juego completo. Más variedad es el 02.
- **Área lógica fija 800×600 con cámara en `x`.** Se descarta escalar el mundo al tamaño del CRT (cambiaría el alcance efectivo del garfio y con él todo el balance). Mismo patrón que los specs 08 y 09.
- **Garfio no toca `GameState`.** Se descartan campos opcionales para metros, racha o tiempo: los tres se dibujan en el canvas, donde el jugador ya está mirando. Es también lo que permite que este spec y el de Ranaria del mismo jam se implementen sin pisarse.
- **Dibujo con formas, sin assets.** No hay sprites en el repo para este juego y el spec no inventa archivos; la paleta neón del vault basta.
- **Sin audio.** El vault no tiene control de mute (fuera de scope desde el spec 08).

## Riesgos identificados

- **El canvas responsive altera el balance calibrado en píxeles.** `GRAVITY`, `GRAPPLE_RANGE` y `ROPE_MAX` están en px lógicos. Mitigación: toda la física vive en el espacio lógico fijo 800×600 y el escalado es un puro `setTransform`; criterio de aceptación explícito.
- **El reescalado al redimensionar puede dejar entidades en estado inválido.** Un jugador colgado mantiene una referencia a un `Anchor`. Mitigación: `applyResize()` solo recalcula el transform y `cssW`/`cssH`; ni el `runtime` ni los tramos leen esos valores.
- **React Strict Mode monta dos veces en dev.** Dos loops harían avanzar el mundo al doble y vaciarían el reloj en 10 s. Mitigación: `destroy()` idempotente con flag `destroyed` que cancela `rAF`, desconecta el `ResizeObserver` y quita `keydown` y `keyup`; criterio de aceptación propio.
- **El `preventDefault` global secuestra el teclado.** `Space` es la tecla principal del juego y ya está en `BLOCKED_KEYS`; si el listener sobreviviera a la ruta, el modal no aceptaría iniciales. Mitigación: listener atado a la instancia y bypass ya existente para campos de formulario.
- **El péndulo puede inestabilizarse con `ropeLen` pequeño.** Con `ropeLen` cerca de `ROPE_MIN` y `dt` de 0,05 s, `GRAVITY / ropeLen` es grande y la integración explícita puede divergir. Mitigación: `ROPE_MIN = 60` como suelo duro, `dt` capado y sub-pasos fijos de la integración angular (2 sub-pasos por frame) si la prueba manual muestra vibración.
- **La conversión velocidad ↔ ángulo al enganchar puede dar un salto visual.** Si `theta`/`omega` se derivan mal, el jugador «teletransporta». Mitigación: `theta` desde el vector ancla→jugador y `omega` desde la componente tangencial de la velocidad; criterio de aceptación específico.
- **La generación por tramos puede producir travesías imposibles.** Un tramo sin ancla alcanzable dentro de `GRAPPLE_RANGE` desde la trayectoria natural bloquea la partida para siempre, con semilla fija y todo. Mitigación: la generación garantiza que cada ancla nueva está a lo sumo a `GRAPPLE_RANGE * 0.8` de la anterior; verificación manual del recorrido en la prueba del paso 14.
- **Los drones pueden generarse encima de una baliza o de un ancla.** Haría un punto obligatorio mortal. Mitigación: rechazar posiciones de drone a menos de 70 px lógicos de un ancla o de una baliza durante la generación.
- **La memoria puede crecer si los tramos no se reciclan.** Una partida larga generaría cientos de `Segment`. Mitigación: descartar los tramos con `startX + SEGMENT_LEN < camX` en cada generación; criterio implícito en la prueba manual larga.
- **El `sort_order = 9` asume que nadie más inserta a la vez.** Si `agujas` (mismo jam) se implementa primero con el mismo número habría dos juegos con el mismo orden. Mitigación: `agujas` está especificado con `sort_order = 10`; si se altera el orden de implementación, el segundo en entrar toma el siguiente libre.

## Qué **no** está en este spec

- Anclas frágiles, anclas de movimiento horizontal, viento por tramo, dash con carga, células de tiempo y tramos con puerta: todo eso es `02-garfio-extension.md`.
- Cualquier cambio en `lib/games/types.ts`, en `components/GamePlayer.tsx` o en el schema de Supabase más allá del `insert` de la fila `garfio`.
- Los otros dos juegos del jam (`ranaria` y `agujas`), cada uno con su carpeta en `specs/game-jam/`.
- Audio, controles táctiles, niveles diseñados a mano, dificultad seleccionable, persistencia local y tests automatizados.
