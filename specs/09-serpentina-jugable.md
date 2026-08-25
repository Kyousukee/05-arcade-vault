# Spec 09 — Serpentina (Snake) jugable

**Estado:** aprobado
**Depende de:** 05-asteroides-jugable, 06-juegos-y-leaderboard
**Fecha:** 2026-08-24

**Objetivo:** Diseñar desde cero un Snake en TypeScript bajo el contrato `GameFactory`, con las frutas del atlas de `references/source-assets/snake-assets/`, registrarlo como `serpentina` y marcar esa fila de `games` como jugable para que compita en el leaderboard con puntajes reales.

> Es el primer juego del vault **sin fuente en `references/started-games/`**: no hay portado, solo un atlas de sprites (`fruits.png` + coordenadas) y una mecánica definida en este spec. Se apoya en el contrato del registry y el reproductor del spec 05 (`lib/games/types.ts`, `lib/games/registry.ts`, `components/GamePlayer.tsx`) y en las tablas `games` / `scores` y el endpoint `POST /api/scores` del spec 06. Reusa el área lógica fija 800×600 y su transform de escala, ya probados en el spec 08.

## Alcance

**Incluye:**

- **Juego nuevo en TypeScript** en `lib/games/snake/`, sin globals de módulo:
  - `constants.ts` — `LOGICAL_W = 800`, `LOGICAL_H = 600`, `COLS = 32`, `ROWS = 24`, `CELL = 25`, `START_LENGTH = 3`, `TICK_BASE = 140` (ms), `TICK_MIN = 60`, `TICK_STEP = 10`, `FRUITS_PER_LEVEL = 5`, `DEATH_FLASH = 200` (ms), `GAME_OVER_DELAY = 1200`, `STATE_INTERVAL = 0.1`.
  - `sprites.ts` — `FRUIT_SPRITES`: las 22 frutas del atlas transcritas desde `references/source-assets/snake-assets/snake-assets/sprites.js` (`{ x, y, w, h }`) más su `tier` y su `points`; `FRUIT_SOURCE = "/games/serpentina/fruits.png"`; `loadFruitSheet(): Promise<CanvasImageSource>` **por instancia** (nada de `window.SPRITE_ATLAS` ni de globals tipo `ssImg` / `ssLoaded`).
  - `snake.ts` — la serpiente como lista de celdas con `step()`, `grow()`, `collides()` y su dibujo (celdas redondeadas, cabeza más clara con ojos, degradado hacia la cola).
  - `game.ts` — `createSerpentinaGame(opts)`: estado en un objeto `runtime` local a la factory, acumulador de tick sobre `requestAnimationFrame`, listeners de teclado, `ResizeObserver` y `destroy()` idempotente.
- **Área lógica fija 800×600** (grid 32×24 de celdas de 25 px): el canvas llena el CRT y el contexto aplica `ctx.setTransform(dpr * cssW / 800, 0, 0, dpr * cssH / 600, 0, 0)`. El resize solo recalcula ese transform; la geometría del grid nunca cambia.
- **Mecánica:** movimiento por celdas a intervalo fijo; comer fruta alarga la serpiente y suma `points × level`; chocar contra una pared o contra el propio cuerpo termina la partida (sin vidas); cada 5 frutas sube `level` y el tick baja 10 ms hasta `TICK_MIN`.
- **Frutas:** spawn en celda libre aleatoria, tipo elegido por peso 70 % común (10 pts), 25 % mediana (25 pts), 5 % grande (50 pts); dibujo con relación de aspecto conservada a ~90 % del alto de la celda, centrado; fallback a círculo de color si el PNG no carga.
- **Asset a `public/`**: `public/games/serpentina/fruits.png`, referenciado por ruta absoluta desde la raíz del sitio.
- **Controles:** flechas y `WASD`; giro de 180° prohibido; se encola **un solo** giro por tick. `P` y `Escape` alternan pausa. El `preventDefault` de las flechas ya lo cubre `BLOCKED_KEYS` de `components/GamePlayer.tsx`, con su bypass para campos de formulario.
- **Extensión del contrato:** campo opcional `fruits?: number` en `lib/games/types.ts` y un `hud-stat` nuevo (`FRUTAS`) en `components/GamePlayer.tsx`, visible solo cuando el juego lo publica.
- **Fin de partida:** ~200 ms de parpadeo de la serpiente en rojo, overlay `GAME OVER` dibujado en canvas ~1.2 s y un único `onGameOver(score)`.
- **`restart()`** vuelve a serpiente de 3 segmentos en el centro mirando a la derecha, con `score = 0`, `level = 1`, `fruits = 0` y `TICK_BASE`.
- **Entrada `serpentina`** en `GAME_REGISTRY` (`lib/games/registry.ts`) con `import()` dinámico.
- **Migración `enable_game_serpentina`:** `update public.games set playable = true where id = 'serpentina'` y `delete from public.scores where game_id = 'serpentina'` (los 12 puntajes sembrados del spec 06).
- **Verificación:** `npm run lint`, `npm run build` y prueba manual del recorrido completo en navegador.

**NO incluye (fuera de este spec):**

- Controles táctiles o por swipe en móvil — solo teclado, con el aviso `.keyboard-notice` que ya existe.
- Audio: el atlas no trae sonidos y no se añaden.
- Modo _wrap_ (atravesar paredes) como variante o dificultad seleccionable.
- Obstáculos, muros o mapas por nivel: la progresión es solo velocidad.
- Power-ups, frutas con efecto (ralentizar, encoger) y frutas con caducidad.
- High-score local en `localStorage`: el ranking es el leaderboard de Supabase.
- Recortar o reoptimizar `fruits.png`, y usar las filas del atlas distintas de `y=136–295`.
- Repintado de la portada `cover-snake` o cambios en `title`, `short`, `long`, `cover`, `color` y `sort_order = 2` de la fila `serpentina`.
- Tests automatizados (no hay test runner configurado).
- Los demás juegos no jugables del catálogo (`gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`), que siguen con el simulador falso.

**Consecuencias aceptadas de este scope:**

- La pestaña `SERPENTINA` del Hall of Fame pasa de 12 puntajes sembrados a **vacía** hasta que alguien juegue.
- `fruits.png` se sirve entero (585 KB) aunque solo se use una fila del atlas; se acepta a cambio de no tocar el asset original.
- Con el área lógica fija, en un CRT pequeño el grid se ve más pequeño en vez de reajustarse: el juego escala, no se rediseña.
- Sin muros ni obstáculos, un jugador muy bueno solo muere por su propio cuerpo; la partida larga la acota el `TICK_MIN` de 60 ms.
- Encolar un único giro por tick descarta pulsaciones muy rápidas: es deliberado, evita el suicidio por doble giro dentro del mismo tick.

## Modelo de datos

Este spec no crea tablas nuevas: reusa `public.games` y `public.scores` del spec 06 y actualiza una fila existente. Sí extiende el contrato compartido con un campo opcional y define el estado interno del juego, el atlas de frutas y la mecánica completa.

### Extensión del contrato — `lib/games/types.ts`

Se añade **un** campo opcional. Ni `lives?` ni `lines?` encajan: Serpentina no tiene vidas ni líneas, y reinterpretar `lines?` haría que el HUD mostrara «LÍNEAS» para frutas.

```ts
export interface GameState {
  score: number;
  level: number;
  phase: GamePhase;
  lives?: number;
  lines?: number;
  /** Frutas comidas en la partida. Solo lo publican los juegos que las cuentan (Serpentina). */
  fruits?: number;
  tripleShot: number;
}
```

En `components/GamePlayer.tsx` se añade un `hud-stat` análogo al de `lines`, renderizado solo cuando `state.fruits !== undefined`:

```tsx
{
  state.fruits !== undefined && (
    <div className="hud-stat fruits">
      <span className="hud-label">FRUTAS</span>
      <span className="hud-value">{state.fruits}</span>
    </div>
  );
}
```

La clase `.hud-stat.fruits` se define en `app/globals.css` junto a `.lines`, con el verde del juego (`var(--green)`).

### Mapeo al `GameState`

| Campo `GameState` | Origen en Serpentina                                     |
| ----------------- | -------------------------------------------------------- |
| `score`           | `runtime.score` — suma de `points × level` por fruta     |
| `level`           | `runtime.level` — `1 + floor(fruits / 5)`                |
| `fruits`          | `runtime.fruits` — frutas comidas                        |
| `phase`           | `runtime.phase`                                          |
| `lives`           | **no se publica** (el HUD oculta el stat)                |
| `lines`           | **no se publica**                                        |
| `tripleShot`      | `0` fijo (campo obligatorio del contrato, de Asteroides) |

### Estado interno — `lib/games/snake/game.ts`

No se exporta. Todo el juego vive en el **espacio lógico 800×600** / grid 32×24; `cssW` / `cssH` solo alimentan el transform del canvas y nunca entran en la lógica.

```ts
type Dir = "up" | "down" | "left" | "right";

interface Cell {
  col: number; // 0–31
  row: number; // 0–23
}

interface Fruit extends Cell {
  kind: FruitKind; // clave de FRUIT_SPRITES
}

interface SnakeRuntime {
  /** Celdas del cuerpo, índice 0 = cabeza. */
  body: Cell[];
  dir: Dir; // dirección aplicada en el último tick
  nextDir: Dir; // giro encolado; a lo sumo uno por tick
  fruit: Fruit;
  score: number;
  fruits: number;
  level: number; // 1 + floor(fruits / FRUITS_PER_LEVEL)
  tickMs: number; // max(TICK_MIN, TICK_BASE - (level - 1) * TICK_STEP)
  tickAccum: number; // ms acumulados desde el último paso
  phase: GamePhase;
  prevPhase: GamePhase; // fase previa a la pausa
  deathFlash: number; // ms restantes de parpadeo rojo, 0 si no aplica
  gameOverTimer: number; // ms de overlay antes de onGameOver
  sheet: CanvasImageSource | null; // null hasta que resuelve el PNG (o si falla)
  stateAccum: number; // acumulador de la emisión de onState
  lastTime: number | null; // null tras resume() para no arrastrar dt
  cssW: number;
  cssH: number;
}
```

### Atlas de frutas — `lib/games/snake/sprites.ts`

Transcripción de `sprites.js` (fila `y = 136`, alto 160) más `tier` y `points`. El módulo exporta datos, no toca `window`.

```ts
export type FruitTier = "common" | "mid" | "big";

export interface FruitSprite {
  x: number;
  y: number;
  w: number;
  h: number; // recorte en fruits.png
  tier: FruitTier;
  points: number;
  color: string; // fallback si el PNG no carga
}

export const FRUIT_SOURCE = "/games/serpentina/fruits.png";
export const FRUIT_SPRITES: Record<string, FruitSprite> = {/* 22 entradas */};
```

Reparto por tramo (los 22 tipos, sin dejar ninguno fuera):

| Tramo    | Puntos | Peso | Frutas                                                                                   |
| -------- | ------ | ---- | ---------------------------------------------------------------------------------------- |
| `common` | 10     | 70 % | apple, cherry, strawberry, tomato, orange, lemon, peach, banana, grape, grapes2, berries |
| `mid`    | 25     | 25 % | kiwi, mushroom, carrot, broccoli, peanut, pepper, garlic                                 |
| `big`    | 50     | 5 %  | watermelon, pineapple, melon, eggplant                                                   |

El puntaje que suma una fruta es `points × level`. El tramo se sortea por peso y dentro del tramo el tipo es uniforme. Dibujo: escala `min(CELL * 0.9 / h, CELL * 0.9 / w)` sobre el recorte, centrado en la celda — conserva la relación de aspecto de las alargadas (banana, kiwi).

### Mecánica (juego diseñado desde cero)

- **Inicio:** 3 celdas horizontales centradas en el grid (`col 15–13`, `row 12`), `dir = "right"`, una fruta en celda libre aleatoria.
- **Tick:** cada `tickMs` la cabeza avanza una celda en `nextDir` (que pasa a ser `dir`); la cola se elimina salvo que se haya comido.
- **Giro:** una tecla solo actualiza `nextDir` si no es la opuesta a `dir`; una segunda pulsación dentro del mismo tick se ignora.
- **Comer:** cabeza sobre la fruta → `fruits++`, `score += points * level`, la cola no se elimina (crece 1), se recalculan `level` y `tickMs`, y aparece una fruta nueva en una celda libre.
- **Muerte:** cabeza fuera del grid (`col < 0 || col >= COLS || row < 0 || row >= ROWS`) o sobre una celda del cuerpo → `phase = "dead"`, `deathFlash = 200`, luego overlay `GAME OVER` durante `GAME_OVER_DELAY` y un único `onGameOver(score)`.
- **Victoria:** no hay. La partida termina siempre por muerte o por el botón `FIN`.

### Registry — `lib/games/registry.ts`

```ts
serpentina: async () => (await import("./snake/game")).createSerpentinaGame,
```

### Fila en `games` — migración `enable_game_serpentina`

La fila ya existe (spec 06). No se inserta: se habilita y se vacían sus puntajes sembrados.

```sql
update public.games set playable = true where id = 'serpentina';
delete from public.scores where game_id = 'serpentina';
```

Sin filas en `scores`, el juego arranca vacío y solo acumula partidas reales. `title` (`SERPENTINA`), `cat` (`ARCADE`), `cover` (`cover-snake`), `color` (`green`) y `sort_order` (`2`) no se tocan.

## Plan de implementación

Cada paso deja el repo compilando (`npm run build` verde). El juego no aparece como jugable hasta el paso 13.

1. **Consultar la doc vendored.** Repasar en `node_modules/next/dist/docs/` lo relativo a assets estáticos en `public/` y a componentes cliente antes de escribir código.
2. **Asset.** Copiar `references/source-assets/snake-assets/snake-assets/fruits.png` a `public/games/serpentina/fruits.png`. `sprites.js` **no se copia**.
3. **Contrato.** Añadir `fruits?: number` a `GameState` en `lib/games/types.ts`. Nada más cambia todavía: el campo opcional no rompe Asteroides, Caída ni Bloque Buster.
4. **Constantes.** `lib/games/snake/constants.ts` con la geometría del grid, los tiempos de tick, el reparto de niveles y los temporizadores de muerte/overlay.
5. **Atlas.** `lib/games/snake/sprites.ts`: transcribir las 22 frutas de `sprites.js` con su `tier`, `points` y `color` de fallback; `FRUIT_SOURCE`; `loadFruitSheet()` que devuelve una `Promise` por llamada y resuelve a `null` si el PNG falla.
6. **Serpiente.** `lib/games/snake/snake.ts`: creación inicial, `step(dir, grow)`, `hitsWall()`, `hitsSelf()`, `occupies(cell)` y `draw(ctx, flashing)` con la cabeza más clara, los ojos y el degradado hacia la cola. Sin estado de módulo.
7. **Factory.** `lib/games/snake/game.ts` — `createSerpentinaGame(opts)`: objeto `runtime` local, loop `requestAnimationFrame` con `dt` capado a 0.05 s, acumulador `tickAccum` que dispara el paso cada `tickMs`, orden `update → draw → publishState`. Dibujo del fondo del grid, la fruta y la serpiente. En este punto el juego ya es jugable montándolo a mano, pero aún no está registrado.
8. **Fruta y progresión.** Spawn ponderado en celda libre (rechazo sobre celdas ocupadas por el cuerpo), suma `points × level`, recálculo de `level` y `tickMs`.
9. **Controles y pausa.** Listener de teclado atado a la instancia: flechas y `WASD` con bloqueo del giro de 180° y un único giro encolado por tick; `P` y `Escape` alternan pausa guardando `prevPhase` y poniendo `lastTime = null` al reanudar.
10. **Fin de partida.** `deathFlash` de 200 ms, overlay `GAME OVER` en canvas durante `GAME_OVER_DELAY` y un único `onGameOver(score)` con guard. `end()` (botón FIN) entra por el mismo camino. `restart()` reconstruye el `runtime` inicial.
11. **Canvas responsive.** `measure()` con `getBoundingClientRect()`, `applyResize()` que fija `canvas.width/height = cssSize * devicePixelRatio` y aplica `ctx.setTransform(dpr * cssW / 800, 0, 0, dpr * cssH / 600, 0, 0)`, disparado por un `ResizeObserver` sobre el canvas. El grid no se recalcula: solo el transform.
12. **`onState`.** Emisión cada `STATE_INTERVAL` (0.1 s) más emisión inmediata al cambiar `phase`, `level` o `fruits`. `destroy()` idempotente: flag `destroyed`, `cancelAnimationFrame`, `observer.disconnect()` y `removeEventListener`.
13. **Registry.** Añadir la línea `serpentina` a `GAME_REGISTRY` en `lib/games/registry.ts`. Desde aquí `/game/serpentina/play` monta el juego real.
14. **HUD.** Añadir el `hud-stat` `FRUTAS` en `components/GamePlayer.tsx` (condicionado a `state.fruits !== undefined`) y la clase `.hud-stat.fruits` en `app/globals.css` junto a `.lines`.
15. **Migración.** Aplicar `enable_game_serpentina` con `mcp__supabase__apply_migration` (`update ... playable = true` + `delete from scores`). Verificar con `mcp__supabase__execute_sql`: `playable = true` en la fila `serpentina`, `count(*) = 0` en sus `scores`, y `mcp__supabase__get_advisors` sin hallazgos nuevos. No hace falta regenerar `lib/supabase/database.types.ts`: el schema no cambia.
16. **Verificación.** `npm run lint`, `npm run build` y prueba manual: jugar, comer varias frutas hasta subir de nivel, pausar con botón y con teclas, redimensionar la ventana en partida, morir contra pared y contra el cuerpo, guardar el puntaje en el modal, y volver a entrar a la ruta comprobando que no se duplica el loop en dev.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] `lib/games/snake/` no tiene variables de módulo mutables ni escribe en `window`: dos instancias del juego coexisten sin interferirse.
- [ ] `/game/serpentina/play` monta un `<canvas>` dentro del CRT y la serpiente responde a flechas y a `WASD`.
- [ ] Pulsar la dirección opuesta a la actual no invierte la serpiente sobre sí misma, y dos giros dentro del mismo tick solo aplican el primero.
- [ ] Comer una fruta alarga la serpiente en una celda, suma `points × level` al `score` e incrementa `FRUTAS`; la fruta nueva nunca aparece sobre el cuerpo.
- [ ] El HUD muestra SCORE, NIVEL y FRUTAS con los valores del juego (no del simulador falso), y **no** muestra el stat de vidas ni el de líneas.
- [ ] Cada 5 frutas el `NIVEL` sube en 1 y la serpiente se mueve visiblemente más rápido; la velocidad deja de aumentar al llegar a `TICK_MIN` (60 ms).
- [ ] Las frutas se dibujan con su sprite del atlas sin deformarse (banana y kiwi conservan su relación de aspecto) y centradas en la celda.
- [ ] Si `fruits.png` no carga (bloquear la petición en DevTools), el juego sigue jugable con la fruta dibujada como círculo de color.
- [ ] `PAUSA` congela la partida y `REANUDAR` continúa sin salto de posición (sin `dt` acumulado); `P` y `Escape` alternan igual que el botón.
- [ ] `FIN` termina la partida y abre el modal con el puntaje actual.
- [ ] Chocar contra una pared y chocar contra el propio cuerpo terminan la partida: parpadeo rojo (~200 ms), overlay `GAME OVER` en canvas (~1.2 s) y después el modal, con un solo `onGameOver`.
- [ ] `JUGAR DE NUEVO` reinicia con serpiente de 3 segmentos en el centro, `score` 0, `NIVEL` 1, `FRUTAS` 0 y la velocidad base.
- [ ] Guardar en el modal hace `POST /api/scores` y devuelve el puesto obtenido.
- [ ] `select playable from games where id = 'serpentina'` devuelve `true` y `select count(*) from scores where game_id = 'serpentina'` devuelve `0` antes de la primera partida; `select count(*) from games` sigue en 9.
- [ ] `title`, `short`, `long`, `cat`, `cover`, `color` y `sort_order = 2` de la fila `serpentina` no han cambiado.
- [ ] Serpentina aparece como jugable en Home, Biblioteca y `/game/serpentina`, y su pestaña del Hall of Fame muestra el estado vacío sin romper hasta la primera partida guardada.
- [ ] Redimensionar durante la partida mantiene la relación 4:3, no deforma el grid y no altera la posición lógica de la serpiente ni de la fruta.
- [ ] El canvas se ve nítido con `devicePixelRatio > 1`.
- [ ] Las flechas y `Space` no scrollean la página durante la partida, y el input de iniciales del modal sigue aceptando texto.
- [ ] `SALIR` o navegar fuera detiene el loop y quita listeners y `ResizeObserver`; volver a entrar no lo duplica (verificado en dev con React Strict Mode).
- [ ] Asteroides, Caída y Bloque Buster siguen funcionando igual, sin el stat FRUTAS en su HUD.
- [ ] Los juegos no jugables (`gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`) siguen mostrando el simulador falso sin cambios.

## Decisiones tomadas y descartadas

- **Reusar la fila `serpentina` en vez de crear un id nuevo** (decisión explícita del usuario). Se descartan `snake` y `vibora`: la fila ya existe desde el spec 06 con su portada `cover-snake`, su color verde y su `sort_order = 2`, y crear otra dejaría un juego duplicado en el catálogo. La contrapartida es borrar sus 12 puntajes sembrados.
- **Juego diseñado desde cero, no portado** — no hay fuente en `references/started-games/`. Lo aportado es solo el atlas de frutas. Consecuencia: la mecánica se define en el modelo de datos de este spec y no hay «comportamiento original» al que apelar durante la implementación.
- **`sprites.js` se transcribe, no se copia** (decisión explícita del usuario). El archivo asigna `window.SPRITE_ATLAS` y apunta a una ruta relativa; se descarta cargarlo como script porque un global de navegador impide dos instancias y rompe el SSR. Se convierte en `lib/games/snake/sprites.ts`, que además añade `tier`, `points` y color de fallback.
- **Área lógica fija 800×600 con grid 32×24** (decisión explícita del usuario). Se descarta el letterbox (dejaría franjas negras) y el grid recalculado al redimensionar (cambiaría el número de celdas en mitad de la partida, alterando dificultad y puntajes). Coste aceptado: en pantallas pequeñas el juego se ve más pequeño, no se rediseña.
- **Muerte contra pared, sin vidas y sin modo wrap** (decisión explícita del usuario). Se descarta el wrap y se descartan las 3 vidas con reaparición: es el Snake canónico, hace los puntajes comparables y el HUD ya sabe ocultar el stat de vidas cuando el juego no lo publica.
- **Frutas con valor por tramo (10 / 25 / 50) y spawn ponderado 70/25/5** (decisión explícita del usuario). Se descarta que todas valgan igual —dejaría los 22 sprites como mera decoración— y se descarta fijar los 22 valores uno a uno, que multiplica el ajuste fino sin cambiar la experiencia. El puntaje se multiplica por el nivel para premiar sobrevivir.
- **Campo opcional `fruits?` en `GameState` en vez de reusar `lines?`** (decisión explícita del usuario). Reusar `lines?` haría que el HUD dijera «LÍNEAS» para frutas o forzaría una etiqueta condicional por juego. Se descarta también no publicar nada: el contador de frutas es la métrica que explica el puntaje. Coste: un campo más en el contrato y un `hud-stat` más en `GamePlayer.tsx`.
- **Serpiente dibujada con formas, no con sprites** (decisión explícita del usuario). El atlas no trae cabeza, cuerpo ni cola. Se descarta el cuerpo tipo tubo con curvas en los giros (exige lógica de esquinas por segmento) y el cuadrado plano estilo Nokia (desentona con la paleta neón). Quedan celdas redondeadas en `--green` con cabeza más clara, ojos y degradado hacia la cola.
- **Fruta escalada conservando la relación de aspecto** (decisión explícita del usuario). Se descarta estirarla al cuadrado de la celda porque deforma los recortes alargados (banana, kiwi, pimiento).
- **Un solo giro encolado por tick.** Se descarta una cola de giros: permitiría girar dos veces entre dos pasos y suicidarse con un doble toque rápido, el bug clásico del Snake.
- **Parpadeo rojo de 200 ms antes del overlay** (decisión explícita del usuario). Se descarta el corte seco: el parpadeo deja ver dónde se produjo la colisión antes de tapar el canvas.
- **Sin `Space` como tecla de pausa** (decisión explícita del usuario). `P` y `Escape` bastan y son las mismas de los otros juegos; `Space` ya está en `BLOCKED_KEYS`.
- **`fruits.png` se copia entero, sin recortar** (decisión explícita del usuario). Se descarta recortar la fila usada para bajar los 585 KB: mantener el asset original intacto facilita usar otras filas del atlas en un spec futuro.
- **Sin audio.** Se descarta añadir sonidos propios: el atlas no trae ninguno y el vault aún no tiene control de mute (fuera de scope desde el spec 08).

## Riesgos identificados

- **El grid fijo con canvas escalado puede dejar celdas borrosas.** 800/32 = 25 px lógicos exactos, pero al escalar a un CRT de ancho arbitrario los bordes de celda caen en fracciones de píxel. Mitigación: dibujar el fondo del grid sin líneas de rejilla de 1 px (o con celdas de color alterno), y verificar la nitidez con `devicePixelRatio > 1` en el criterio de aceptación.
- **El tick por acumulador puede saltarse pasos tras un frame largo.** Con `dt` capado a 0.05 s y `tickMs` de hasta 60 ms, una pestaña que vuelve del background podría procesar varios pasos de golpe. Mitigación: cap del `dt` ya previsto y procesar **como máximo un paso por frame**, descartando el sobrante del acumulador.
- **El spawn de fruta por rechazo se degrada con la serpiente muy larga.** Con 768 celdas el caso es teórico, pero un cuerpo enorme haría reintentar mucho. Mitigación: si el rechazo supera N intentos, elegir por índice entre las celdas libres enumeradas. Riesgo residual aceptado si se implementa solo el rechazo simple.
- **La extensión de `GameState` toca un archivo compartido por cuatro juegos.** Un cambio mal hecho en `types.ts` o en el HUD rompe Asteroides, Caída y Bloque Buster. Mitigación: campo **opcional**, `hud-stat` condicionado a `state.fruits !== undefined`, y criterios de aceptación explícitos para los otros tres juegos.
- **`fruits.png` puede no cargar** (red lenta, ruta mal escrita, 404 en producción). Sin mitigación el juego quedaría sin fruta visible. Mitigación: `loadFruitSheet()` resuelve a `null` en caso de error y el dibujo cae al círculo de color del tramo; hay criterio de aceptación que lo verifica.
- **React Strict Mode monta dos veces en dev.** Si `destroy()` no cancela el `rAF`, el listener de teclado y el `ResizeObserver`, quedan dos loops y la serpiente se mueve al doble de velocidad. Mitigación: `destroy()` idempotente con flag `destroyed` y criterio de aceptación propio.
- **`preventDefault` global secuestra el teclado.** Si el listener sobrevive a la ruta o captura el input del modal, no se pueden escribir las iniciales. Mitigación: listener atado a la instancia y bypass de `BLOCKED_KEYS` en campos de formulario, ya existente en `components/GamePlayer.tsx`.
- **`WASD` puede chocar con atajos del navegador o con teclados no QWERTY.** En un layout AZERTY las teclas quedan mal colocadas. Mitigación: las flechas son el control primario y `WASD` es alternativo; riesgo residual aceptado (no se implementa mapeo por `code` físico frente a `key`, salvo que la implementación lo haga sin coste).
- **Borrar los 12 puntajes sembrados es irreversible.** Mitigación: son datos de siembra del spec 06, no partidas reales; el `delete` está acotado por `game_id = 'serpentina'` y se verifica el `count(*)` después.
