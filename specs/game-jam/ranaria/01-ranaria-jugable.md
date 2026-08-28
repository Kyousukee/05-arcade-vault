# Spec jam travesía peligrosa — RANARIA jugable

**Estado:** borrador
**Depende de:** 05-asteroides-jugable, 06-juegos-y-leaderboard
**Fecha:** 2026-08-27

**Objetivo:** Diseñar desde cero un juego de travesía por carriles en TypeScript bajo el contrato `GameFactory`, en el que una rana cruza cinco carriles de coches y cinco franjas de río sobre troncos a la deriva hasta cinco nenúfares, con un reloj de 30 s por intento, y habilitar la fila `ranaria` de `games` para que compita en el leaderboard con puntajes reales.

> Nota de contexto: jam del tema **«travesía peligrosa: cruzar obstáculos en movimiento contra reloj»**. Ranaria es el juego ancla del jam: la lectura más literal del tema — la travesía es el propio tablero. Este spec entrega el juego mínimo jugable; `02-ranaria-extension.md` (misma carpeta) añade la fauna del río, los bonus y el campo opcional `timeLeft?` en `GameState`. Nada del 02 hace falta para jugar al 01: aquí el tiempo restante se dibuja **dentro del canvas**, que es exactamente lo que evita tocar el contrato compartido en este spec.

## Alcance

**Incluye:**

- **Juego nuevo en TypeScript** en `lib/games/ranaria/`, sin globals de módulo:
  - `constants.ts` — `LOGICAL_W = 800`, `LOGICAL_H = 600`, `HEADER_H = 80`, `COLS = 16`, `ROWS = 13`, `CELL_W = 50`, `CELL_H = 40`, `START_LIVES = 3`, `TIME_LIMIT = 30` (s), `HOP_MS = 90`, `PADS = 5`, `LEVEL_SPEEDUP = 1.15`, `DEATH_FLASH = 350` (ms), `GAME_OVER_DELAY = 1200`, `STATE_INTERVAL = 0.1`.
  - `lanes.ts` — descripción declarativa de las 13 filas (`LANE_LAYOUT`): tipo (`start` | `road` | `median` | `river` | `goal`), dirección (`-1` | `+1`), velocidad base en px lógicos/s, longitud y separación de las entidades de la fila.
  - `entities.ts` — `Car` y `Log` como rectángulos que se desplazan en su fila con envolvimiento horizontal, más `Frog` con su animación de salto y su dibujo.
  - `game.ts` — `createRanariaGame(opts)`: estado en un objeto `runtime` local a la factory, loop `requestAnimationFrame`, listeners de teclado, `ResizeObserver` y `destroy()` idempotente.
- **Área lógica fija 800×600** con el patrón ya probado en los specs 08 y 09: el canvas llena el CRT y el contexto aplica `ctx.setTransform(dpr * cssW / 800, 0, 0, dpr * cssH / 600, 0, 0)`. El resize solo recalcula ese transform; la geometría del tablero nunca cambia.
- **Tablero fijo** en el espacio lógico. Franja superior `y ∈ [0, 80)` reservada al marcador dibujado en canvas; zona jugable `y ∈ [80, 600)`, 13 filas de 40 px:

  | Fila | `y`     | Tipo     | Contenido                                                      |
  | ---- | ------- | -------- | -------------------------------------------------------------- |
  | 0    | 80–120  | `goal`   | Orilla con 5 nenúfares de 80 px en `x` 40, 190, 340, 490, 640  |
  | 1–5  | 120–320 | `river`  | 5 franjas de troncos, dirección alterna, velocidades distintas |
  | 6    | 320–360 | `median` | Mediana segura                                                 |
  | 7–11 | 360–560 | `road`   | 5 carriles de coches, dirección alterna, velocidades distintas |
  | 12   | 560–600 | `start`  | Berma de salida                                                |

- **Mecánica:** la rana avanza a saltos de una celda (50 px en horizontal, 40 px en vertical) con una animación de `HOP_MS`; durante el salto no se aceptan nuevas pulsaciones. Sobre `road` y `median` la rana está quieta en el suelo; sobre `river` **solo sobrevive montada en un tronco** y se desplaza con él; sobre `goal` solo sobrevive dentro de un nenúfar libre.
- **Muerte** (resta una vida y reinicia el intento en la berma con el reloj a `TIME_LIMIT`): atropello por un coche, caída al agua (sin tronco bajo la rana), arrastre fuera del borde montada en un tronco, choque contra la orilla o contra un nenúfar ya ocupado, y reloj a 0.
- **Reloj de intento:** `TIME_LIMIT = 30 s` que corre solo en `phase === "playing"`, se reinicia en cada muerte y en cada nenúfar alcanzado, y se dibuja como barra en la franja `HEADER_H` del canvas junto a `SCORE`, `NIVEL` y los corazones de vida. **No se publica en `GameState`.**
- **Puntuación:** `+10` la primera vez que el intento alcanza una fila más avanzada que ninguna otra del mismo intento; `+50` al posarse en un nenúfar libre; `+ floor(timeLeft) * 10` de bonus de tiempo en ese mismo momento; `+1000` al ocupar los cinco nenúfares.
- **Progresión:** completar los cinco nenúfares vacía la orilla, sube `level` en 1 y multiplica por `LEVEL_SPEEDUP` la velocidad de todas las filas.
- **Vidas:** `START_LIVES = 3`, publicadas en `lives?`. Sin vidas extra.
- **Controles:** flechas y `WASD`, un salto por pulsación (sin auto-repeat: la tecla debe soltarse). `P` y `Escape` alternan pausa. El `preventDefault` de las flechas ya lo cubre `BLOCKED_KEYS` de `components/GamePlayer.tsx`, con su bypass para campos de formulario.
- **Dibujo con formas y color**, sin assets: no hay sprites de rana ni de coches en el repo y no se inventan. Rana como cuerpo redondeado verde (`--green`) con ojos y patas; coches como rectángulos redondeados con faros, en `--magenta`, `--yellow` y `--cyan` según carril; troncos como rectángulos marrones con vetas; agua y asfalto como bandas de color plano con textura de líneas.
- **Fin de partida:** `DEATH_FLASH` de 350 ms sobre la rana al morir; al agotar la última vida, overlay `GAME OVER` dibujado en canvas ~1.2 s y un único `onGameOver(score)`.
- **`restart()`** reconstruye el `runtime` inicial: rana en la berma (columna central), `score = 0`, `level = 1`, `lives = 3`, nenúfares vacíos, reloj a 30 y velocidades base.
- **Entrada `ranaria`** en `GAME_REGISTRY` (`lib/games/registry.ts`) con `import()` dinámico.
- **Migración `enable_game_ranaria`:** `update public.games set playable = true where id = 'ranaria'` y `delete from public.scores where game_id = 'ranaria'` (los 12 puntajes sembrados del spec 06).
- **Verificación:** `npm run lint`, `npm run build` y prueba manual del recorrido completo en navegador.

**NO incluye (fuera de este spec):**

- Todo lo del `02-ranaria-extension.md`: tortugas sumergibles, cocodrilos, mosca bonus, serpiente de la mediana, rana-dama y el campo opcional `timeLeft?` con su `hud-stat`.
- Cambios en `lib/games/types.ts` y en `components/GamePlayer.tsx`: el 01 no toca el contrato.
- Controles táctiles o por swipe; solo teclado, con el aviso `.keyboard-notice` que ya existe.
- Audio: el vault aún no tiene control de mute.
- Assets en `public/games/ranaria/`: el juego se dibuja íntegramente con formas.
- Repintado de la portada `cover-rana` o cambios en `title`, `short`, `long`, `cat`, `cover`, `color` y `sort_order = 7` de la fila `ranaria`.
- High-score local en `localStorage`: el ranking es el leaderboard de Supabase.
- Tests automatizados (no hay test runner configurado).
- Los demás juegos no jugables del catálogo (`gloton`, `invasores`, `rocas`, `duelo-pixel`), que siguen con el simulador falso.

**Consecuencias aceptadas de este scope:**

- La pestaña `RANARIA` del Hall of Fame pasa de 12 puntajes sembrados a **vacía** hasta que alguien juegue.
- El tiempo restante vive dentro del canvas y no en el HUD React: se ve más pequeño que los demás stats, a cambio de no tocar un archivo compartido por cuatro juegos.
- Con el área lógica fija, en un CRT pequeño el tablero se ve más pequeño en vez de reajustarse: el juego escala, no se rediseña.
- Sin fauna en el río, el nivel 1 es fácil para un jugador experto; la dificultad la aporta el `LEVEL_SPEEDUP` acumulado, no la variedad de obstáculos.
- Un salto por pulsación descarta el avance rápido manteniendo la tecla: es deliberado, evita saltar tres filas seguidas al río sin leer el tráfico.

## Modelo de datos

Este spec no crea tablas nuevas ni extiende el contrato: reusa `public.games` y `public.scores` del spec 06 y actualiza una fila existente. Sí define el estado interno del juego y la mecánica completa, por ser un juego diseñado desde cero.

### Mapeo al `GameState`

| Campo `GameState` | Origen en Ranaria                                                      |
| ----------------- | ---------------------------------------------------------------------- |
| `score`           | `runtime.score` — avance, nenúfares, bonus de tiempo y orilla completa |
| `level`           | `runtime.level` — `1 + travesías completas`                            |
| `lives`           | `runtime.lives` — 3 iniciales                                          |
| `phase`           | `runtime.phase`                                                        |
| `lines`           | **no se publica**                                                      |
| `fruits`          | **no se publica**                                                      |
| `tripleShot`      | `0` fijo (campo obligatorio del contrato, específico de Asteroides)    |

El tiempo restante **no** viaja en `GameState`: se dibuja en la franja `HEADER_H` del canvas. Es la decisión que mantiene este spec dentro del contrato actual.

### Disposición de filas — `lib/games/ranaria/lanes.ts`

```ts
export type LaneKind = "start" | "road" | "median" | "river" | "goal";

export interface LaneDef {
  row: number; // 0 arriba (goal) … 12 abajo (start)
  kind: LaneKind;
  dir: -1 | 0 | 1; // sentido del desplazamiento
  speed: number; // px lógicos/s a nivel 1
  length: number; // ancho de cada coche o tronco, en px lógicos
  gap: number; // separación entre entidades consecutivas
}

export const LANE_LAYOUT: LaneDef[] = [/* 13 entradas, una por fila */];
```

Reparto de velocidades a nivel 1 (px lógicos/s), alternando el sentido fila a fila para que la travesía nunca sea un pasillo recto:

| Filas    | Tipo    | `dir` alterno | `speed`               | `length` | `gap`   |
| -------- | ------- | ------------- | --------------------- | -------- | ------- |
| 1–5      | `river` | +1 / −1       | 55, 75, 45, 90, 65    | 150–250  | 120–180 |
| 7–11     | `road`  | −1 / +1       | 90, 120, 70, 150, 100 | 60–90    | 130–200 |
| 0, 6, 12 | resto   | 0             | —                     | —        | —       |

Las entidades de una fila se generan equiespaciadas (`length + gap`) y se envuelven en horizontal: al salir por un borde reaparecen por el opuesto. No hay spawn aleatorio, de modo que el tráfico es determinista y aprendible — que es lo que hace justo el reloj.

### Estado interno — `lib/games/ranaria/game.ts`

No se exporta. Todo vive en el espacio lógico 800×600; `cssW` / `cssH` solo alimentan el transform del canvas y nunca entran en la lógica.

```ts
interface LaneEntity {
  x: number; // borde izquierdo, px lógicos
  width: number;
}

interface Lane {
  def: LaneDef;
  entities: LaneEntity[];
  speed: number; // def.speed * LEVEL_SPEEDUP ** (level - 1)
}

interface RanariaRuntime {
  lanes: Lane[]; // 13, en el orden de LANE_LAYOUT
  frogCol: number; // 0–15, columna lógica de destino del salto
  frogRow: number; // 0–12
  frogX: number; // px lógicos: posición real, desplazada por el tronco
  frogY: number;
  hopFrom: { x: number; y: number } | null; // origen de la animación de salto
  hopT: number; // ms transcurridos del salto, 0…HOP_MS
  ridingLog: LaneEntity | null; // tronco bajo la rana, o null
  bestRow: number; // fila más avanzada alcanzada en el intento, para el +10
  pads: boolean[]; // 5 nenúfares: true = ocupado
  score: number;
  level: number;
  lives: number;
  timeLeft: number; // s, de TIME_LIMIT a 0
  phase: GamePhase;
  prevPhase: GamePhase; // fase previa a la pausa
  deathFlash: number; // ms restantes de parpadeo, 0 si no aplica
  gameOverTimer: number; // ms de overlay antes de onGameOver
  keyHeld: Set<string>; // teclas ya consumidas: un salto por pulsación
  stateAccum: number; // acumulador de la emisión de onState
  lastTime: number | null; // null tras resume() para no arrastrar dt
  cssW: number;
  cssH: number;
}
```

### Mecánica (juego diseñado desde cero)

- **Inicio del intento:** rana en la fila 12, columna 8 (centro), `timeLeft = TIME_LIMIT`, `bestRow = 12`, `ridingLog = null`.
- **Salto:** una pulsación válida fija `frogCol` / `frogRow` destino, guarda `hopFrom` y arranca `hopT`. Durante `HOP_MS` la rana interpola su posición y **es invulnerable a nada**: la colisión se evalúa solo al aterrizar (evita la muerte "a medio salto", injusta y difícil de leer). Un salto fuera del tablero por los laterales o hacia abajo desde la berma se ignora.
- **Aterrizaje en `road`:** si el rectángulo de la rana solapa el de un coche de esa fila → muerte.
- **Aterrizaje en `river`:** se busca el tronco de la fila cuyo rectángulo contiene el centro de la rana. Si no hay ninguno → muerte por agua. Si lo hay, `ridingLog` pasa a ese tronco y a partir de ahí `frogX += speed * dir * dt` cada frame. Si `frogX` sale del área jugable en horizontal → muerte por arrastre.
- **Aterrizaje en `goal`:** si el centro de la rana cae dentro de un nenúfar libre → `pads[i] = true`, `+50`, `+ floor(timeLeft) * 10`, la rana vuelve a la berma con el reloj a `TIME_LIMIT` y `bestRow = 12`. Si cae sobre orilla o sobre nenúfar ocupado → muerte.
- **Avance:** al aterrizar en una fila con índice menor que `bestRow`, `score += 10` y `bestRow` se actualiza. Retroceder no resta ni vuelve a puntuar.
- **Orilla completa:** con los 5 nenúfares ocupados, `score += 1000`, `level += 1`, `pads` se vacían y cada `lane.speed` se recalcula como `def.speed * LEVEL_SPEEDUP ** (level - 1)`.
- **Reloj:** `timeLeft -= dt` solo en `phase === "playing"`. A 0 → muerte por tiempo.
- **Muerte:** `lives -= 1`, `phase = "dead"`, `deathFlash = 350`. Con `lives > 0` se reinicia el intento; con `lives === 0` se entra en el overlay `GAME OVER` durante `GAME_OVER_DELAY` y se emite un único `onGameOver(score)`.
- **Victoria:** no hay. La partida termina siempre por vidas agotadas o por el botón `FIN`.

### Marcador dibujado en canvas — franja `y ∈ [0, 80)`

- `SCORE` a la izquierda, `NIVEL` en el centro, corazones de vida a la derecha (redundan con el HUD React a propósito: el jugador mira el canvas).
- **Barra de tiempo** de 800 px de ancho y 10 px de alto en `y = 70`: se vacía de derecha a izquierda, verde por encima de 10 s, amarilla entre 10 y 5, magenta parpadeante por debajo de 5.

### Registry — `lib/games/registry.ts`

```ts
ranaria: async () => (await import("./ranaria/game")).createRanariaGame,
```

### Fila en `games` — migración `enable_game_ranaria`

La fila ya existe desde el spec 06 con `playable = false`, `cover-rana`, color `green`, `cat` `ARCADE` y `sort_order = 7`, y su `long` ya describe exactamente esta mecánica. No se inserta: se habilita y se vacían sus puntajes sembrados.

```sql
update public.games set playable = true where id = 'ranaria';
delete from public.scores where game_id = 'ranaria';
```

Sin filas en `scores`, el juego arranca vacío y solo acumula partidas reales. `title` (`RANARIA`), `short`, `long`, `cat`, `cover`, `color` y `sort_order` no se tocan, y `select count(*) from games` sigue devolviendo 9.

## Plan de implementación

Cada paso deja el repo compilando (`npm run build` verde). El juego no aparece como jugable hasta el paso 9.

1. **Consultar la doc vendored.** Repasar en `node_modules/next/dist/docs/` lo relativo a componentes cliente y `import()` dinámico antes de escribir código. No se añaden rutas ni assets, así que no hay más superficie de framework que la del registry.
2. **Constantes.** `lib/games/ranaria/constants.ts` con la geometría del tablero, los tiempos y los multiplicadores de la tabla anterior.
3. **Filas.** `lib/games/ranaria/lanes.ts` con `LaneDef`, `LaneKind` y las 13 entradas de `LANE_LAYOUT` con las velocidades, longitudes y separaciones de la tabla.
4. **Entidades.** `lib/games/ranaria/entities.ts`: `Car` y `Log` con `update(dt, speed, dir)` y envolvimiento horizontal, `draw(ctx)` con formas; `Frog` con la interpolación de salto, el parpadeo de muerte y su dibujo. Sin estado de módulo.
5. **Factory.** `lib/games/ranaria/game.ts` — `createRanariaGame(opts)`: objeto `runtime` local, loop `requestAnimationFrame` con `dt` capado a 0.05 s, orden `update → draw → publishState`. Dibujo del tablero (bandas), de las entidades, de la rana y del marcador de la franja superior. En este punto el juego ya es jugable montándolo a mano, pero aún no está registrado.
6. **Colisiones y reglas.** Aterrizaje por tipo de fila, montar tronco, arrastre fuera de borde, nenúfares, `bestRow`, puntuación, orilla completa y subida de nivel con `LEVEL_SPEEDUP`.
7. **Reloj y vidas.** Descuento de `timeLeft`, muerte por tiempo, `deathFlash`, reinicio del intento, `lives` y camino único a `GAME OVER` con guard de un solo `onGameOver`. `end()` (botón FIN) entra por ese mismo camino. `restart()` reconstruye el `runtime` inicial.
8. **Controles y pausa.** Listener de teclado atado a la instancia: flechas y `WASD` con un salto por pulsación mediante `keyHeld` (`keydown` añade, `keyup` quita); `P` y `Escape` alternan pausa guardando `prevPhase` y poniendo `lastTime = null` al reanudar.
9. **Canvas responsive.** `measure()` con `getBoundingClientRect()`, `applyResize()` que fija `canvas.width/height = cssSize * devicePixelRatio` y aplica `ctx.setTransform(dpr * cssW / 800, 0, 0, dpr * cssH / 600, 0, 0)`, disparado por un `ResizeObserver` sobre el canvas. El tablero no se recalcula: solo el transform.
10. **`onState` y limpieza.** Emisión cada `STATE_INTERVAL` (0.1 s) más emisión inmediata al cambiar `phase`, `level` o `lives`. `destroy()` idempotente: flag `destroyed`, `cancelAnimationFrame`, `observer.disconnect()` y `removeEventListener` de `keydown` y `keyup`.
11. **Registry.** Añadir la línea `ranaria` a `GAME_REGISTRY` en `lib/games/registry.ts`. Desde aquí `/game/ranaria/play` monta el juego real en vez del simulador.
12. **Migración.** Aplicar `enable_game_ranaria` con `mcp__supabase__apply_migration` (`update ... playable = true` + `delete from scores`). Verificar con `mcp__supabase__execute_sql`: `playable = true` en la fila `ranaria`, `count(*) = 0` en sus `scores`, `count(*) = 9` en `games`, y `mcp__supabase__get_advisors` sin hallazgos nuevos. No hace falta regenerar `lib/supabase/database.types.ts`: el schema no cambia.
13. **Verificación.** `npm run lint`, `npm run build` y prueba manual: cruzar hasta un nenúfar, completar la orilla y ver subir el nivel, morir por coche, por agua, por arrastre y por tiempo, pausar con botón y con teclas, redimensionar en partida, guardar el puntaje en el modal y volver a entrar a la ruta comprobando que el loop no se duplica en dev.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] `lib/games/ranaria/` no tiene variables de módulo mutables ni escribe en `window`: dos instancias del juego coexisten sin interferirse.
- [ ] `/game/ranaria/play` monta un `<canvas>` dentro del CRT y las flechas y `WASD` mueven la rana una celda por pulsación.
- [ ] Mantener pulsada una flecha produce **un solo** salto; hay que soltarla y volver a pulsar para el siguiente.
- [ ] Aterrizar sobre un coche resta una vida; aterrizar en el río fuera de un tronco resta una vida.
- [ ] Aterrizar sobre un tronco engancha la rana al tronco: la rana se desplaza con él y muere si el tronco la saca por el borde lateral.
- [ ] Llegar a un nenúfar libre suma 50 puntos más `floor(timeLeft) * 10`, marca ese nenúfar como ocupado y devuelve la rana a la berma con el reloj a 30 s.
- [ ] Aterrizar sobre un nenúfar ya ocupado o sobre la orilla entre nenúfares resta una vida.
- [ ] Alcanzar una fila más avanzada que ninguna otra del intento suma 10 puntos; volver a esa fila en el mismo intento no vuelve a sumar.
- [ ] Ocupar los cinco nenúfares suma 1000 puntos, vacía la orilla, sube `NIVEL` en 1 y hace visiblemente más rápidos coches y troncos.
- [ ] La barra de tiempo del canvas se vacía durante la partida, se congela en `PAUSA` y llegar a 0 resta una vida y reinicia el intento.
- [ ] El HUD muestra Puntuación, Vidas y Nivel con los valores del juego (no del simulador falso), y **no** muestra los stats de líneas ni de frutas.
- [ ] `GameState` publicado por Ranaria no incluye ningún campo que no exista hoy en `lib/games/types.ts`; ni `types.ts` ni `components/GamePlayer.tsx` han sido modificados por este spec.
- [ ] `PAUSA` congela tablero y reloj, y `REANUDAR` continúa sin salto de posición (sin `dt` acumulado); `P` y `Escape` alternan igual que el botón.
- [ ] `FIN` termina la partida y abre el modal con el puntaje actual.
- [ ] Agotar la tercera vida muestra el parpadeo (~350 ms), el overlay `GAME OVER` en canvas (~1,2 s) y después el modal, con un solo `onGameOver`.
- [ ] `JUGAR DE NUEVO` reinicia con rana en la berma, `score` 0, `NIVEL` 1, 3 vidas, nenúfares vacíos y velocidades base.
- [ ] Guardar en el modal hace `POST /api/scores` y devuelve el puesto obtenido.
- [ ] `select playable from games where id = 'ranaria'` devuelve `true`, `select count(*) from scores where game_id = 'ranaria'` devuelve `0` antes de la primera partida y `select count(*) from games` sigue en 9.
- [ ] `title`, `short`, `long`, `cat`, `cover`, `color` y `sort_order = 7` de la fila `ranaria` no han cambiado.
- [ ] Ranaria aparece como jugable en Home, Biblioteca y `/game/ranaria`, y su pestaña del Hall of Fame muestra el estado vacío sin romper hasta la primera partida guardada.
- [ ] Redimensionar durante la partida mantiene la relación 4:3, no deforma el tablero y no altera la posición lógica de la rana, los coches ni los troncos.
- [ ] El canvas se ve nítido con `devicePixelRatio > 1`.
- [ ] Las flechas y `Space` no scrollean la página durante la partida, y el input de iniciales del modal sigue aceptando texto.
- [ ] `SALIR` o navegar fuera detiene el loop y quita listeners y `ResizeObserver`; volver a entrar no lo duplica (verificado en dev con React Strict Mode).
- [ ] Asteroides, Caída, Bloque Buster y Serpentina siguen funcionando igual.
- [ ] Los juegos no jugables (`gloton`, `invasores`, `rocas`, `duelo-pixel`) siguen mostrando el simulador falso sin cambios.

## Decisiones tomadas y descartadas

- **Reusar la fila `ranaria` en vez de crear un id nuevo.** La fila existe desde el spec 06 con su portada `cover-rana`, su color verde y un `long` que ya describe esta mecánica al pie de la letra. Se descartan `rana` y `travesia`: crearían un duplicado en el catálogo y obligarían a una clase `cover-*` nueva sin ganar nada. Contrapartida: hay que borrar sus 12 puntajes sembrados.
- **El tiempo restante se dibuja en el canvas, no en el HUD React.** Se descarta añadir `timeLeft?: number` a `GameState` en este spec — es justo el coste de contrato que dejó a Ranaria fuera de la cola en `references/game-suggestion.-todo.md`. Al bajar el reloj al canvas, el 01 entra **tal cual** en el contrato actual y el campo opcional se aplaza al 02, donde es el cambio principal y no un peaje.
- **Colisión evaluada solo al aterrizar, no durante el salto.** Se descarta la colisión continua contra el rectángulo interpolado: hace que la rana muera "en el aire" contra un coche que ya pasó, un resultado que el jugador no puede leer ni prevenir. Coste aceptado: se puede saltar por encima de un coche que ocupa la celda de origen.
- **Tráfico determinista y equiespaciado, sin spawn aleatorio.** Se descarta generar coches con separación aleatoria: con un reloj de 30 s, una racha desafortunada convierte un intento en imposible y el puntaje deja de medir habilidad. Coste: los patrones se memorizan, mitigado por el `LEVEL_SPEEDUP` que los reordena en fase.
- **Reloj de 30 s por intento, reiniciado en cada nenúfar y en cada muerte.** Se descarta un reloj único de partida (convierte el juego en contrarreloj puro y castiga aprender) y se descarta que el reloj no se reinicie al morir (encadenaría muertes irrecuperables).
- **Bonus de tiempo `floor(timeLeft) * 10` al llegar al nenúfar.** Se descarta puntuar el tiempo restante al final de la partida: no sería atribuible a ninguna travesía concreta y premiaría no jugar. Con esta fórmula el reloj es parte del score, que es exactamente el tema del jam.
- **Cinco carriles y cinco franjas de río.** Se descarta la versión reducida de tres y tres: cabe en el tablero, pero deja una travesía de 8 filas que se cruza casi de un tirón y no sostiene un reloj de 30 s.
- **Área lógica fija 800×600 con transform de escala.** Se descarta el letterbox (franjas negras) y recalcular el tablero al redimensionar (cambiaría el número de carriles en mitad de la partida, alterando dificultad y puntajes). Mismo patrón ya aprobado en los specs 08 y 09.
- **Tres vidas con `lives?` publicado.** Se descarta la vida única: con muerte instantánea por coche, una sola vida hace la partida demasiado corta para los 2–5 min que pide el leaderboard. Se descartan también las vidas extra por puntuación, que harían las partidas ilimitadas.
- **Dibujo con formas, sin assets.** No hay sprites de rana, coche ni tronco en `references/`, y el spec no inventa archivos. Se descarta generar arte nuevo: la paleta neón del vault (`--green`, `--magenta`, `--cyan`, `--yellow`) sostiene el tablero perfectamente.
- **Un salto por pulsación, sin auto-repeat.** Se descarta el avance mantenido: dejaría cruzar el río de un tirón sin leer el tráfico y volvería trivial el nivel 1.
- **Sin audio.** Se descarta añadir sonidos: el vault no tiene control de mute (fuera de scope desde el spec 08).

## Riesgos identificados

- **El canvas responsive altera el balance calibrado en píxeles.** Las velocidades de la tabla están en px lógicos/s sobre 800×600. Mitigación: toda la lógica vive en el espacio lógico fijo y el escalado es un puro `setTransform`; el balance no depende del tamaño en pantalla. Criterio de aceptación explícito.
- **El reescalado al redimensionar puede dejar entidades en estado inválido.** Si el resize tocara la geometría, la rana montada en un tronco podría quedar fuera del tablero. Mitigación: `applyResize()` solo recalcula el transform y `cssW`/`cssH`; ni coches, ni troncos, ni rana leen esos valores.
- **React Strict Mode monta dos veces en dev.** Con `destroy()` incompleto quedarían dos loops: el tráfico correría al doble y el reloj se vaciaría en 15 s. Mitigación: `destroy()` idempotente con flag `destroyed` que cancela `rAF`, desconecta el `ResizeObserver` y quita `keydown` y `keyup`; criterio de aceptación propio.
- **El `preventDefault` global secuestra el teclado.** Si el listener sobrevive a la ruta o captura el input del modal, no se pueden escribir las iniciales. Mitigación: listener atado a la instancia y bypass de `BLOCKED_KEYS` en campos de formulario, ya existente en `components/GamePlayer.tsx`.
- **La rana montada en un tronco puede acumular error de posición.** `frogX` se integra frame a frame con `speed * dir * dt`; tras muchos segundos podría desalinearse de la columna lógica. Mitigación: `frogCol` se recalcula desde `frogX` en cada aterrizaje, de modo que el error no se propaga entre filas. Riesgo residual aceptado dentro de una misma fila.
- **Con `dt` capado a 0,05 s, un frame largo puede tunelar un coche a través de la rana.** A 150 px/s el desplazamiento máximo por frame es 7,5 px, muy por debajo del ancho de un coche (60 px). Mitigación: el cap ya lo cubre; no hace falta colisión por barrido. Riesgo residual aceptado.
- **El reloj de 30 s puede resultar injusto en los niveles altos.** Con `LEVEL_SPEEDUP ** (level - 1)`, hacia el nivel 6 las velocidades se han triplicado y la travesía puede volverse imposible dentro del reloj. Mitigación: el multiplicador es una constante en `constants.ts`, ajustable en la prueba manual; si hace falta, techo de velocidad en el 02.
- **`bestRow` premia el zigzag involuntario.** Un jugador podría subir y bajar buscando puntos; no puede, porque el `+10` es por fila nueva del intento. Riesgo descartado por diseño, se documenta para que la implementación no lo convierta en `+10` por cada avance.
- **Borrar los 12 puntajes sembrados es irreversible.** Mitigación: son datos de siembra del spec 06, no partidas reales; el `delete` está acotado por `game_id = 'ranaria'` y se verifica el `count(*)` después.

## Qué **no** está en este spec

- La fauna del río y de la orilla (tortugas sumergibles, cocodrilos), la mosca bonus, la serpiente de la mediana y la rana-dama: todo eso es `02-ranaria-extension.md`.
- El campo opcional `timeLeft?` en `GameState`, su `hud-stat` en `components/GamePlayer.tsx` y su clase en `app/globals.css`: también son del 02.
- Los otros dos juegos del jam (`garfio` y `agujas`), cada uno con su carpeta en `specs/game-jam/`.
- Cualquier cambio en el reproductor, en el endpoint `POST /api/scores`, en las consultas de `lib/queries.ts` o en el schema de Supabase.
- Audio, controles táctiles, dificultad seleccionable y persistencia local.
