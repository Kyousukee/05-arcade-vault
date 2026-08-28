# Spec jam travesía peligrosa — RANARIA extensión

**Estado:** borrador
**Depende de:** 05-asteroides-jugable, 06-juegos-y-leaderboard, game-jam/ranaria/01-ranaria-jugable
**Fecha:** 2026-08-27

**Objetivo:** Dar profundidad a Ranaria con fauna viva en el río y en la orilla (tortugas que se sumergen, cocodrilos, serpiente de la mediana), bonus de riesgo (mosca y rana-dama) y un reloj visible en el HUD mediante el campo opcional `timeLeft?` de `GameState`.

> Nota de contexto: jam del tema **«travesía peligrosa: cruzar obstáculos en movimiento contra reloj»**. Este spec es la fase 2 de Ranaria y **no se sostiene solo**: parte de `01-ranaria-jugable.md`, que deja el juego registrado, jugable y con su fila de `games` habilitada. Aquí se convierte una travesía de obstáculos regulares en una travesía **hostil**: los apoyos del río dejan de ser fiables, la meta deja de ser segura y el reloj sube del canvas al HUD, que es el cambio que el 01 aplazó deliberadamente.

## Alcance

**Incluye:**

- **Campo opcional `timeLeft?: number` en `lib/games/types.ts`**, con su `hud-stat` `TIEMPO` en `components/GamePlayer.tsx` (renderizado solo cuando `state.timeLeft !== undefined`) y su clase `.hud-stat.time` en `app/globals.css`. La barra de tiempo del canvas del 01 se mantiene: el HUD la duplica en cifra, no la sustituye.
- **Tortugas sumergibles** (`lib/games/ranaria/entities.ts`): en dos de las cinco franjas del río, los troncos se sustituyen por grupos de 3 tortugas que ciclan `surfaced → sinking → submerged → surfacing` con periodo `TURTLE_CYCLE_MS = 5200` y fase propia por grupo. En `submerged` no sostienen a la rana: si la rana está encima, muere por agua.
- **Cocodrilos de nenúfar:** a partir del nivel 2, uno de los nenúfares libres alberga un cocodrilo con la boca abierta durante `CROC_OPEN_MS = 3000` de cada `CROC_CYCLE_MS = 7000`. Posarse con la boca abierta mata; con la boca cerrada el nenúfar se ocupa con normalidad. El cocodrilo cambia de nenúfar en cada ciclo.
- **Cocodrilo nadador:** a partir del nivel 3, la franja de río más cercana a la meta incorpora un cocodrilo que se desplaza como un tronco pero cuya **cabeza** (el 25 % delantero) es mortal; el lomo sostiene a la rana.
- **Serpiente de la mediana:** a partir del nivel 3, una serpiente patrulla la fila 6 de lado a lado a `SNAKE_SPEED = 110` px lógicos/s, invirtiendo el sentido en los bordes. Contacto = muerte. La mediana deja de ser un refugio gratuito.
- **Mosca bonus:** cada `FLY_SPAWN_MS = 9000` aparece una mosca sobre un nenúfar libre durante `FLY_LIFE_MS = 4000`. Llegar a ese nenúfar con la mosca activa suma `+200` además del bonus normal.
- **Rana-dama:** cada `LADY_SPAWN_MS = 14000` aparece una rana-dama en un tronco aleatorio del río. Aterrizar sobre ella la engancha (la rana la lleva a cuestas) y llegar con ella a un nenúfar suma `+200` extra. Morir con la dama a cuestas la pierde sin penalización adicional.
- **Techo de velocidad:** `MAX_LANE_SPEED = 220` px lógicos/s por fila, para que el `LEVEL_SPEEDUP` acumulado del 01 no vuelva la travesía imposible dentro del reloj de 30 s.
- **Escalonado por nivel** en `constants.ts`: `CROC_PAD_FROM_LEVEL = 2`, `CROC_SWIM_FROM_LEVEL = 3`, `SNAKE_FROM_LEVEL = 3`, `TURTLE_LANES = [2, 4]`.
- **Dibujo con formas y color**, en la línea del 01: tortugas como tríos de discos verdes con caparazón segmentado y opacidad decreciente al sumergirse; cocodrilos como cuerpos alargados con dientes en la cabeza; serpiente como cadena de segmentos magenta; mosca y dama como siluetas pequeñas sobre su soporte.
- **Verificación:** `npm run lint`, `npm run build` y prueba manual del recorrido completo, incluidos los otros cuatro juegos del vault.

**NO incluye (fuera de este spec):**

- Cambios en la fila `ranaria` de `games`, en `GAME_REGISTRY` o en la portada `cover-rana`: todo eso ya existe desde el 01 y no se toca.
- Nuevos campos en `GameState` distintos de `timeLeft?`.
- Assets en `public/games/ranaria/`: la fauna también se dibuja con formas.
- Audio, controles táctiles y dificultad seleccionable.
- Vidas extra por puntuación, modo contrarreloj alternativo y tablas de récords locales.
- Un segundo carril de meta, tableros por nivel o generación procedural del tablero: la disposición de 13 filas del 01 es fija.
- Tests automatizados (no hay test runner configurado).

**Consecuencias aceptadas de este scope:**

- Con tortugas, cocodrilos y serpiente, los puntajes obtenidos antes de este spec y los posteriores conviven en el mismo leaderboard de `ranaria` bajo reglas distintas. Se acepta: el juego se ha hecho más difícil y más rico en bonus, y la métrica sigue siendo puntos enteros comparables.
- `timeLeft?` es el quinto campo opcional de `GameState` y el sexto `hud-stat` de `GamePlayer.tsx`: el HUD se acerca a su límite de ancho en pantallas estrechas. Se acepta porque `.player-hud` ya envuelve con `flex-wrap`.
- El escalonado por nivel hace que los tres primeros niveles enseñen el juego y los siguientes lo endurezcan; un jugador que muere pronto no llega a ver la mitad del contenido de este spec.
- El techo `MAX_LANE_SPEED` aplana la curva de dificultad en niveles muy altos: a partir de ahí la presión la aporta la fauna, no la velocidad.

## Modelo de datos

Este spec no crea tablas ni toca `public.games` ni `public.scores`. Extiende el contrato compartido con **un** campo opcional y añade campos nuevos al `runtime` del 01.

### Extensión del contrato — `lib/games/types.ts`

Ningún campo existente sirve: `lives?` son vidas, `lines?` son líneas de Caída y `fruits?` son frutas de Serpentina. Reinterpretar cualquiera haría que el HUD mostrara una etiqueta equivocada.

```ts
export interface GameState {
  score: number;
  level: number;
  phase: GamePhase;
  lives?: number;
  lines?: number;
  fruits?: number;
  /** Segundos restantes del intento. Solo lo publican los juegos contrarreloj (Ranaria). */
  timeLeft?: number;
  tripleShot: number;
}
```

En `components/GamePlayer.tsx`, junto a los demás stats condicionales y con la misma forma (`div.l` + `div.v`):

```tsx
{
  timeLeft !== undefined && (
    <div className="hud-stat time">
      <div className="l">Tiempo</div>
      <div className="v">{timeLeft.toFixed(1)}s</div>
    </div>
  );
}
```

Y en `app/globals.css`, junto a `.hud-stat.lines` y `.hud-stat.fruits`:

```css
/* Segundos restantes del intento: solo lo publican los juegos contrarreloj (Ranaria) */
.hud-stat.time .v {
  color: var(--yellow);
  text-shadow: 0 0 6px rgba(245, 255, 0, 0.5);
}
```

### Mapeo al `GameState` (cambios respecto al 01)

| Campo `GameState` | Origen en Ranaria tras este spec                             |
| ----------------- | ------------------------------------------------------------ |
| `score`           | igual que en el 01, más `+200` de mosca y `+200` de la dama  |
| `level`           | igual que en el 01                                           |
| `lives`           | igual que en el 01                                           |
| `phase`           | igual que en el 01                                           |
| `timeLeft`        | **nuevo**: `runtime.timeLeft`, publicado siempre por Ranaria |
| `tripleShot`      | `0` fijo                                                     |

`timeLeft` se emite con el resto del estado a ~10 Hz. **No** se fuerza una emisión por frame: el HUD muestra décimas que avanzan a saltos de 0,1 s, que es justo la resolución del `STATE_INTERVAL`.

### Campos nuevos del `runtime` — `lib/games/ranaria/game.ts`

Se añaden a `RanariaRuntime` del 01; el resto se mantiene idéntico.

```ts
type TurtlePhase = "surfaced" | "sinking" | "submerged" | "surfacing";

interface TurtleGroup {
  x: number; // borde izquierdo del trío, px lógicos
  width: number; // 3 tortugas
  cycleT: number; // ms dentro de TURTLE_CYCLE_MS, con fase propia
}

interface Croc {
  x: number;
  width: number;
  headWidth: number; // 25 % delantero, mortal
}

interface PadCroc {
  pad: number; // índice 0–4 del nenúfar ocupado
  cycleT: number; // ms dentro de CROC_CYCLE_MS
}

interface Snake {
  x: number;
  dir: -1 | 1;
}

interface Bonus {
  pad: number; // mosca: nenúfar sobre el que aparece
  ttl: number; // ms restantes
}

interface Lady {
  lane: number; // fila del río
  entity: LaneEntity; // tronco que la transporta
  riding: boolean; // true si la rana la lleva a cuestas
}

interface RanariaRuntimeExt {
  turtles: Map<number, TurtleGroup[]>; // fila → grupos, solo TURTLE_LANES
  swimCroc: Croc | null; // desde CROC_SWIM_FROM_LEVEL
  padCroc: PadCroc | null; // desde CROC_PAD_FROM_LEVEL
  snake: Snake | null; // desde SNAKE_FROM_LEVEL
  fly: Bonus | null;
  flyTimer: number; // ms hasta el próximo spawn
  lady: Lady | null;
  ladyTimer: number; // ms hasta el próximo spawn
}
```

Todo por instancia, como en el 01: ningún global de módulo.

### Reglas nuevas

- **Tortuga como apoyo condicional:** al aterrizar sobre un grupo de tortugas, la rana lo monta igual que un tronco. En cada frame, si el grupo está en `submerged` y la rana sigue encima → muerte por agua. `sinking` y `surfacing` sostienen (dan margen de reacción).
- **Cocodrilo nadador:** el lomo sostiene; el aterrizaje sobre la cabeza, o el desplazamiento de la rana hasta la cabeza, matan.
- **Cocodrilo de nenúfar:** al aterrizar en el nenúfar `padCroc.pad`, si el ciclo está en boca abierta → muerte; si no, el nenúfar se ocupa normalmente y el cocodrilo salta a otro nenúfar libre en su siguiente ciclo.
- **Serpiente:** en cada frame de `phase === "playing"`, si la rana está en la fila 6 y su rectángulo solapa el de la serpiente → muerte. Es la única entidad de este spec que mata sin que la rana haya saltado.
- **Mosca:** si el nenúfar alcanzado es `fly.pad` y `fly.ttl > 0`, `score += 200`. La mosca desaparece al agotarse `ttl` o al ocuparse su nenúfar.
- **Rana-dama:** aterrizar en el tronco que la lleva pone `lady.riding = true`; llegar a un nenúfar con `riding` suma `+200` y limpia la dama. Morir con la dama a cuestas la elimina sin penalización.
- **Techo de velocidad:** al subir de nivel, `lane.speed = min(MAX_LANE_SPEED, def.speed * LEVEL_SPEEDUP ** (level - 1))`.

## Plan de implementación

Cada paso deja el repo compilando (`npm run build` verde). El orden va del cambio de contrato (el más transversal) a la fauna (aislada en Ranaria).

1. **Consultar la doc vendored.** Repasar en `node_modules/next/dist/docs/` lo relativo a componentes cliente antes de tocar `components/GamePlayer.tsx`.
2. **Contrato.** Añadir `timeLeft?: number` a `GameState` en `lib/games/types.ts`. Campo opcional: no rompe Asteroides, Caída, Bloque Buster ni Serpentina, que no lo publican.
3. **HUD.** Añadir el `hud-stat` `TIEMPO` en `components/GamePlayer.tsx` condicionado a `timeLeft !== undefined`, y la clase `.hud-stat.time` en `app/globals.css` junto a `.lines` y `.fruits`. Verificar en este punto que los otros cuatro juegos siguen sin mostrar el stat.
4. **Publicación.** En `lib/games/ranaria/game.ts`, incluir `timeLeft: runtime.timeLeft` en el estado emitido. Con solo esto el HUD ya cuenta atrás.
5. **Constantes.** Añadir a `constants.ts` los tiempos y umbrales del alcance (`TURTLE_CYCLE_MS`, `CROC_CYCLE_MS`, `CROC_OPEN_MS`, `SNAKE_SPEED`, `FLY_SPAWN_MS`, `FLY_LIFE_MS`, `LADY_SPAWN_MS`, `MAX_LANE_SPEED`, `TURTLE_LANES` y los `*_FROM_LEVEL`).
6. **Techo de velocidad.** Aplicar `MAX_LANE_SPEED` en el recálculo de nivel. Cambio de una línea, verificable jugando varios niveles.
7. **Tortugas.** `TurtleGroup` en `entities.ts` con su máquina de estados por ciclo y su dibujo; sustituir los troncos de `TURTLE_LANES` por grupos; regla de apoyo condicional y muerte en `submerged`.
8. **Cocodrilo de nenúfar.** `PadCroc` con su ciclo, su reubicación entre nenúfares libres y su dibujo; regla de muerte con boca abierta. Activo desde `CROC_PAD_FROM_LEVEL`.
9. **Cocodrilo nadador y serpiente.** `Croc` en la franja de río superior con cabeza mortal, y `Snake` patrullando la fila 6 con inversión en los bordes. Ambos desde su `*_FROM_LEVEL`.
10. **Bonus.** Mosca sobre nenúfar libre con `FLY_SPAWN_MS` / `FLY_LIFE_MS`, y rana-dama en tronco con `LADY_SPAWN_MS`, transporte a cuestas y `+200` cada una.
11. **Reinicio.** `restart()` y el reinicio de intento del 01 limpian `fly`, `lady`, `padCroc`, `snake` y `swimCroc` según el nivel resultante; ninguna entidad sobrevive a un `JUGAR DE NUEVO`.
12. **Verificación.** `npm run lint`, `npm run build` y prueba manual: sumergirse con una tortuga, morir en la cabeza del cocodrilo, posarse en el nenúfar con la boca cerrada y con la boca abierta, cruzarse con la serpiente, cobrar la mosca, entregar a la dama, ver el stat `TIEMPO` contar atrás y congelarse en pausa, y comprobar que Asteroides, Caída, Bloque Buster y Serpentina no muestran ese stat.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] El HUD de `/game/ranaria/play` muestra un stat `TIEMPO` con décimas que cuenta atrás durante la partida, se congela en `PAUSA` y vuelve a 30,0 s al morir o al alcanzar un nenúfar.
- [ ] Asteroides, Caída, Bloque Buster y Serpentina **no** muestran el stat `TIEMPO` y siguen jugándose exactamente igual que antes de este spec.
- [ ] `timeLeft?` está declarado como opcional en `lib/games/types.ts` y ningún juego distinto de Ranaria lo publica.
- [ ] La barra de tiempo dibujada en el canvas del 01 sigue presente y coincide con el valor del HUD.
- [ ] En las dos franjas de `TURTLE_LANES` hay grupos de tortugas que se sumergen y emergen cíclicamente; quedarse sobre un grupo sumergido resta una vida, y los estados intermedios (`sinking`, `surfacing`) sostienen a la rana.
- [ ] Los grupos de tortugas de una misma franja no se sumergen a la vez: cada grupo tiene su propia fase.
- [ ] Desde el nivel 2 hay un cocodrilo en un nenúfar libre; posarse con la boca abierta resta una vida y con la boca cerrada ocupa el nenúfar y puntúa con normalidad.
- [ ] Desde el nivel 3 hay un cocodrilo nadador en la franja de río superior: su lomo sostiene a la rana y su cabeza resta una vida.
- [ ] Desde el nivel 3 la serpiente patrulla la mediana de lado a lado y el contacto resta una vida aunque la rana esté quieta.
- [ ] La mosca aparece sobre un nenúfar libre, dura unos 4 s y llegar a ese nenúfar mientras está activa suma 200 puntos además del bonus habitual.
- [ ] La rana-dama aparece sobre un tronco, se engancha al aterrizar sobre ella, se dibuja a cuestas de la rana y entregarla en un nenúfar suma 200 puntos; morir con ella la elimina sin restar puntos.
- [ ] Ninguna velocidad de fila supera `MAX_LANE_SPEED` por alto que sea el nivel.
- [ ] `JUGAR DE NUEVO` deja el tablero sin mosca, sin dama, sin serpiente y sin cocodrilos (nivel 1).
- [ ] `lib/games/ranaria/` sigue sin variables de módulo mutables: dos instancias coexisten sin interferirse.
- [ ] `PAUSA` congela tortugas, cocodrilos, serpiente y temporizadores de bonus; `REANUDAR` continúa sin salto.
- [ ] Redimensionar durante la partida no altera la posición lógica de ninguna entidad nueva ni deja a la rana fuera de su apoyo.
- [ ] `SALIR` o navegar fuera detiene el loop y quita listeners y `ResizeObserver`; volver a entrar no lo duplica (verificado en dev con React Strict Mode).
- [ ] Las flechas y `Space` no scrollean la página, y el input de iniciales del modal sigue aceptando texto.
- [ ] La fila `ranaria` de `games` y su entrada en `GAME_REGISTRY` no han cambiado respecto al 01; `select count(*) from games` sigue en 9.
- [ ] Todo lo verificado en los criterios del `01-ranaria-jugable.md` sigue cumpliéndose: saltos, colisiones, nenúfares, bonus de tiempo, subida de nivel, vidas y `GAME OVER`.

## Decisiones tomadas y descartadas

- **`timeLeft?` como campo opcional nuevo, no reutilizando `lines?` ni `fruits?`.** Reusar cualquiera haría que el HUD mostrara «Líneas» o «Frutas» para segundos. Se descarta también publicar el tiempo como parte de `score`: destruiría la comparabilidad del leaderboard.
- **El reloj se publica en el HUD y **además** sigue en el canvas.** Se descarta quitar la barra del canvas: la mirada del jugador está en la rana, y una cifra en el HUD superior no sirve para reaccionar en el último segundo. La barra comunica urgencia; la cifra, precisión.
- **`timeLeft` se emite a ~10 Hz, sin emisión forzada por frame.** Se descarta emitir cada frame para tener décimas fluidas: multiplicaría por seis los renders de React a cambio de un dígito. Coste aceptado: el décimo de segundo avanza a saltos.
- **Tortugas solo en dos de las cinco franjas.** Se descarta poner tortugas en todas: sin ningún apoyo fiable el río deja de tener ritmo y la muerte pasa a depender de la fase del ciclo, no de la decisión del jugador.
- **Los estados `sinking` y `surfacing` sostienen a la rana.** Se descarta que solo `surfaced` sostenga: sin ventana de reacción, la tortuga se vuelve una trampa aleatoria en vez de un reloj visible.
- **Fauna escalonada por nivel (2 y 3), no toda desde el principio.** Se descarta activarlo todo en el nivel 1: la primera travesía sería ilegible y el juego perdería su función de enseñar sus propias reglas. Coste: parte del contenido no lo ve un jugador que muere pronto.
- **Techo `MAX_LANE_SPEED = 220`.** Se descarta dejar la velocidad creciendo sin límite: con un reloj fijo de 30 s, hacia el nivel 7 la travesía sería matemáticamente imposible y el juego pasaría a puntuar la suerte.
- **Bonus de puntos (mosca, dama) en vez de vidas extra.** Se descarta la vida extra: alargaría la partida indefinidamente para un jugador experto y rompería el rango de 2–5 min que pide el leaderboard.
- **La dama se pierde sin penalización al morir.** Se descarta restar puntos: la muerte ya cuesta una vida y el tiempo del intento; una penalización doble desincentivaría recogerla, que es justo la decisión de riesgo que el bonus quiere provocar.
- **Cocodrilo de nenúfar que cambia de posición cada ciclo.** Se descarta fijarlo a un nenúfar: se memorizaría en una partida y dejaría de amenazar.
- **Todo dibujado con formas, sin assets.** Coherente con el 01 y con la regla del jam de no inventar archivos que no existen en el repo.
- **Sin cambios en la fila `games` ni en el registry.** Ya existen desde el 01; repetirlos aquí duplicaría la migración y arriesgaría un `insert` sobre una PK existente.

## Riesgos identificados

- **Tocar `lib/games/types.ts` y `components/GamePlayer.tsx` afecta a los cinco juegos.** Un error en el HUD rompe Asteroides, Caída, Bloque Buster y Serpentina. Mitigación: campo **opcional**, `hud-stat` condicionado a `timeLeft !== undefined`, y criterios de aceptación explícitos para los otros cuatro juegos.
- **Colisión con otro spec del jam que también extienda `GameState`.** Si dos specs del jam se implementaran a la vez sobre `types.ts` habría conflicto de merge. Mitigación: `garfio` y `agujas` están especificados **sin** cambios de contrato; este es el único spec del jam que toca `types.ts`.
- **El canvas responsive altera el balance calibrado en píxeles.** `SNAKE_SPEED` y los ciclos de tortuga están en px lógicos y milisegundos. Mitigación: la lógica sigue en el espacio lógico fijo 800×600 del 01; el escalado es solo `setTransform`.
- **El reescalado al redimensionar puede dejar entidades en estado inválido.** Una rana montada en un grupo de tortugas conserva una referencia al grupo. Mitigación: `applyResize()` no toca posiciones ni referencias, solo el transform y `cssW`/`cssH`; criterio de aceptación propio.
- **React Strict Mode monta dos veces en dev.** Los temporizadores de mosca y dama duplicados harían aparecer dos bonus. Mitigación: siguen viviendo en el `runtime` por instancia y el `destroy()` idempotente del 01 no cambia.
- **El `preventDefault` global secuestra el teclado.** Sin cambios respecto al 01: este spec no añade teclas nuevas. Mitigación heredada (bypass de `BLOCKED_KEYS` en campos de formulario).
- **Dificultad mal calibrada al acumular fauna.** Tortugas, dos cocodrilos y serpiente a la vez desde el nivel 3 pueden hacer la travesía frustrante. Mitigación: los `*_FROM_LEVEL` y los tiempos de ciclo son constantes en `constants.ts`, ajustables en la prueba manual; riesgo residual aceptado (no hay tests de balance).
- **El estado de la rana-dama complica la muerte y el reinicio.** Una dama enganchada que sobreviva a un `restart()` dejaría un bonus fantasma. Mitigación: paso 11 del plan y criterio de aceptación específico.
- **Los puntajes previos al spec quedan bajo reglas distintas.** Riesgo residual aceptado: la métrica sigue siendo puntos enteros y el leaderboard no distingue versiones.

## Qué **no** está en este spec

- El juego base: tablero, saltos, coches, troncos, nenúfares, vidas, reloj de intento, registry y fila de `games` son del `01-ranaria-jugable.md`.
- Cualquier campo de `GameState` distinto de `timeLeft?`.
- Los otros dos juegos del jam (`garfio` y `agujas`).
- Audio, controles táctiles, dificultad seleccionable, persistencia local y tests automatizados.
- Cambios en el reproductor más allá del `hud-stat` nuevo, en `POST /api/scores`, en `lib/queries.ts` o en el schema de Supabase.
