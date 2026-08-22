# Spec 05 — Asteroides jugable

**Estado:** aprobado
**Depende de:** 01-mvp-pantallas-visuales
**Fecha:** 2026-08-22

**Objetivo:** Portar el juego Asteroids de `references/started-games/02-asteroids` a TypeScript y montarlo como primer juego real de la plataforma en `/game/asteroides/play`, a través de un registry de juegos que deja el reproductor genérico preparado para los siguientes títulos.

> Se apoya en el reproductor (`app/game/[id]/play/page.tsx`, HUD + CRT + modal FIN) del spec 01 y en `lib/data.ts` del spec 02. No depende de Supabase (spec 04) — el puntaje sigue en `localStorage`.

## Scope

**Incluye:**

- **Portado a TypeScript** de `references/started-games/02-asteroids/game.js` (510 líneas) a `lib/games/asteroids/`:
  - `entities.ts` — clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle` tipadas, sin globals `ctx`/`W`/`H` (reciben contexto y dimensiones como parámetros).
  - `game.ts` — clase `AsteroidsGame` que encapsula el estado que hoy son variables globales (`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `state`, `deadTimer`, `powerUpSpawned`, `killsSinceSpawn`), el loop `requestAnimationFrame`, los listeners de teclado y el `ResizeObserver`.
  - `constants.ts` — `RADII`, `SPEEDS`, `POINTS`, `POWERUP_*`, `TRIPLE_SPREAD` y demás tunables.
- **Registry de juegos extensible:**
  - `lib/games/types.ts` — contrato `GameFactory` / `GameInstance` / `GameState` que todo juego real debe cumplir.
  - `lib/games/registry.ts` — mapa `id → GameFactory` (por ahora solo `asteroides`), cargado con `import()` dinámico para no meter el juego en el bundle de las demás rutas.
- **Reproductor `app/game/[id]/play/page.tsx`:** si el `id` está en el registry monta el juego real sobre un `<canvas>` dentro del `.crt-screen`; si no, conserva intacto el simulador fake actual (puntaje aleatorio con `setInterval`).
- **HUD React conectado al juego:** `score`, `lives`, `level` dejan de ser mock y vienen del juego vía callback `onState`. Se elimina `drawHUD()` del canvas. Se añade un `hud-stat` de power-up que aparece solo mientras `tripleShot > 0`, con `3x` y segundos restantes.
- **Controles del HUD cableados al juego:** `PAUSA` congela el loop (pausa que el juego original no tenía) y muestra el overlay `EN PAUSA` ya existente; `P` y `Escape` también alternan pausa; `FIN` termina la partida y abre el modal con el puntaje actual; `SALIR` destruye la instancia (cancela el `rAF`, quita listeners y el `ResizeObserver`).
- **Canvas responsive 4:3:** el canvas ocupa el ancho del CRT manteniendo relación 4:3; `W`/`H` lógicos se recalculan con `devicePixelRatio` vía `ResizeObserver`, y al redimensionar las posiciones de todas las entidades se reescalan proporcionalmente.
- **Overlay `GAME OVER` en canvas + modal:** al perder la última vida el canvas dibuja el overlay arcade (~1.2 s) y luego se abre el modal de la plataforma. Se elimina el reinicio con `Espacio` del juego original — reiniciar es `JUGAR DE NUEVO` del modal.
- **`preventDefault`** en flechas y `Espacio` mientras el juego está montado, para que no scrolleen la página.
- **Nueva entrada `asteroides` en `GAMES`** (`lib/data.ts`), categoría `SHOOTER`, reusando la clase de portada `cover-rocas`. `rocas` se mantiene sin cambios como mock.
- **Estilos** en `app/globals.css` para el canvas dentro del `.crt-screen` (ancho 100 %, `aspect-ratio: 4/3`, `image-rendering` y fondo negro) y para el `hud-stat` del power-up.
- Estética del juego sin cambios: trazos blancos sobre negro, llama naranja, power-up cian.
- Verificación: `npm run lint`, `npm run build` y prueba manual en navegador.

**NO incluye (fuera de este spec):**

- Controles táctiles para móvil — solo teclado; en pantallas sin teclado se muestra un aviso.
- Persistencia de puntajes en Supabase — sigue `localStorage.av_scores`, igual que hoy.
- Conectar `av_scores` al Hall of Fame o a `/game/[id]`: ambos siguen con `seededScores()`, así que las partidas reales de asteroides no se ven en ninguna tabla de clasificación.
- Portar los otros juegos de `references/started-games/` (tetris, arkanoid) — el registry queda preparado, pero este spec solo registra `asteroides`.
- Modificar el mock `rocas` ni ninguna otra entrada de `GAMES`.
- Cambios en Home, Biblioteca, About, Login o `/game/[id]` (detalle) más allá de que aparezca una tarjeta más en las grillas por la nueva entrada de `GAMES`.
- Repintar el juego con la paleta neón del vault.
- Sonido — el juego original no tiene y no se agrega.
- Tests automatizados y humo con Playwright (no hay test runner configurado).

**Consecuencias aceptadas de este scope:**

- La biblioteca queda con **dos juegos de asteroides**: uno fake (`rocas`) y uno real (`asteroides`).
- El puntaje real se guarda pero **no se muestra en ninguna parte** — el Hall of Fame sigue con datos sembrados.

## Modelo de datos

Este spec no introduce persistencia nueva ni tablas: define el **contrato del registry de juegos** (lo que cualquier juego real debe cumplir para montarse en el reproductor) y agrega una entrada al mock `GAMES`.

### Contrato del registry — `lib/games/types.ts`

```ts
export type GamePhase = "playing" | "paused" | "dead" | "gameover";

/** Estado que el juego publica al HUD React. */
export interface GameState {
  score: number;
  lives: number;
  level: number;
  phase: GamePhase;
  /** Segundos restantes de disparo triple; 0 si no está activo. */
  tripleShot: number;
}

/** Handle que el reproductor usa para controlar la partida desde el HUD. */
export interface GameInstance {
  pause(): void;
  resume(): void;
  /** Termina la partida inmediatamente (botón FIN). */
  end(): void;
  restart(): void;
  /** Cancela el rAF y quita listeners y ResizeObserver. */
  destroy(): void;
}

export interface GameMountOptions {
  canvas: HTMLCanvasElement;
  /** Se invoca a ~10 Hz, no en cada frame, para no re-renderizar React a 60 fps. */
  onState: (state: GameState) => void;
  /** Se invoca una vez, tras el overlay GAME OVER del canvas. */
  onGameOver: (finalScore: number) => void;
}

export type GameFactory = (opts: GameMountOptions) => GameInstance;
```

### Registry — `lib/games/registry.ts`

```ts
/** id de GAMES → loader dinámico del juego. */
export const GAME_REGISTRY: Record<string, () => Promise<GameFactory>> = {
  asteroides: async () => (await import("./asteroids/game")).createAsteroidsGame,
};

export function hasRealGame(id: string): boolean;
```

Los ids ausentes del registry caen al simulador fake actual, sin cambios.

### Estado interno del juego — `lib/games/asteroids/game.ts`

No se exporta; reemplaza las variables globales del `game.js` original:

```ts
interface AsteroidsRuntime {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  particles: Particle[];
  powerUps: PowerUp[];
  score: number;
  lives: number;
  level: number;
  phase: GamePhase;
  deadTimer: number;
  gameOverTimer: number; // ~1.2 s de overlay antes de llamar onGameOver
  powerUpSpawned: boolean;
  killsSinceSpawn: number;
  /** Dimensiones lógicas actuales (antes constantes W=800, H=600). */
  w: number;
  h: number;
}
```

Cada entidad (`Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`) pasa a recibir `w`/`h` en `update(dt, w, h)` y `ctx` en `draw(ctx)`, en vez de leer los globales del módulo.

### Nueva entrada en `lib/data.ts`

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Rota, propulsa y fragmenta rocas en el vacío.",
  long: "Vectores blancos sobre negro absoluto. Tu nave gira, acelera por inercia y dispara contra rocas que se parten en fragmentos más veloces. El espacio es toroidal: lo que sale por un borde vuelve por el opuesto. Recoge el núcleo cian para disparo triple.",
  cat: "SHOOTER",
  cover: "cover-rocas",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

`best: 0` / `plays: "0"` porque es el primer juego real y todavía no acumula partidas — el resto de entradas son cifras inventadas del mock.

## Plan de implementación

1. **Consultar la doc vendored.** Revisar `node_modules/next/dist/docs/` antes de escribir código: `01-app/02-guides` (lazy loading / `next/dynamic` e `import()` dinámico) y `03-api-reference/03-file-conventions` para confirmar el patrón de client component con `useRef`/`useEffect` sobre un `<canvas>` en Next 16.2.10 con React 19 (Strict Mode monta y desmonta dos veces en dev — el `destroy()` debe dejar todo limpio).

2. **Contrato del registry.** Crear `lib/games/types.ts` con `GamePhase`, `GameState`, `GameInstance`, `GameMountOptions` y `GameFactory` tal como quedaron en el modelo de datos. Punto de corte compilable: no hay consumidores todavía.

3. **Constantes y entidades.** Crear `lib/games/asteroids/constants.ts` (`RADII`, `SPEEDS`, `POINTS`, `POWERUP_DROP_CHANCE`, `POWERUP_DURATION`, `POWERUP_TTL`, `TRIPLE_SPREAD`) y `lib/games/asteroids/entities.ts` portando `Bullet`, `Asteroid`, `PowerUp`, `Ship` y `Particle` a TypeScript, con `update(dt, w, h)` y `draw(ctx)` — sin leer globales de módulo. Se conservan `wrap`, `dist`, `rand`, `randInt` como utilidades del mismo archivo o de `utils.ts`.

4. **Clase del juego.** Crear `lib/games/asteroids/game.ts` con `createAsteroidsGame(opts)`: estado en `AsteroidsRuntime`, loop `rAF` con `dt` capado a 50 ms, `update`/`draw`, `spawnAsteroids`, `nextLevel`, `explode`, `killShip`, colisiones y power-up — misma lógica que el original. Sin `drawHUD()` y sin reinicio con `Espacio`. Devuelve un `GameInstance`.

5. **Pausa.** Añadir la fase `paused`: `pause()` deja de actualizar (el loop sigue dibujando el último frame o se detiene, sin acumular `dt`), `resume()` reanuda reseteando `lastTime` para que no llegue un `dt` gigante. Registrar `P` y `Escape` como alternadores de pausa.

6. **Fin de partida.** `end()` (botón FIN) y la pérdida de la última vida llevan a `phase = "gameover"`: el canvas dibuja el overlay `GAME OVER` con `drawOverlay()` durante ~1.2 s (`gameOverTimer`) y al agotarse se invoca `onGameOver(score)` una sola vez. `restart()` vuelve a `initGame()`.

7. **Canvas responsive.** En el montaje, `ResizeObserver` sobre el contenedor: el canvas toma el ancho disponible con relación 4:3, se fija `canvas.width/height = tamañoCSS * devicePixelRatio` y se aplica `ctx.scale(dpr, dpr)`. Al cambiar `w`/`h` lógicos, reescalar proporcionalmente las posiciones de nave, asteroides, balas, partículas y power-ups (`x * nuevoW / viejoW`, ídem `y`). `SAFE_DIST` de `spawnAsteroids` pasa a ser proporcional a `min(w, h)` en vez de 130 px fijos.

8. **Publicación de estado.** Emitir `onState` a ~10 Hz (acumulador de tiempo dentro del loop, más una emisión inmediata en cada cambio de `phase`, vida o nivel) con `score`, `lives`, `level`, `phase` y `tripleShot`.

9. **Registry.** Crear `lib/games/registry.ts` con `GAME_REGISTRY` (`asteroides` → `import()` dinámico de `game.ts`) y `hasRealGame(id)`.

10. **Entrada en el mock.** Agregar el objeto `asteroides` a `GAMES` en `lib/data.ts`, sin tocar `rocas` ni las demás entradas.

11. **Reproductor.** Modificar `app/game/[id]/play/page.tsx`:
    - Si `hasRealGame(game.id)`: montar el juego sobre un `<canvas>` dentro del `.crt-screen` (reemplazando `.game-arena` con sus divs decorativos), cargar la factory con el `import()` del registry, cablear `onState` al estado de React y `onGameOver` a la apertura del modal, y llamar `destroy()` en el cleanup del `useEffect`.
    - Si no: dejar exactamente el comportamiento actual (arena decorativa + `setInterval` de puntaje aleatorio).
    - `lives` deja de ser `useState(3)` fijo y pasa a venir del estado del juego cuando es real.
    - `PAUSA` → `pause()`/`resume()`, `FIN` → `end()`, `JUGAR DE NUEVO` → `restart()`, `SALIR` → `destroy()` vía cleanup al navegar.
    - `preventDefault` en `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`/`Space` mientras el juego real está montado.

12. **HUD de power-up y aviso móvil.** Agregar el `hud-stat` que aparece solo con `tripleShot > 0` (`3x` + segundos con un decimal) y un aviso de "requiere teclado" visible solo en viewports pequeños / sin teclado físico.

13. **Estilos.** En `app/globals.css`: reglas del `<canvas>` dentro de `.crt-screen` (`width: 100%`, `aspect-ratio: 4/3`, `display: block`, fondo negro) y del `hud-stat` del power-up, siguiendo las CSS vars existentes. La decoración `.game-arena` (`enemy e1/e2/e3`, `player-ship`) NO se borra: sigue en uso por los juegos mock.

14. **Verificación.** `npm run lint` y `npm run build` sin errores. Prueba manual en `npm run dev`: jugar `/game/asteroides/play` (rotar, propulsar, disparar, fragmentar, recoger el 3x), pausar con botón y con `P`/`Escape`, perder las 3 vidas → overlay + modal → guardar puntaje → `JUGAR DE NUEVO`, `SALIR` y volver (sin listeners colgados ni doble loop), redimensionar la ventana durante la partida, y comprobar que `/game/rocas/play` sigue con el simulador fake.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] `GAMES` incluye la entrada `asteroides` (categoría `SHOOTER`, cover `cover-rocas`) y la entrada `rocas` queda idéntica a antes del spec.
- [ ] Existen `lib/games/types.ts` y `lib/games/registry.ts`, y `GAME_REGISTRY` mapea `asteroides` a un `import()` dinámico de `lib/games/asteroids/game.ts`.
- [ ] `lib/games/asteroids/` no contiene `any` implícitos ni variables de módulo mutables que hagan de estado global: dos instancias del juego pueden coexistir sin interferirse.
- [ ] `/game/asteroides/play` monta un `<canvas>` dentro del CRT y la nave responde a `←`/`→` (rotar), `↑` (propulsar) y `Espacio` (disparar).
- [ ] Los asteroides se envuelven por los bordes, se fragmentan de tamaño 3 → 2 → 1, y los de tamaño 1 no se fragmentan.
- [ ] El HUD React muestra puntuación, vidas y nivel provenientes del juego (no del `setInterval` aleatorio) y se actualizan al destruir asteroides, morir y completar nivel.
- [ ] El canvas ya no dibuja `SCORE` / `NIVEL` / iconos de vidas (`drawHUD()` eliminado).
- [ ] Al recoger el power-up, el HUD muestra un indicador `3x` con los segundos restantes, que desaparece al expirar, y la nave dispara tres balas en abanico mientras está activo.
- [ ] `PAUSA` congela la partida y muestra el overlay `EN PAUSA`; `REANUDAR` continúa sin que la nave salte de posición (sin `dt` acumulado). `P` y `Escape` alternan la pausa igual que el botón.
- [ ] `FIN` termina la partida inmediatamente y abre el modal con el puntaje actual.
- [ ] Al perder la tercera vida, el canvas muestra el overlay `GAME OVER` y después aparece el modal de la plataforma. `Espacio` durante el game over no reinicia el juego.
- [ ] El modal guarda `{ game: "asteroides", score, name, at }` en `localStorage.av_scores` y `JUGAR DE NUEVO` reinicia una partida limpia (puntaje 0, 3 vidas, nivel 1).
- [ ] Redimensionar la ventana durante la partida mantiene la relación 4:3, no deforma el trazo y no expulsa entidades fuera del área jugable.
- [ ] El canvas se renderiza nítido en pantallas HiDPI (`devicePixelRatio > 1`).
- [ ] Las flechas y `Espacio` no scrollean la página mientras el juego está montado, y sí vuelven a hacerlo al salir de la ruta.
- [ ] Salir con `SALIR` o navegar fuera detiene el loop: no queda `requestAnimationFrame` activo ni listeners de teclado registrados, y volver a entrar no duplica el loop (verificado también en dev con React Strict Mode).
- [ ] En viewport pequeño se muestra el aviso de que el juego requiere teclado.
- [ ] `/game/rocas/play` y el resto de ids siguen mostrando el simulador fake sin cambios.
- [ ] Hall of Fame y `/game/[id]` siguen mostrando `seededScores()`; ninguna partida real aparece en esas tablas.

## Decisiones tomadas y descartadas

- **Portado a TypeScript + React en vez de `<iframe>` o script vanilla.** Se descarta el iframe (copiar `game.js`/`index.html` a `public/`) porque el HUD y el puntaje solo podrían comunicarse por `postMessage` y el juego quedaría visualmente ajeno al marco CRT. Se descarta montar el JS vanilla casi intacto porque arrastraría globals de módulo al bundle, impidiendo dos instancias y dejando el juego sin tipar. El portado cuesta más ahora y se paga en todos los juegos siguientes.

- **Registry extensible en vez de `if (id === "asteroides")`.** Hay al menos dos juegos más esperando en `references/started-games/` (tetris, arkanoid); un condicional obligaría a refactorizar el reproductor en el próximo. El registry con `import()` dinámico además mantiene el código del juego fuera del bundle de las rutas que no lo usan.

- **Entrada nueva `asteroides` en vez de reusar `rocas`.** Decisión explícita del usuario. Costo aceptado: la biblioteca queda con dos juegos de asteroides, uno real y uno fake, hasta que un spec futuro limpie el mock.

- **HUD en React, `drawHUD()` eliminado del canvas.** Se descarta mantener ambos HUD (duplicado visual) y se descarta ocultar el HUD de la plataforma (rompería la consistencia del reproductor con el resto de las pantallas). Una sola fuente de verdad: el estado que el juego emite.

- **`onState` a ~10 Hz, no en cada frame.** Se descarta emitir a 60 fps porque forzaría 60 re-renders por segundo del reproductor. El único efecto visible es que el contador del power-up avanza a saltos de 100 ms.

- **Canvas responsive real (4:3 forzado) en vez de 800×600 escalado por CSS.** Decisión explícita del usuario. Se acota a relación fija para que la densidad de asteroides no cambie con la forma de la pantalla, y se descarta el ratio libre porque en pantallas anchas el campo quedaría panorámico y habría que escalar el número de asteroides por área.

- **Se conserva el overlay `GAME OVER` del canvas además del modal.** Decisión explícita del usuario: sabor arcade antes del flujo de la plataforma. Se descarta el reinicio con `Espacio` del original — habría dos formas de reiniciar compitiendo con `JUGAR DE NUEVO`.

- **Se añade pausa, que el juego original no tenía.** El HUD ya tiene botón `PAUSA` y overlay `EN PAUSA`; dejarlos inertes sería peor que implementar la fase. Se descarta quitar los botones.

- **Puntaje en `localStorage.av_scores`, no en Supabase.** El spec 04 dejó Supabase cableado pero sin tablas ni auth; guardar puntajes reales implica modelar la tabla, activar RLS y decidir la identidad del jugador — es un spec propio. Costo aceptado: los puntajes reales se guardan pero no se muestran en ninguna pantalla.

- **Hall of Fame y `/game/[id]` intactos.** Se descarta mezclar `av_scores` con `seededScores()` porque tocaría dos pantallas más y obligaría a decidir el criterio de merge y orden.

- **Estética vectorial blanca original.** Se descarta repintar con la paleta neón del vault: el trazo blanco sobre negro ya contrasta bien dentro del marco CRT y repintarlo añadiría una fase de diseño al spec.

- **Solo teclado.** Se descarta el overlay de controles táctiles (diseño de zonas, pruebas en dispositivo real); en su lugar, aviso de "requiere teclado" en viewports pequeños.

- **Verificación manual, sin humo automatizado.** El proyecto no tiene test runner y añadir Playwright exigiría hooks de test dentro del juego. Los criterios de aceptación están redactados para comprobarse a mano.

## Riesgos identificados

- **El canvas responsive puede alterar el balance del juego.** Toda la física original está calibrada para 800×600 (velocidades en px/s, radios en px, `SAFE_DIST` de 130 px). En un canvas de 1400 px de ancho la nave se siente lenta y el campo vacío; en uno de 500 px, agobiante. Mitigación parcial: relación 4:3 fija y `SAFE_DIST` proporcional (paso 7). Riesgo residual aceptado — si el gameplay se siente mal en los extremos, la salida es acotar el rango de tamaños (opción "fluido con límites" que quedó descartada).

- **Reescalar posiciones al redimensionar puede colocar entidades en estado inválido.** Al aplicar el factor proporcional, un asteroide puede terminar superpuesto a la nave y matarla por un resize, no por jugar mal. Mitigación: mantener la invencibilidad activa como está y verificar el redimensionado en el paso 14; si aparece, la mitigación es conceder invencibilidad breve tras un resize.

- **React 19 Strict Mode monta y desmonta dos veces en dev.** Si `destroy()` no cancela el `rAF`, los listeners de teclado y el `ResizeObserver`, quedan dos loops corriendo: el juego va al doble de velocidad y el puntaje sube doble, solo en desarrollo. Mitigación: criterio de aceptación explícito sobre Strict Mode y cleanup completo en el `useEffect`.

- **`preventDefault` global sobre flechas y `Espacio` puede secuestrar la navegación por teclado.** Si el listener sobrevive a la salida de la ruta, o captura eventos mientras el foco está en el input de iniciales del modal, el usuario no puede escribir ni scrollear. Mitigación: el listener vive con la instancia del juego y se ignora cuando el foco está en un campo de formulario; criterio de aceptación cubre que las teclas vuelvan a funcionar al salir.

- **Dos juegos de asteroides en la biblioteca.** `rocas` (fake) y `asteroides` (real) conviven con la misma portada y la misma temática; un usuario que entre por `rocas` verá el simulador de puntaje aleatorio y creerá que el juego está roto. Mitigación: ninguna en este spec — consecuencia aceptada de no tocar el mock. Un spec futuro debería retirar o repurposear `rocas`.

- **Los puntajes reales no son visibles en ninguna pantalla.** `av_scores` acumula partidas que ni el Hall of Fame ni el detalle del juego leen, así que el ciclo "competir por puntaje" — la promesa del producto — queda incompleto para el primer juego real. Mitigación: fuera de scope explícito; es el candidato natural al siguiente spec.

- **`dt` capado a 50 ms más pausa mal implementada.** Si `resume()` no resetea `lastTime`, el primer frame tras la pausa llega con un `dt` enorme (capado a 50 ms, pero suficiente para teletransportar la nave y saltar colisiones). Mitigación: paso 5 del plan lo trata explícitamente y hay criterio de aceptación sobre ello.
