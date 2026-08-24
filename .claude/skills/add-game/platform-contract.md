# Contrato de la plataforma Arcade Vault

Mapa de rutas y contratos que un juego nuevo debe respetar. El skill `/add-game` lo consulta
para que el spec cite archivos y símbolos reales en vez de inventarlos.

**Este documento describe el repo, no lo define.** Antes de citar cualquier ruta en un spec,
ábrela y comprueba que sigue existiendo con esa forma. Si algo ya no coincide, gana el código
y hay que actualizar este archivo.

---

## 1. Contrato del juego — `lib/games/types.ts`

```ts
export type GamePhase = "playing" | "paused" | "dead" | "gameover";

export interface GameState {
  score: number;
  lives: number;
  level: number;
  phase: GamePhase;
  tripleShot: number; // específico de Asteroides: segundos restantes, 0 si inactivo
}

export interface GameInstance {
  pause(): void;
  resume(): void;
  end(): void; // botón FIN
  restart(): void;
  destroy(): void; // cancela rAF, listeners y ResizeObserver
}

export interface GameMountOptions {
  canvas: HTMLCanvasElement;
  onState: (state: GameState) => void; // ~10 Hz, no por frame
  onGameOver: (finalScore: number) => void; // una sola vez
}

export type GameFactory = (opts: GameMountOptions) => GameInstance;
```

`tripleShot` está atado a Asteroides. Un juego con otras métricas debe **extender `GameState`
con campos opcionales** (`lines?`, `combo?`, …) y añadir su `hud-stat` en `GamePlayer.tsx`, no
reinterpretar campos existentes.

## 2. Registry — `lib/games/registry.ts`

Exporta `GAME_REGISTRY: Record<string, () => Promise<GameFactory>>`, `hasRealGame(id)` y
`loadGame(id)`. Añadir un juego es una línea:

```ts
export const GAME_REGISTRY = {
  asteroides: async () => (await import("./asteroids/game")).createAsteroidsGame,
  // <id>: async () => (await import("./<carpeta>/game")).create<Nombre>Game,
};
```

La clave **debe ser idéntica** a `games.id` en Supabase y al segmento `/game/<id>` de la ruta.
Los ids ausentes del registry caen al simulador falso del reproductor.

## 3. Referencia de portado — `lib/games/asteroids/`

`constants.ts` (tunables) · `utils.ts` (`wrap`, `dist`, `rand`, `randInt`) · `entities.ts`
(clases, `update(dt, w, h)` + `draw(ctx)`) · `game.ts` (`createAsteroidsGame`). Patrones a
copiar:

- **Estado por instancia** en un objeto `runtime` local a la factory. Cero variables mutables
  de módulo — dos instancias deben poder coexistir.
- **Canvas y DPR**: `measure()` lee `getBoundingClientRect()`; `applyResize()` fija
  `canvas.width/height = cssSize * devicePixelRatio` y `ctx.setTransform(dpr,0,0,dpr,0,0)`, de
  modo que todo el dibujo va en px CSS. Un `ResizeObserver` sobre el canvas lo dispara, y las
  entidades se reescalan proporcionalmente para no quedar fuera del área.
- **Loop**: `requestAnimationFrame` con `dt` capado a 0.05 s; orden `update → draw →
publishState`.
- **Pausa**: guarda la fase previa; `resume()` pone `lastTime = null` para evitar un `dt`
  gigante en el primer frame.
- **Fin**: un único `toGameOver()` con temporizador (`GAME_OVER_DELAY`, ~1.2 s) para el overlay
  en canvas y un guard que garantiza un solo `onGameOver`.
- **`onState`**: emisión periódica (`STATE_INTERVAL` = 0.1 s) **más** emisión inmediata cuando
  cambia fase, vidas o nivel.
- **`destroy()` idempotente**: flag `destroyed`, `cancelAnimationFrame`, `observer.disconnect()`
  y `removeEventListener` de teclado.

## 4. Reproductor

- `app/game/[id]/play/page.tsx` — server component: `getGameById(id)`, `notFound()` si no
  existe, renderiza `<GamePlayer game={{ id, title }} />`.
- `components/GamePlayer.tsx` — client component, es donde se cablea todo:
  - `hasRealGame(game.id)` decide entre `<canvas className="game-canvas" />` y la arena
    decorativa `.game-arena` del simulador falso.
  - Efecto de montaje: `loadGame(id)` → `factory({ canvas, onState, onGameOver })`, con flag
    `cancelled` y `destroy()` en el cleanup (React Strict Mode monta dos veces en dev).
  - `BLOCKED_KEYS` (flechas + `Space`) con `preventDefault`, salvo cuando el foco está en
    `INPUT` / `TEXTAREA` / contentEditable — el input de iniciales del modal debe seguir
    funcionando.
  - Botones: `PAUSA`/`REANUDAR` → `pause()`/`resume()`; `FIN` → `end()`; `SALIR` es un `Link`;
    `JUGAR DE NUEVO` → `restart()`.
  - Modal FIN: input de nombre (mayúsculas, ≤10, válido con ≥3), `POST /api/scores` y estados
    _enviando_ / _guardado (PUESTO #NN)_ / _error con reintento_.

## 5. Estilos — `app/globals.css`

- `.crt-screen` — `position: relative`, `aspect-ratio: 4/3`, `overflow: hidden`, scanlines y
  viñeta en `::after`/`::before` con `pointer-events: none`.
- `.crt-screen .game-canvas` — `position: absolute; inset: 0; width/height: 100%; background:
#000; touch-action: none`. El canvas llena el CRT, que ya es 4:3.
- `.crt-content` — overlay absoluto (panel `EN PAUSA`).
- HUD — `.player-hud`, `.hud-stat` (+ `.lives`, `.level`, `.power` con animación `power-pulse`),
  `.hud-actions`.
- `.keyboard-notice` — oculto salvo en `max-width: 720px` o `pointer: coarse`.
- Portadas — `.cover-bg` + `cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`,
  `cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo`. Son CSS puro (gradientes en
  pseudo-elementos). Una portada nueva es una clase `cover-*` más.

## 6. Datos y leaderboard

- `lib/data.ts` — `GameCategory`, `Game` (`id, title, short, long, cat, cover, color, playable,
best, plays`), `ScoreRow` (`rank, name, score, date`), `CATS`, `formatPlays`.
- `lib/queries.ts` (server-only) — `getGames()`, `getGameById(id)`, `getTopScores(gameId, limit
= 10)`, `getAllTopScores(limit = 12)`. `best` = `max(score)` y `plays` = `count(scores)` se
  derivan en la consulta; el orden del ranking es `score desc, created_at asc`.
- `app/api/scores/route.ts` — `POST` con `{ gameId, playerName, score }`. Normaliza el nombre
  (`trim` + mayúsculas + corte a 10), valida 3–10 chars, entero ≥ 0 y juego existente.
  Responde `201 { id, rank }`, `400` con mensaje o `500`.
- Consumidores server: `app/page.tsx`, `app/biblioteca/page.tsx`, `app/game/[id]/page.tsx`,
  `app/hall-of-fame/page.tsx` (`export const revalidate = 60`). Los componentes cliente
  (`Home`, `Biblioteca`, `HallOfFame`, `GamePlayer`) reciben todo por props.

**Consecuencia para un juego nuevo:** si la fila existe en `games`, aparece automáticamente en
Home, Biblioteca, su detalle y la pestaña del Hall of Fame. No hay nada más que cablear.

## 7. Alta en Supabase

Proyecto remoto `tfyxzdctimnkrdnqtzfi`. **No hay migraciones versionadas en el repo**: viven
solo en el proyecto, aplicadas con las herramientas MCP. El schema y las policies están
documentados en `README.md` y en `specs/06-juegos-y-leaderboard.md`.

Migración tipo para un juego nuevo — `add_game_<id>`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order)
values ('<id>', '<TITULO>', '<short>', '<long>', '<CAT>', '<cover-clase>', '<color>', true, <n>);
```

Sin filas en `scores`: los juegos reales arrancan vacíos y solo acumulan partidas reales.
Verificación: `mcp__supabase__execute_sql` (count = 10, la fila nueva con `playable = true`) y
`mcp__supabase__get_advisors` sin hallazgos nuevos de seguridad.

Solo hace falta regenerar `lib/supabase/database.types.ts`
(`mcp__supabase__generate_typescript_types`) si la migración cambia el **schema**; un `insert`
no lo cambia.

## 8. Trampas conocidas de los juegos de referencia

| Fuente                                  | Qué complica el portado                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `references/started-games/02-asteroids` | Ya portado — sirve de plantilla, no de trabajo pendiente                                                                                                                        |
| `references/started-games/03-tetris`    | HUD en el DOM (`#score`, `#lines`, `#level`), fin de partida en un `#overlay` HTML con botón, canvas 300×600 (1:2) frente al CRT 4:3, `lines` no existe en `GameState`          |
| `references/started-games/04-arkanoid`  | Globals cruzados entre `levels.js` y `assets/spritesheet.js`, PNG + MP3 cargados por ruta relativa (van a `public/`), menú de pausa hit-testeado en canvas, geometría a 800×600 |

Riesgos que se repiten en **todo** portado y que el spec debe listar: el canvas responsive
altera el balance calibrado en píxeles; el reescalado al redimensionar puede dejar entidades en
estado inválido; React Strict Mode duplica el loop si `destroy()` no limpia todo; el
`preventDefault` global puede secuestrar el teclado si el listener sobrevive a la ruta.
