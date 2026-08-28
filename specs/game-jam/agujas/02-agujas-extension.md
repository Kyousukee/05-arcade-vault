# Spec jam travesía peligrosa — AGUJAS extensión

**Estado:** borrador
**Depende de:** 05-asteroides-jugable, 06-juegos-y-leaderboard, game-jam/agujas/01-agujas-jugable
**Fecha:** 2026-08-27

**Objetivo:** Dar profundidad a Agujas con compuertas temporizadas, tramos que aceleran y frenan a los viajeros, cápsulas con destino de color y tres salidas, patrullas que cambian de circuito y oleadas que se solapan, todo sin tocar el contrato `GameState`.

> Nota de contexto: jam del tema **«travesía peligrosa: cruzar obstáculos en movimiento contra reloj»**. Fase 2 de Agujas; **no se sostiene sola**: parte de `01-agujas-jugable.md`, que deja el juego registrado, jugable, con su fila en `games` y su portada. El 01 plantea una pregunta por cápsula: ¿por dónde la mando? Este spec añade la segunda dimensión — **cuándo** — con compuertas y tramos de velocidad que convierten la ruta más corta en la más arriesgada, y sube la carga cognitiva con destinos de color y tráfico solapado.

## Alcance

**Incluye:**

- **Compuertas temporizadas:** celdas `gate` que alternan abierta/cerrada con periodo `GATE_CYCLE_MS = 4200` y un 60 % de apertura, con su cuenta atrás dibujada en la propia celda. Una cápsula que entra en una compuerta cerrada descarrila (una vida, combo a 1). Las patrullas las atraviesan siempre: solo bloquean cápsulas.
- **Tramos de velocidad:** celdas `boost` (×`BOOST_FACTOR = 1.9` mientras se recorren) y `brake` (×`BRAKE_FACTOR = 0.55`). Permiten sincronizar una cápsula con una compuerta o dejar pasar una patrulla, y son la herramienta que el 01 no daba: influir sobre el **tiempo** sin poder frenar directamente.
- **Destinos de color:** desde `COLOR_FROM_WAVE = 3`, cada cápsula lleva uno de tres colores (cian, magenta, verde) y hay tres celdas `exit` en el borde derecho, una por color. Entregar en la salida correcta suma `100 × combo`; entregarla en la equivocada suma `25` y **corta el combo a 1** sin restar vida.
- **Patrullas conmutables:** desde `SWAP_FROM_WAVE = 4`, algunas patrullas tienen dos circuitos y saltan del uno al otro cada `PATROL_SWAP_MS = 9000` en un nodo compartido, señalizado con un parpadeo `PATROL_WARN_MS = 1500` antes del salto.
- **Oleadas solapadas:** desde `OVERLAP_FROM_WAVE = 5`, las últimas `OVERLAP_CAPSULES = 2` cápsulas de una oleada pueden seguir en la red cuando arranca la siguiente. El reloj de la nueva oleada empieza igualmente; las cápsulas heredadas conservan su color y su destino.
- **Bonus de oleada perfecta:** cerrar una oleada sin ninguna pérdida (ni colisión, ni descarrilamiento, ni entrega equivocada) suma `+300` además del bonus de tiempo del 01, con destello en el borde del canvas.
- **Dos plantillas nuevas** en `WAVE_TEMPLATES` (total 8), construidas alrededor de las mecánicas nuevas: una con dos compuertas en las rutas cortas y `boost` en la larga, otra con tres salidas de color y una patrulla conmutable en el cruce central. El ciclo de reciclado pasa a `WAVE_TEMPLATES[(level - 1) % 8]`.
- **Escalonado por oleada** en `constants.ts`: `GATE_FROM_WAVE = 2`, `SPEED_TILES_FROM_WAVE = 2`, `COLOR_FROM_WAVE = 3`, `SWAP_FROM_WAVE = 4`, `OVERLAP_FROM_WAVE = 5`. Las plantillas anteriores a su umbral se juegan sin la mecánica correspondiente.
- **Verificación:** `npm run lint`, `npm run build` y prueba manual del recorrido completo, incluidos los otros juegos del vault.

**NO incluye (fuera de este spec):**

- Cambios en `lib/games/types.ts` y en `components/GamePlayer.tsx`: este spec **no toca el contrato**. Combo, reloj, colores pendientes y salidas se dibujan en el canvas.
- Cambios en la fila `agujas` de `games`, en `GAME_REGISTRY` o en la portada `cover-agujas`: ya existen desde el 01.
- Control directo sobre las cápsulas: sigue prohibido frenarlas, pararlas o girarlas a mano; los tramos de velocidad actúan sobre la vía, no sobre el viajero.
- Input de ratón o táctil: siguen siendo las teclas `1`–`6` del 01, sin teclas nuevas.
- Redes generadas por procedimiento o editor de niveles: las 8 plantillas son fijas y están escritas a mano.
- Assets en `public/games/agujas/`, audio, persistencia local y tests automatizados.

**Consecuencias aceptadas de este scope:**

- Los puntajes anteriores y posteriores a este spec conviven en el mismo leaderboard de `agujas` bajo reglas distintas. Se acepta: la métrica sigue siendo puntos enteros comparables.
- Con destinos de color y oleadas solapadas, la carga cognitiva sube bastante a partir de la oleada 5; un jugador ocasional probablemente no pase de ahí.
- La entrega equivocada no resta vida, así que un jugador puede sobrevivir indefinidamente entregando mal a propósito, con combo 1 y 25 puntos por cápsula. Se acepta: es una estrategia estrictamente peor que jugar bien y no rompe la monotonía del score.
- Ocho plantillas siguen siendo un ciclo finito: a partir de la oleada 9 el trazado se repite.
- Las oleadas solapadas hacen que el bonus de tiempo del 01 sea más difícil de cobrar, aplanando la curva de puntuación en las oleadas altas.

## Modelo de datos

Este spec no crea tablas, no toca `public.games` ni `public.scores` y **no modifica `lib/games/types.ts`**. El mapeo al `GameState` es idéntico al del 01: `score`, `level`, `lives`, `phase` y `tripleShot: 0`, sin campos opcionales nuevos.

### Tipos nuevos de celda — `lib/games/agujas/network.ts`

```ts
export type CellKind =
  | "empty"
  | "straight"
  | "curve"
  | "switch"
  | "entry"
  | "exit"
  | "gate" // compuerta temporizada
  | "boost" // acelera al viajero que la recorre
  | "brake"; // lo frena

export type CapsuleColor = "cyan" | "magenta" | "green";

export interface CellDef {
  kind: CellKind;
  sides: Side[];
  switchId?: number;
  defaultExit?: number;
  /** Solo `gate`: desfase dentro de GATE_CYCLE_MS, para que no abran a la vez. */
  gatePhase?: number;
  /** Solo `exit`: color que acepta. Ausente = acepta cualquiera (oleadas < COLOR_FROM_WAVE). */
  accepts?: CapsuleColor;
}

export interface PatrolDef {
  loop: { col: number; row: number }[];
  offset: number;
  /** Segundo circuito, si la patrulla es conmutable. */
  altLoop?: { col: number; row: number }[];
  /** Celda compartida por ambos circuitos donde ocurre el salto. */
  swapAt?: { col: number; row: number };
}
```

`WaveTemplate` gana `colors: boolean` (si la plantilla reparte destinos de color) y pasa de 6 a 8 entradas.

### Campos nuevos del `runtime` — `lib/games/agujas/game.ts`

Se añaden a `AgujasRuntime` del 01; el resto se mantiene idéntico.

```ts
interface GateState {
  col: number;
  row: number;
  cycleT: number; // ms dentro de GATE_CYCLE_MS, con gatePhase aplicado
}

interface AgujasRuntimeExt {
  gates: GateState[];
  /** Color de cada cápsula viva, por id. Vacío en oleadas sin color. */
  capsuleColor: Map<number, CapsuleColor>;
  /** ms hasta el próximo salto de circuito de las patrullas conmutables. */
  swapTimer: number;
  swapWarn: boolean; // true durante PATROL_WARN_MS antes del salto
  /** Cápsulas heredadas de la oleada anterior, para el conteo de cierre. */
  carriedOver: number;
  perfectWave: boolean; // true mientras la oleada no haya tenido ninguna pérdida
}
```

`Capsule` gana `speedFactor: number` (1 por defecto, `BOOST_FACTOR` o `BRAKE_FACTOR` mientras recorre esa celda). Todo por instancia: ningún global de módulo.

### Reglas nuevas

- **Compuerta:** `cycleT` avanza con `dt`; abierta durante el 60 % del ciclo. Una cápsula que **entra** en la celda con la compuerta cerrada descarrila. Si la compuerta se cierra con la cápsula ya dentro, la cápsula pasa: la decisión, como las agujas del 01, se evalúa en el instante de entrada.
- **Velocidad:** al entrar en una celda `boost` o `brake`, `speedFactor` pasa a `BOOST_FACTOR` o `BRAKE_FACTOR`; al salir, vuelve a 1. Afecta a cápsulas y a patrullas por igual — una patrulla frenada es una ventana que se abre.
- **Color:** en oleadas desde `COLOR_FROM_WAVE` con `template.colors`, cada cápsula recibe un color al aparecer, se dibuja con él y los tres `exit` muestran el suyo. Entrega correcta → `100 × combo` y combo +1; entrega incorrecta → `25`, combo a 1, `perfectWave = false`, sin restar vida.
- **Patrulla conmutable:** cada `PATROL_SWAP_MS`, al pasar por `swapAt`, la patrulla cambia de `loop` a `altLoop` (y viceversa). Durante los `PATROL_WARN_MS` previos, la patrulla y el nodo de salto parpadean.
- **Solape:** al cerrar una oleada con hasta `OVERLAP_CAPSULES` cápsulas todavía en la red, esas cápsulas **no** se pierden: se conservan, `carriedOver` las registra y la oleada siguiente arranca con ellas dentro. Con más de `OVERLAP_CAPSULES` en ruta, la oleada no cierra hasta que bajen de ese número o expire el reloj.
- **Oleada perfecta:** `perfectWave` empieza en `true` en cada oleada y pasa a `false` en cualquier colisión, descarrilamiento o entrega equivocada. Al cerrar con `perfectWave === true`, `score += 300`.
- **Reinicio:** `restart()` y el cierre de partida limpian `gates`, `capsuleColor`, `swapTimer`, `carriedOver` y `perfectWave`.

## Plan de implementación

Cada paso deja el repo compilando (`npm run build` verde). El orden va de lo local a la celda hasta lo que cruza oleadas.

1. **Consultar la doc vendored.** Repasar en `node_modules/next/dist/docs/` lo relativo a componentes cliente antes de tocar el juego. No hay rutas, assets ni config nuevos.
2. **Constantes.** Añadir a `constants.ts` los valores del alcance (`GATE_CYCLE_MS`, `BOOST_FACTOR`, `BRAKE_FACTOR`, `PATROL_SWAP_MS`, `PATROL_WARN_MS`, `OVERLAP_CAPSULES`, y los `*_FROM_WAVE`).
3. **Tipos de celda.** Ampliar `CellKind`, `CellDef` y `PatrolDef` en `network.ts`, y su dibujo en `entities.ts` (compuerta con su cuenta atrás, `boost` con chevrones en el sentido de marcha, `brake` con bandas transversales). En este paso ninguna plantilla los usa: nada cambia en el juego.
4. **Velocidad.** `speedFactor` en el avance de cápsulas y patrullas, aplicado al entrar y revertido al salir de la celda.
5. **Compuertas.** `GateState` con su ciclo y su desfase, descarrilamiento al entrar cerrada, paso libre para patrullas y dibujo de la cuenta atrás. Activo desde `GATE_FROM_WAVE`.
6. **Colores.** Asignación de color al aparecer, tres `exit` con su `accepts`, entrega correcta e incorrecta con su puntuación y su efecto sobre el combo. Activo desde `COLOR_FROM_WAVE`.
7. **Patrullas conmutables.** `altLoop`, `swapAt`, temporizador de salto y aviso parpadeante. Activo desde `SWAP_FROM_WAVE`.
8. **Solape de oleadas.** Condición de cierre revisada, `carriedOver`, herencia de cápsulas con su color y arranque del reloj nuevo. Activo desde `OVERLAP_FROM_WAVE`.
9. **Oleada perfecta.** `perfectWave`, `+300` al cierre y destello.
10. **Plantillas nuevas.** Dos `WaveTemplate` escritas a mano usando compuertas, tramos de velocidad, tres salidas de color y una patrulla conmutable; ciclo de reciclado a 8. Validar a mano que ambas se pueden completar sin pérdidas.
11. **Reinicio.** `restart()` limpia todo el estado nuevo; verificar que una partida nueva empieza sin compuertas, sin colores y sin solape (oleada 1).
12. **Verificación.** `npm run lint`, `npm run build` y prueba manual: descarrilar contra una compuerta cerrada, cruzarla justo antes del cierre, usar un `brake` para dejar pasar una patrulla, usar un `boost` para alcanzar una compuerta a tiempo, entregar en la salida correcta y en la equivocada, ver saltar una patrulla conmutable tras su aviso, cerrar una oleada con dos cápsulas heredadas, cobrar el bonus de oleada perfecta, y comprobar que Asteroides, Caída, Bloque Buster, Serpentina y los demás juegos del jam siguen igual.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] `lib/games/types.ts` y `components/GamePlayer.tsx` **no** han sido modificados por este spec, y el HUD de Agujas sigue mostrando exactamente Puntuación, Vidas y Nivel.
- [ ] Desde la oleada 2 hay compuertas que alternan abierta y cerrada con su cuenta atrás visible en la celda.
- [ ] Una cápsula que entra en una compuerta cerrada descarrila (una vida, combo a 1); una cápsula ya dentro cuando la compuerta se cierra **la atraviesa** sin morir.
- [ ] Las patrullas atraviesan las compuertas estén abiertas o cerradas.
- [ ] Desde la oleada 2 hay celdas `boost` y `brake`: una cápsula acelera visiblemente en la primera y se frena en la segunda, y recupera su velocidad normal al salir.
- [ ] Las patrullas también se aceleran y se frenan en esas celdas.
- [ ] Desde la oleada 3, en las plantillas con color, cada cápsula se dibuja con su color y hay tres salidas etiquetadas por color.
- [ ] Entregar una cápsula en la salida de su color suma `100 × combo` y sube el combo; entregarla en otra suma 25, pone el combo a 1 y **no** resta vida.
- [ ] Desde la oleada 4 hay patrullas que cambian de circuito, con parpadeo de aviso de ~1,5 s en la patrulla y en el nodo de salto antes de hacerlo.
- [ ] Desde la oleada 5, cerrar una oleada con una o dos cápsulas todavía en la red no las destruye: siguen circulando en la oleada siguiente conservando su color.
- [ ] Con más de dos cápsulas en ruta, la oleada no cierra anticipadamente hasta que bajen de ese número o expire el reloj.
- [ ] Cerrar una oleada sin ninguna colisión, descarrilamiento ni entrega equivocada suma 300 puntos con destello, además del bonus de tiempo del 01.
- [ ] `WAVE_TEMPLATES` tiene 8 entradas y a partir de la oleada 9 se reciclan cíclicamente.
- [ ] Las dos plantillas nuevas se pueden completar sin pérdidas al menos una vez cada una.
- [ ] `JUGAR DE NUEVO` empieza en la oleada 1 sin compuertas activas, sin colores, sin patrullas conmutables y sin solape.
- [ ] `lib/games/agujas/` sigue sin variables de módulo mutables: dos instancias coexisten sin interferirse.
- [ ] `PAUSA` congela compuertas, temporizador de salto de patrullas y reloj de oleada; `REANUDAR` continúa sin salto.
- [ ] Redimensionar durante la partida no altera la posición lógica de cápsulas, patrullas ni compuertas, ni desincroniza sus ciclos.
- [ ] `SALIR` o navegar fuera detiene el loop y quita listeners y `ResizeObserver`; volver a entrar no lo duplica (verificado en dev con React Strict Mode).
- [ ] Las teclas `1`–`6` siguen siendo el único control y el input de iniciales del modal sigue aceptando texto y números.
- [ ] La fila `agujas` de `games`, su `sort_order = 10` y su entrada en `GAME_REGISTRY` no han cambiado respecto al 01.
- [ ] Todo lo verificado en los criterios del `01-agujas-jugable.md` sigue cumpliéndose: avance autónomo, conmutación, colisiones, descarrilamientos, entregas, combo, oleadas, vidas y `GAME OVER`.
- [ ] Asteroides, Caída, Bloque Buster y Serpentina siguen funcionando exactamente igual.

## Decisiones tomadas y descartadas

- **Cero cambios en `GameState`.** Se descartan campos opcionales para combo o para el reloj de oleada: se dibujan en el canvas, donde el jugador ya está mirando la red. Además mantiene este spec sin conflicto de merge con el de Ranaria, el único del jam que toca `types.ts`.
- **La compuerta se evalúa al entrar, igual que la aguja.** Se descarta que cierre sobre la cápsula que ya está dentro: sería un cambio de regla respecto al 01 y una muerte que el jugador no puede prevenir. La coherencia entre aguja y compuerta es lo que hace el juego aprendible.
- **Las compuertas no bloquean a las patrullas.** Se descarta que también las paren: convertiría cada compuerta en una herramienta para encerrar patrullas y anularía su función de reloj.
- **Tramos de velocidad sobre la vía, no sobre el viajero.** Se descarta dar al jugador un botón de freno: es exactamente lo que el 01 prohíbe por diseño. Con `boost` y `brake` en la red, controlar el tiempo sigue siendo una decisión de ruta.
- **`boost` y `brake` afectan también a las patrullas.** Se descarta que solo afecten a las cápsulas: que una patrulla frenada abra una ventana es la interacción más interesante entre los dos sistemas, y hacerlo asimétrico obligaría a explicar una excepción.
- **La entrega equivocada corta el combo pero no resta vida.** Se descarta restar vida: con tres salidas y tráfico solapado, el error de color es frecuente y castigarlo como una colisión haría la oleada 5 injugable. Se descarta también que no tenga coste, que volvería el color decorativo.
- **Patrullas con dos circuitos y aviso previo.** Se descarta el salto sin aviso: haría imprevisible una amenaza que el juego promete determinista, y el jugador perdería vidas sin poder aprender.
- **Solape limitado a 2 cápsulas.** Se descarta el solape ilimitado: con 8 cápsulas heredadas la red se satura y el resultado deja de depender de las decisiones. Se descarta también no solapar nunca, que deja un tiempo muerto al final de cada oleada.
- **Bonus fijo de 300 por oleada perfecta, no multiplicador.** Se descarta multiplicar el bonus de tiempo: se acopla con el combo del 01 y produce puntuaciones explosivas difíciles de comparar en el leaderboard.
- **Dos plantillas nuevas, no seis.** Se descarta rehacer el catálogo entero de niveles: las 6 del 01 siguen siendo válidas y las mecánicas nuevas se activan sobre ellas por umbral de oleada. Coste: las plantillas viejas usan menos las mecánicas nuevas.
- **Escalonado por oleada, no todo desde la primera.** Se descarta activarlo todo en la oleada 1: la red sería ilegible y el juego perdería su función de enseñar sus propias reglas.
- **Todo dibujado con formas, sin assets.** Coherente con el 01 y con la regla del jam de no inventar archivos que no existen.
- **Sin cambios en la fila `games` ni en el registry.** Ya existen desde el 01; repetirlos aquí duplicaría la migración y arriesgaría un `insert` sobre una PK existente.

## Riesgos identificados

- **El canvas responsive altera el balance calibrado en píxeles.** `BOOST_FACTOR` y `BRAKE_FACTOR` multiplican velocidades en px lógicos/s. Mitigación: la lógica sigue en el espacio lógico fijo 800×600 del 01; el escalado es solo `setTransform`.
- **El reescalado al redimensionar puede dejar entidades en estado inválido.** Una cápsula a mitad de una celda `boost` lleva un `speedFactor` que debe revertirse al salir. Mitigación: `applyResize()` no toca posiciones ni factores; el `speedFactor` se recalcula en cada cambio de celda a partir del `kind`, nunca se acumula.
- **React Strict Mode monta dos veces en dev.** Los ciclos de compuerta y el `swapTimer` duplicados desincronizarían los avisos. Mitigación: `destroy()` idempotente del 01 sin cambios; todo el estado nuevo vive en el `runtime` por instancia.
- **El `preventDefault` global secuestra el teclado.** Sin cambios respecto al 01: este spec no añade teclas. Las teclas `1`–`6` siguen fuera de `BLOCKED_KEYS` y el input del modal sigue aceptando números. Mitigación heredada.
- **Las plantillas nuevas pueden ser irresolubles.** Con compuertas y colores, una combinación de agujas puede no tener camino a la salida correcta dentro del ciclo de la compuerta. Mitigación: paso 10 del plan — validación manual de que ambas se completan sin pérdidas, con criterio de aceptación propio.
- **La compuerta y el `brake` juntos pueden crear una trampa sin salida.** Una cápsula frenada antes de una compuerta puede llegar siempre en el peor instante del ciclo. Mitigación: `gatePhase` por compuerta para desfasar los ciclos, y no colocar `brake` en la celda inmediatamente anterior a una `gate` en las plantillas nuevas.
- **Las oleadas solapadas complican la condición de cierre.** Un contador mal llevado deja la oleada abierta para siempre o la cierra dos veces. Mitigación: el cierre se evalúa sobre `delivered + perdidas + enRed` frente a `template.capsules + carriedOver`, con `carriedOver` explícito; criterio de aceptación específico.
- **La carga cognitiva puede desbordar a partir de la oleada 5.** Tres colores, compuertas, patrullas conmutables y tráfico heredado a la vez. Mitigación: los `*_FROM_WAVE` son constantes en `constants.ts` y permiten retrasar cualquier mecánica cambiando un número; riesgo residual aceptado (no hay tests de balance).
- **Entregar mal a propósito es una estrategia de supervivencia infinita.** 25 puntos por cápsula y ninguna vida perdida. Mitigación: es estrictamente peor que jugar bien (`100 × combo` llega a 500) y el reloj de oleada sigue corriendo; riesgo residual aceptado.
- **Los puntajes previos al spec quedan bajo reglas distintas.** Riesgo residual aceptado: la métrica sigue siendo puntos enteros y el leaderboard no distingue versiones.

## Qué **no** está en este spec

- El juego base: rejilla, red, agujas, cápsulas, patrullas, colisiones, descarrilamientos, combo, oleadas, reloj, vidas, registry, portada y fila de `games` son del `01-agujas-jugable.md`.
- Cualquier cambio en `lib/games/types.ts`, en `components/GamePlayer.tsx`, en `POST /api/scores`, en `lib/queries.ts` o en el schema de Supabase.
- Los otros dos juegos del jam (`ranaria` y `garfio`).
- Control directo sobre las cápsulas, input de ratón o táctil, redes generadas por procedimiento, editor de niveles, audio, dificultad seleccionable, persistencia local y tests automatizados.
