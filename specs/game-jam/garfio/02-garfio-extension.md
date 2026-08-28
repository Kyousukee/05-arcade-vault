# Spec jam travesía peligrosa — GARFIO extensión

**Estado:** borrador
**Depende de:** 05-asteroides-jugable, 06-juegos-y-leaderboard, game-jam/garfio/01-garfio-jugable
**Fecha:** 2026-08-27

**Objetivo:** Dar profundidad a Garfio con anclas que no se pueden reutilizar (frágiles, deslizantes y de un solo uso), viento lateral por tramo, un dash de aire con carga limitada, células que alargan el reloj y tramos con puerta temporizada, todo sin tocar el contrato `GameState`.

> Nota de contexto: jam del tema **«travesía peligrosa: cruzar obstáculos en movimiento contra reloj»**. Fase 2 de Garfio; **no se sostiene sola**: parte de `01-garfio-jugable.md`, que deja el juego registrado, jugable, con su fila en `games` y su portada. El 01 enseña a columpiarse; este spec quita las certezas — el ancla se rompe, el aire empuja, la puerta se cierra — y añade el único recurso ofensivo del jugador, el dash, para que la respuesta a esa presión sea una decisión y no un reflejo.

## Alcance

**Incluye:**

- **Anclas frágiles:** un porcentaje de las anclas generadas (`FRAGILE_RATIO = 0.25` a nivel 1, hasta `0.45`) se agrieta al engancharse y se rompe tras `FRAGILE_HOLD_MS = 900` de uso continuo, soltando al jugador. Se dibujan con el aro discontinuo y se cuartean visiblemente durante el enganche.
- **Anclas deslizantes:** anclas que, al engancharse, empiezan a desplazarse horizontalmente a `SLIDER_SPEED = 90` px lógicos/s en el sentido de la travesía y se detienen al soltarlas. Arrastran al jugador consigo: son un premio si se usan bien, un peligro si se abusa.
- **Anclas de un solo uso:** se apagan tras el primer soltado y no vuelven a engancharse en esa vida. Reaparecen al reaparecer el jugador en la baliza.
- **Viento por tramo:** cada `Segment` lleva un `wind` (`-1 | 0 | 1`) con intensidad `WIND_ACCEL = 220` px lógicos/s², que se aplica **solo en modo `free`**. Se señaliza en el fondo del tramo con líneas de deriva orientadas.
- **Dash de aire:** con `Shift` (o `X`) en modo `free`, un impulso instantáneo de `DASH_SPEED = 520` px lógicos/s en la dirección del movimiento horizontal actual. Cargas limitadas: `DASH_MAX = 2`, se recuperan al enganchar un ancla o al atravesar una baliza. El dash da `DASH_IFRAMES = 120` ms de invulnerabilidad frente a drones.
- **Células de tiempo:** coleccionables suspendidos entre balizas que suman `CELL_TIME = 3` s al reloj (sin superar `TIME_LIMIT`) y `+50` puntos. Una por tramo como máximo, colocada fuera de la trayectoria cómoda.
- **Tramos con puerta:** desde `GATE_FROM_LEVEL = 3`, un tramo de cada tres tiene una **puerta** — una barrera vertical con un hueco que se abre y se cierra con periodo `GATE_CYCLE_MS = 3400`. Atravesarla cerrada mata; el hueco se dibuja con su cuenta de cierre.
- **Bonus de tramo limpio:** cruzar un tramo completo sin morir y sin tocar la puerta suma `+75`, dibujado como destello en el borde del canvas. No usa ningún campo nuevo del HUD.
- **Escalonado por nivel** en `constants.ts`: `FRAGILE_FROM_LEVEL = 1`, `SLIDER_FROM_LEVEL = 2`, `ONESHOT_FROM_LEVEL = 3`, `WIND_FROM_LEVEL = 2`, `GATE_FROM_LEVEL = 3`, con las proporciones de cada tipo de ancla creciendo por nivel hasta un techo.
- **Garantía de viabilidad reforzada:** la generación asegura que **al menos una** ancla por tramo es normal (ni frágil, ni deslizante, ni de un solo uso), para que ningún tramo dependa de un ancla que puede desaparecer.
- **Verificación:** `npm run lint`, `npm run build` y prueba manual del recorrido completo, incluidos los otros juegos del vault.

**NO incluye (fuera de este spec):**

- Cambios en `lib/games/types.ts` y en `components/GamePlayer.tsx`: este spec **no toca el contrato**. Cargas de dash, viento y bonus se dibujan en el canvas.
- Cambios en la fila `garfio` de `games`, en `GAME_REGISTRY` o en la portada `cover-garfio`: ya existen desde el 01.
- Cuerda elástica o de longitud variable: sigue siendo fija durante el enganche, como en el 01.
- Enemigos que persigan o disparen al jugador: los drones siguen patrullando su segmento vertical sin IA.
- Niveles diseñados a mano, editor o semillas seleccionables por el jugador.
- Assets en `public/games/garfio/`, audio, controles táctiles y persistencia local.
- Tests automatizados (no hay test runner configurado).

**Consecuencias aceptadas de este scope:**

- Los puntajes anteriores y posteriores a este spec conviven en el mismo leaderboard de `garfio` bajo reglas distintas. Se acepta: la métrica sigue siendo puntos enteros comparables, y el 02 añade tanto dificultad como fuentes de puntos.
- El dash reduce la letalidad del mal soltado que el 01 asumía como núcleo. Se acepta porque su coste (cargas limitadas, recuperables solo enganchando) mantiene la decisión: gastar la carga o confiar en el swing.
- Con cinco sistemas nuevos, el tuning del nivel 3 en adelante es incierto y solo se valida a mano.
- El bonus de tramo limpio favorece al jugador que ya va bien, ensanchando la distancia en el leaderboard entre principiante y experto.

## Modelo de datos

Este spec no crea tablas, no toca `public.games` ni `public.scores` y **no modifica `lib/games/types.ts`**. El mapeo al `GameState` es idéntico al del 01: `score`, `level`, `lives`, `phase` y `tripleShot: 0`, sin campos opcionales nuevos. Todo lo demás vive en el `runtime` y se dibuja en el canvas.

### Campos nuevos del `runtime` — `lib/games/garfio/game.ts`

Se añaden a `GarfioRuntime` del 01; el resto se mantiene idéntico.

```ts
type AnchorKind = "normal" | "fragile" | "slider" | "oneshot";

interface AnchorExt {
  kind: AnchorKind;
  holdMs: number; // ms acumulados de enganche, solo "fragile"
  broken: boolean; // "fragile" rota o "oneshot" gastada
  slideX: number; // desplazamiento acumulado, solo "slider"
}

interface Gate {
  x: number; // posición en mundo
  gapY: number; // centro del hueco
  gapH: number; // alto del hueco cuando está abierto
  cycleT: number; // ms dentro de GATE_CYCLE_MS
}

interface Cell {
  x: number;
  y: number;
  taken: boolean;
}

interface SegmentExt {
  wind: -1 | 0 | 1;
  gate: Gate | null;
  cell: Cell | null;
  cleared: boolean; // cruzado sin morir ni tocar la puerta
}

interface GarfioRuntimeExt {
  dashCharges: number; // 0…DASH_MAX
  dashIframes: number; // ms restantes de invulnerabilidad
  currentSegment: number; // índice del tramo que ocupa el jugador
  segmentDirty: boolean; // true si murió o tocó la puerta en este tramo
}
```

`AnchorExt` se fusiona en el `Anchor` del 01 (mismo objeto, campos añadidos) y `SegmentExt` en el `Segment`. Todo por instancia: ningún global de módulo, PRNG incluido.

### Reglas nuevas

- **Frágil:** mientras `mode === "hooked"` sobre un ancla `fragile`, `holdMs += dt * 1000`. Al superar `FRAGILE_HOLD_MS`, `broken = true` y el jugador pasa a `free` con la velocidad tangencial del instante (mismo cálculo que el soltado normal, sin `RELEASE_BOOST`). Un ancla rota no se puede volver a enganchar hasta la reaparición.
- **Deslizante:** mientras está enganchada, `anchor.x += SLIDER_SPEED * dt` y `slideX` acumula. El pivote del péndulo se recalcula con la posición nueva, de modo que el jugador es arrastrado. Al soltar, el ancla se queda donde esté.
- **Un solo uso:** al soltar un ancla `oneshot`, `broken = true`.
- **Viento:** en modo `free`, `vx += segment.wind * WIND_ACCEL * dt`. En modo `hooked` no se aplica: el péndulo ya está restringido y añadir viento angular haría el swing impredecible.
- **Dash:** `Shift` o `X` en modo `free` con `dashCharges > 0`: `vx = sign(vx || 1) * DASH_SPEED`, `vy = min(vy, 0)` (corta la caída sin lanzar hacia arriba), `dashCharges -= 1`, `dashIframes = DASH_IFRAMES`. Enganchar o atravesar una baliza pone `dashCharges = DASH_MAX`.
- **Puerta:** la barrera es mortal salvo en el hueco. `cycleT` recorre `GATE_CYCLE_MS`: el hueco se abre a `gapH` durante el 55 % del ciclo y se cierra a 0 durante el resto, con interpolación. Tocar la barrera mata y marca `segmentDirty`.
- **Célula:** al solapar la célula, `taken = true`, `timeLeft = min(TIME_LIMIT, timeLeft + CELL_TIME)`, `score += 50`.
- **Tramo limpio:** al pasar de un tramo al siguiente con `segmentDirty === false`, `score += 75` y destello. Morir o tocar la puerta pone `segmentDirty = true` hasta el cambio de tramo.
- **Reaparición:** al reaparecer en la baliza, todas las anclas `broken` de los tramos vivos vuelven a `broken = false` y `holdMs = 0`, las deslizantes vuelven a su `x` original y `dashCharges = DASH_MAX`.

## Plan de implementación

Cada paso deja el repo compilando (`npm run build` verde). El orden va de lo aislado (tipos de ancla) a lo transversal (puerta y bonus de tramo).

1. **Consultar la doc vendored.** Repasar en `node_modules/next/dist/docs/` lo relativo a componentes cliente antes de tocar el juego. No hay rutas, assets ni config nuevos.
2. **Constantes.** Añadir a `constants.ts` los valores del alcance (`FRAGILE_RATIO`, `FRAGILE_HOLD_MS`, `SLIDER_SPEED`, `WIND_ACCEL`, `DASH_SPEED`, `DASH_MAX`, `DASH_IFRAMES`, `CELL_TIME`, `GATE_CYCLE_MS`, y los `*_FROM_LEVEL`).
3. **Tipos de ancla.** Añadir `kind`, `holdMs`, `broken` y `slideX` al `Anchor` de `entities.ts` y su dibujo diferenciado (aro discontinuo para la frágil, flecha para la deslizante, aro apagado para la gastada). En este paso todas las anclas se generan `normal`: nada cambia todavía en el juego.
4. **Frágiles.** Generación con `FRAGILE_RATIO` por nivel, acumulación de `holdMs`, rotura y soltado forzado. Verificar que la garantía de al menos un ancla `normal` por tramo se cumple en `world.ts`.
5. **Deslizantes y de un solo uso.** Desplazamiento del pivote durante el enganche y apagado tras el soltado, con sus `*_FROM_LEVEL`.
6. **Viento.** `wind` por tramo en la generación, aplicación en modo `free` y señalización en el fondo del tramo.
7. **Dash.** Tecla, cargas, recuperación al enganchar y en baliza, i-frames frente a drones e indicador de cargas dibujado en la franja superior del canvas.
8. **Células de tiempo.** Generación fuera de la trayectoria cómoda, recogida, `+50` y recarga del reloj.
9. **Puertas.** `Gate` por tramo desde `GATE_FROM_LEVEL`, ciclo de apertura, colisión mortal con la barrera y dibujo del hueco con su cuenta de cierre.
10. **Tramo limpio.** `currentSegment`, `segmentDirty`, `+75` al cambiar de tramo limpio y destello.
11. **Reaparición y reinicio.** Restaurar anclas rotas y deslizadas, cargas de dash y estado de puerta al reaparecer; `restart()` reconstruye todo desde la semilla base.
12. **Verificación.** `npm run lint`, `npm run build` y prueba manual: romper un ancla frágil aguantando, dejarse arrastrar por una deslizante, gastar las dos cargas de dash y recuperarlas enganchando, atravesar una puerta abierta y morir contra una cerrada, recoger una célula y ver subir el reloj, encadenar dos tramos limpios, y comprobar que Asteroides, Caída, Bloque Buster, Serpentina y Ranaria siguen igual.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] `lib/games/types.ts` y `components/GamePlayer.tsx` **no** han sido modificados por este spec, y el HUD de Garfio sigue mostrando exactamente Puntuación, Vidas y Nivel.
- [ ] Enganchar un ancla frágil la agrieta visiblemente y, tras ~0,9 s de enganche continuo, la rompe y suelta al jugador con la velocidad del swing.
- [ ] Un ancla rota no se puede volver a enganchar en esa vida y vuelve a estar disponible tras reaparecer en la baliza.
- [ ] Enganchar un ancla deslizante la pone en movimiento horizontal y arrastra al jugador consigo; soltarla la detiene donde esté.
- [ ] Un ancla de un solo uso se apaga tras el primer soltado y no vuelve a enganchar hasta la reaparición.
- [ ] Cada tramo generado contiene al menos un ancla `normal`, comprobable recorriendo diez tramos seguidos sin quedar bloqueado.
- [ ] Desde el nivel 2 hay tramos con viento: en caída libre el jugador deriva visiblemente hacia el lado señalizado en el fondo, y colgado no se aprecia deriva angular anómala.
- [ ] `Shift` (o `X`) en caída libre consume una carga y produce un impulso horizontal claro; con 0 cargas no hace nada.
- [ ] Las cargas de dash se recuperan al enganchar un ancla y al atravesar una baliza, y se dibujan en la franja superior del canvas.
- [ ] Un dash atraviesa un drone sin morir dentro de sus ~120 ms de invulnerabilidad, y morir sigue siendo posible fuera de esa ventana.
- [ ] Recoger una célula de tiempo suma 3 s al reloj (sin superar 20 s) y 50 puntos, y la célula no se puede recoger dos veces.
- [ ] Desde el nivel 3 aparecen puertas cuyo hueco se abre y se cierra cíclicamente; pasar por el hueco abierto es seguro y tocar la barrera resta una vida.
- [ ] Cruzar un tramo sin morir y sin tocar la puerta suma 75 puntos con destello; morir en el tramo lo anula hasta el tramo siguiente.
- [ ] Al reaparecer en la baliza, las anclas rotas vuelven a estar disponibles, las deslizantes vuelven a su posición original y las cargas de dash están al máximo.
- [ ] `JUGAR DE NUEVO` deja el mundo idéntico al de una partida nueva del 01 más los sistemas de este spec en su estado inicial (nivel 1: sin viento, sin puertas, sin anclas de un solo uso).
- [ ] `lib/games/garfio/` sigue sin variables de módulo mutables, PRNG incluido: dos instancias coexisten sin interferirse.
- [ ] `PAUSA` congela viento, puertas, anclas deslizantes y el temporizador de frágiles; `REANUDAR` continúa sin salto.
- [ ] Redimensionar durante la partida no altera la posición lógica de anclas, puertas, células ni jugador, ni deja al jugador colgado de un ancla inexistente.
- [ ] `SALIR` o navegar fuera detiene el loop y quita listeners y `ResizeObserver`; volver a entrar no lo duplica (verificado en dev con React Strict Mode).
- [ ] Las flechas, `Space` y `Shift` no scrollean ni disparan atajos del navegador durante la partida, y el input de iniciales del modal sigue aceptando texto.
- [ ] La fila `garfio` de `games`, su `sort_order = 9` y su entrada en `GAME_REGISTRY` no han cambiado respecto al 01.
- [ ] Todo lo verificado en los criterios del `01-garfio-jugable.md` sigue cumpliéndose: enganche, swing, bombeo, soltado, balizas, reloj, metros, racha, vidas y `GAME OVER`.
- [ ] Asteroides, Caída, Bloque Buster, Serpentina y Ranaria siguen funcionando exactamente igual.

## Decisiones tomadas y descartadas

- **Cero cambios en `GameState`.** Se descartan campos opcionales para cargas de dash y viento: el jugador está mirando el canvas y el indicador cabe en la franja superior. Además, mantener Garfio fuera de `types.ts` permite implementar este spec y el de Ranaria del mismo jam sin conflicto de merge.
- **Ancla frágil por tiempo de enganche, no por número de usos.** Se descarta la rotura al segundo enganche: no comunica urgencia mientras se está colgado. Con un temporizador visible en el agrietado, el jugador **ve** cuánto le queda y decide cuándo soltar, que es la decisión central del juego.
- **La frágil suelta sin `RELEASE_BOOST`.** Se descarta darle el mismo impulso que un soltado voluntario: premiaría aguantar hasta la rotura en vez de soltar a tiempo.
- **Viento solo en caída libre.** Se descarta aplicarlo también al péndulo: una aceleración lateral sobre un ángulo restringido produce un swing que el jugador no puede predecir ni compensar, y volvería inútil el bombeo.
- **Dash con cargas recuperables al enganchar.** Se descarta el dash con cooldown por tiempo (invita a esperar en el aire, justo lo contrario del tema) y se descarta el dash infinito, que convertiría el juego en vuelo horizontal y anularía las anclas.
- **El dash da i-frames cortos frente a drones.** Se descarta que atraviese también las puertas: la puerta es un reloj, y una llave universal la anularía como obstáculo.
- **Puertas desde el nivel 3, una de cada tres tramos.** Se descarta ponerlas en todos los tramos: obligaría a esperar el ciclo constantemente y el reloj de 20 s haría la travesía inviable.
- **Bonus de tramo limpio en vez de multiplicador global.** Se descarta el multiplicador: se acopla con la racha de enganches del 01 y produce puntuaciones explosivas difíciles de comparar.
- **Garantía de un ancla `normal` por tramo.** Se descarta la generación puramente aleatoria de tipos: un tramo con solo anclas frágiles y de un solo uso puede ser irrecuperable tras una muerte, y con semilla fija sería un bloqueo permanente para todos los jugadores.
- **Las anclas rotas se restauran al reaparecer, no al cambiar de tramo.** Se descarta restaurarlas al salir de cámara: dejaría al jugador atrapado detrás de anclas gastadas al retroceder, y romper y volver es una forma de farmear racha.
- **Todo dibujado con formas, sin assets.** Coherente con el 01 y con la regla del jam de no inventar archivos que no existen.
- **Sin cambios en la fila `games` ni en el registry.** Ya existen desde el 01; repetirlos aquí duplicaría la migración y arriesgaría un `insert` sobre una PK existente.

## Riesgos identificados

- **El canvas responsive altera el balance calibrado en píxeles.** `WIND_ACCEL`, `DASH_SPEED` y `SLIDER_SPEED` están en px lógicos/s. Mitigación: la física sigue en el espacio lógico fijo 800×600 del 01; el escalado es solo `setTransform`.
- **El reescalado al redimensionar puede dejar entidades en estado inválido.** Un jugador colgado de un ancla deslizante mantiene una referencia viva mientras el pivote se mueve. Mitigación: `applyResize()` no toca posiciones ni referencias; criterio de aceptación propio.
- **React Strict Mode monta dos veces en dev.** Dos loops duplicarían el avance de las anclas deslizantes y el ciclo de las puertas. Mitigación: `destroy()` idempotente del 01 sin cambios; todos los sistemas nuevos viven en el `runtime` por instancia.
- **El `preventDefault` global secuestra el teclado.** `Shift` **no** está en `BLOCKED_KEYS` de `components/GamePlayer.tsx`, así que no se bloquea; si la implementación lo añadiera, podría interferir con la escritura en mayúsculas del input de iniciales. Mitigación: no tocar `BLOCKED_KEYS`; ofrecer `X` como alternativa y verificar el modal en la prueba manual.
- **`Shift` puede activar atajos de accesibilidad del sistema.** Cinco pulsaciones seguidas abren las StickyKeys de Windows. Mitigación: `X` como tecla alternativa documentada en el aviso del juego; riesgo residual aceptado.
- **La combinación de viento, puerta y anclas frágiles puede hacer tramos imposibles con semilla fija.** Un tramo con viento en contra, puerta y solo un ancla normal puede ser matemáticamente irresoluble dentro del reloj. Mitigación: la garantía de ancla normal por tramo, no colocar puerta y viento en contra en el mismo tramo, y verificación manual de diez tramos seguidos en la prueba del paso 12.
- **El dash puede colar al jugador a través de la barrera de la puerta.** A `DASH_SPEED = 520` y `dt` de 0,05 s el desplazamiento por frame es 26 px; una barrera más fina tunelaría. Mitigación: barrera de al menos 40 px lógicos de grosor y colisión por barrido del segmento recorrido en el frame.
- **Cinco sistemas nuevos hacen el tuning incierto.** No hay tests de balance ni forma automática de detectar una curva rota. Mitigación: todos los valores son constantes en `constants.ts` y los `*_FROM_LEVEL` permiten desactivar un sistema entero cambiando un número; riesgo residual aceptado.
- **Los puntajes previos al spec quedan bajo reglas distintas.** Riesgo residual aceptado: la métrica sigue siendo puntos enteros y el leaderboard no distingue versiones.

## Qué **no** está en este spec

- El juego base: física del péndulo, enganche, cámara, generación de tramos, drones, balizas, reloj, metros, racha, vidas, registry, portada y fila de `games` son del `01-garfio-jugable.md`.
- Cualquier cambio en `lib/games/types.ts`, en `components/GamePlayer.tsx`, en `POST /api/scores`, en `lib/queries.ts` o en el schema de Supabase.
- Los otros dos juegos del jam (`ranaria` y `agujas`).
- Audio, controles táctiles, niveles diseñados a mano, dificultad seleccionable, persistencia local y tests automatizados.
