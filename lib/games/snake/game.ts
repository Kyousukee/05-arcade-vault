// ===== game.ts — instancia jugable de Serpentina (Snake) =====
//
// Serpentina no viene de una fuente portada: la mecánica se define en el spec 09. Lo que
// sí se hereda es la forma de los otros juegos del vault — un `runtime` local a la
// factory en vez de globals de módulo, de modo que dos instancias coexisten sin
// interferirse, y el espacio lógico fijo 800×600 sobre el que el canvas solo aplica un
// transform de escala.
//
// A diferencia de Asteroides o Bloque Buster, aquí el movimiento no es continuo: la
// serpiente avanza una celda entera cada `tickMs`, así que el loop acumula el `dt` de
// cada frame y dispara como mucho un paso por frame.
import type { GameFactory, GameInstance, GameMountOptions, GamePhase, SkinId } from "../types";
import {
  CELL,
  COLS,
  DEATH_FLASH,
  FRUITS_PER_LEVEL,
  GAME_OVER_DELAY,
  LOGICAL_H,
  LOGICAL_W,
  ROWS,
  STATE_INTERVAL,
  TICK_BASE,
  TICK_MIN,
  TICK_STEP,
} from "./constants";
import {
  FRUIT_SPRITES,
  KINDS_BY_TIER,
  loadFruitSheet,
  TIER_WEIGHTS,
  type FruitKind,
  type FruitTier,
} from "./sprites";
import { resolveSkin, type SerpentinaSkin } from "./skins";
import {
  DIR_VECTORS,
  OPPOSITE,
  createSnakeBody,
  drawSnake,
  hitsSelf,
  hitsWall,
  occupies,
  stepSnake,
  type Cell,
  type Dir,
} from "./snake";
interface Fruit extends Cell {
  kind: FruitKind;
}
interface SnakeRuntime {
  /** Celdas del cuerpo, índice 0 = cabeza. */
  body: Cell[];
  /** Dirección aplicada en el último tick. */
  dir: Dir;
  /** Giro encolado; a lo sumo uno por tick. */
  nextDir: Dir;
  fruit: Fruit;
  score: number;
  fruits: number;
  /** 1 + floor(fruits / FRUITS_PER_LEVEL). */
  level: number;
  /** ms entre pasos: max(TICK_MIN, TICK_BASE - (level - 1) * TICK_STEP). */
  tickMs: number;
  /** ms acumulados desde el último paso. */
  tickAccum: number;
  phase: GamePhase;
  /** Fase previa a la pausa, a la que se vuelve al reanudar. */
  prevPhase: GamePhase;
  /** ms restantes de parpadeo rojo, 0 si no aplica. */
  deathFlash: number;
  /** ms restantes de overlay de fin antes de avisar al reproductor. */
  gameOverTimer: number;
  /** null hasta que resuelve el PNG, y también si la carga falla. */
  sheet: CanvasImageSource | null;
  /** segundos acumulados desde la última emisión de onState. */
  stateAccum: number;
  /** Tamaño del canvas en px CSS. Solo se usa para calcular el transform. */
  cssW: number;
  cssH: number;
  /**
   * Paleta activa. Se muta desde `setSkin()`: el dibujo la lee en cada frame,
   * así que el cambio entra en el siguiente sin remontar ni reiniciar nada.
   */
  skin: SerpentinaSkin;
}
/** Tamaño de referencia si el canvas todavía no está maquetado. */
const FALLBACK_W = LOGICAL_W;
const FALLBACK_H = LOGICAL_H;
/** Texto del overlay de fin. Serpentina no tiene victoria: siempre se acaba igual. */
const MSG_GAME_OVER = "GAME OVER";
/** ms de cada mitad del parpadeo rojo: con DEATH_FLASH = 200 salen ~3 destellos. */
const FLASH_BLINK = 35;
export const createSerpentinaGame: GameFactory = ({
  canvas,
  onState,
  onGameOver,
  skin,
}: GameMountOptions): GameInstance => {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = ctx2d;
  const rt: SnakeRuntime = {
    body: createSnakeBody(),
    dir: "right",
    nextDir: "right",
    fruit: { col: 0, row: 0, kind: "apple" },
    score: 0,
    fruits: 0,
    level: 1,
    tickMs: TICK_BASE,
    tickAccum: 0,
    phase: "playing",
    prevPhase: "playing",
    deathFlash: 0,
    gameOverTimer: 0,
    sheet: null,
    stateAccum: 0,
    cssW: FALLBACK_W,
    cssH: FALLBACK_H,
    skin: resolveSkin(skin),
  };
  let gameOverNotified = false;
  let destroyed = false;
  // ── Canvas y transform ────────────────────────────────────────────────────
  /** Mide el canvas en px CSS; cae al tamaño de referencia si aún no hay caja. */
  function measure() {
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || canvas.clientWidth || FALLBACK_W;
    const cssH = rect.height || canvas.clientHeight || FALLBACK_H;
    return { cssW, cssH };
  }
  /**
   * Ajusta el búfer al tamaño CSS (con devicePixelRatio) y aplica un único transform que
   * combina DPR y escala lógica. El grid no se recalcula: sus 32×24 celdas de 25 px son
   * fijas, así que ni la serpiente ni la fruta cambian de posición al redimensionar.
   */
  function applyResize() {
    const { cssW, cssH } = measure();
    if (cssW <= 0 || cssH <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const bufW = Math.round(cssW * dpr);
    const bufH = Math.round(cssH * dpr);
    if (canvas.width !== bufW || canvas.height !== bufH) {
      canvas.width = bufW;
      canvas.height = bufH;
    }
    ctx.setTransform(bufW / LOGICAL_W, 0, 0, bufH / LOGICAL_H, 0, 0);
    rt.cssW = cssW;
    rt.cssH = cssH;
  }
  // El canvas llena el CRT, que es 4:3 y se redimensiona con la ventana. Observarlo a él
  // —y no a `window`— también recoge los cambios de maquetación sin resize de ventana.
  const resizeObserver = new ResizeObserver(() => applyResize());
  resizeObserver.observe(canvas);
  // ── Fruta ─────────────────────────────────────────────────────────────────
  /**
   * Sortea el tramo por peso (70 % común / 25 % medio / 5 % grande) y dentro del tramo el
   * tipo uniforme. Así los 22 sprites del atlas salen todos, pero las frutas caras son
   * raras.
   */
  function pickFruitKind(): FruitKind {
    const total = TIER_WEIGHTS.common + TIER_WEIGHTS.mid + TIER_WEIGHTS.big;
    let roll = Math.random() * total;
    let tier: FruitTier = "common";
    for (const candidate of ["common", "mid", "big"] as FruitTier[]) {
      roll -= TIER_WEIGHTS[candidate];
      if (roll < 0) {
        tier = candidate;
        break;
      }
    }
    const kinds = KINDS_BY_TIER[tier];
    return kinds[Math.floor(Math.random() * kinds.length)];
  }
  /** Intentos de celda al azar antes de pasar a enumerar las celdas libres. */
  const SPAWN_TRIES = 60;
  /**
   * Coloca una fruta nueva en una celda que la serpiente no ocupe. Primero por rechazo,
   * que es lo barato mientras el cuerpo es corto; si con una serpiente muy larga se
   * agotan los intentos, enumera las celdas libres y elige por índice, que siempre
   * termina. Si no queda ninguna libre, deja la fruta donde estaba.
   */
  function spawnFruit() {
    const kind = pickFruitKind();
    for (let i = 0; i < SPAWN_TRIES; i++) {
      const cell = {
        col: Math.floor(Math.random() * COLS),
        row: Math.floor(Math.random() * ROWS),
      };
      if (!occupies(rt.body, cell)) {
        rt.fruit = { ...cell, kind };
        return;
      }
    }
    const free: Cell[] = [];
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        const cell = { col, row };
        if (!occupies(rt.body, cell)) free.push(cell);
      }
    }
    if (free.length === 0) return;
    rt.fruit = { ...free[Math.floor(Math.random() * free.length)], kind };
  }
  // ── Progresión ────────────────────────────────────────────────────────────
  /** El nivel sale de las frutas comidas y la velocidad del nivel, con suelo en TICK_MIN. */
  function updateLevel() {
    rt.level = 1 + Math.floor(rt.fruits / FRUITS_PER_LEVEL);
    rt.tickMs = Math.max(TICK_MIN, TICK_BASE - (rt.level - 1) * TICK_STEP);
  }
  // ── Tick ──────────────────────────────────────────────────────────────────
  /**
   * Un paso: el giro encolado pasa a ser la dirección y la serpiente avanza una celda. Si
   * la cabeza cae sobre la fruta, la cola no se recorta (la serpiente crece una celda),
   * se suman los puntos del tramo multiplicados por el nivel y aparece una fruta nueva.
   */
  function tick() {
    rt.dir = rt.nextDir;
    const v = DIR_VECTORS[rt.dir];
    const head = rt.body[0];
    const eats = head.col + v.col === rt.fruit.col && head.row + v.row === rt.fruit.row;
    stepSnake(rt.body, rt.dir, eats);
    // La fruta nunca cae sobre el cuerpo ni fuera del grid, así que comer y morir son
    // excluyentes: si hay colisión, este paso no puntúa.
    if (hitsWall(rt.body) || hitsSelf(rt.body)) {
      die();
      return;
    }
    if (!eats) return;
    rt.score += FRUIT_SPRITES[rt.fruit.kind].points * rt.level;
    rt.fruits += 1;
    updateLevel();
    spawnFruit();
  }
  // ── Fin de partida ────────────────────────────────────────────────────────
  /**
   * Colisión contra pared o contra el propio cuerpo. No hay vidas: la partida entra en el
   * parpadeo rojo y de ahí, sola, al overlay de fin.
   */
  function die() {
    if (rt.phase !== "playing") return;
    rt.phase = "dead";
    rt.deathFlash = DEATH_FLASH;
  }
  /**
   * Única entrada a la fase final: overlay en canvas y, al agotarse, un solo onGameOver().
   * Por aquí pasan tanto la muerte (tras el parpadeo) como el botón FIN.
   */
  function toGameOver() {
    if (rt.phase === "gameover") return;
    // Si venía de una pausa, el primer dt no debe comerse parte del overlay.
    lastTime = null;
    rt.phase = "gameover";
    rt.deathFlash = 0;
    rt.gameOverTimer = GAME_OVER_DELAY;
  }
  // ── Pausa ─────────────────────────────────────────────────────────────────
  function pauseGame() {
    if (rt.phase !== "playing") return;
    rt.prevPhase = rt.phase;
    rt.phase = "paused";
  }
  function resumeGame() {
    if (rt.phase !== "paused") return;
    // Sin resetear lastTime, el primer frame tras la pausa traería todo el tiempo
    // transcurrido y la serpiente daría un paso de golpe nada más reanudar.
    lastTime = null;
    rt.phase = rt.prevPhase;
  }
  function togglePause() {
    if (rt.phase === "paused") resumeGame();
    else pauseGame();
  }
  // ── Input (por instancia, no global) ──────────────────────────────────────
  /** Tecla → dirección. Flechas como control primario y WASD como alternativa. */
  const KEY_DIRS: Record<string, Dir> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right",
  };
  /**
   * Encola un giro. Se ignora si es la opuesta a la dirección actual —sería suicidio
   * inmediato— y también si ya hay un giro pendiente para este tick (`nextDir !== dir`):
   * dos pulsaciones entre dos pasos solo aplican la primera, que es lo que evita el
   * suicidio por doble toque rápido, el bug clásico del Snake.
   */
  function queueTurn(dir: Dir) {
    if (rt.phase !== "playing") return;
    if (rt.nextDir !== rt.dir) return;
    if (dir === OPPOSITE[rt.dir] || dir === rt.dir) return;
    rt.nextDir = dir;
  }
  const onKeyDown = (e: KeyboardEvent) => {
    // El teclado no se secuestra mientras se escriben las iniciales en el modal.
    const el = e.target as HTMLElement | null;
    const tag = el?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
    if (e.code === "KeyP" || e.code === "Escape") {
      togglePause();
      return;
    }
    const dir = KEY_DIRS[e.code];
    if (dir) queueTurn(dir);
  };
  window.addEventListener("keydown", onKeyDown);
  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    const ms = dt * 1000;
    // Parpadeo rojo tras la colisión: deja ver dónde se produjo antes de tapar el canvas.
    if (rt.phase === "dead") {
      rt.deathFlash -= ms;
      if (rt.deathFlash <= 0) {
        rt.deathFlash = 0;
        rt.phase = "gameover";
        rt.gameOverTimer = GAME_OVER_DELAY;
      }
      return;
    }
    // El overlay se ve en el canvas antes de que el reproductor abra el modal.
    if (rt.phase === "gameover") {
      if (rt.gameOverTimer > 0) {
        rt.gameOverTimer -= ms;
        if (rt.gameOverTimer <= 0 && !gameOverNotified) {
          gameOverNotified = true;
          onGameOver(rt.score);
        }
      }
      return;
    }
    // En pausa no se acumula tiempo: el canvas sigue mostrando el último frame.
    if (rt.phase !== "playing") return;
    rt.tickAccum += ms;
    if (rt.tickAccum >= rt.tickMs) {
      // Como mucho un paso por frame: tras un frame largo (pestaña en segundo plano) el
      // sobrante se descarta en vez de encadenar varios pasos de golpe.
      rt.tickAccum = 0;
      tick();
    }
  }
  // ── Draw ──────────────────────────────────────────────────────────────────
  /**
   * Tablero: fondo liso más un damero muy tenue que deja leer la rejilla de celdas. El
   * damero son rectángulos llenos y no una rejilla de líneas de 1 px: al escalar a un CRT
   * de ancho arbitrario, una línea fina caería en fracciones de píxel y se vería sucia.
   */
  function drawBoard() {
    ctx.fillStyle = rt.skin.background;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = rt.skin.boardCellAlt;
    for (let row = 0; row < ROWS; row++) {
      for (let col = row % 2; col < COLS; col += 2) {
        ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
      }
    }
  }
  /**
   * Fruta: el recorte del atlas escalado a ~90 % de la celda conservando su relación de
   * aspecto — las alargadas (banana, kiwi) no se deforman — y centrado en la celda. Si el
   * PNG no cargó, cae a un círculo y el juego sigue siendo jugable.
   *
   * El sprite NO se tiñe con la skin: su color es lo que identifica cada fruta y delata
   * su tramo de puntos, y teñirlo dejaría 22 manchas iguales. Lo que sí pone la skin es
   * el halo de detrás (`fruitGlow`, a 0 en `clasico` y `retro`) y el color del círculo de
   * reserva (`fruitFallback`, `null` en `clasico` para conservar el del atlas).
   */
  function drawFruit() {
    const sprite = FRUIT_SPRITES[rt.fruit.kind];
    const cx = rt.fruit.col * CELL + CELL / 2;
    const cy = rt.fruit.row * CELL + CELL / 2;
    const sheet = rt.sheet;
    if (!sheet) {
      ctx.fillStyle = rt.skin.fruitFallback ?? sprite.color;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.35, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const max = CELL * 0.9;
    const scale = Math.min(max / sprite.w, max / sprite.h);
    const w = sprite.w * scale;
    const h = sprite.h * scale;
    if (rt.skin.fruitGlow > 0) {
      ctx.save();
      ctx.shadowColor = rt.skin.fruitAura;
      ctx.shadowBlur = rt.skin.fruitGlow;
    }
    ctx.drawImage(sheet, sprite.x, sprite.y, sprite.w, sprite.h, cx - w / 2, cy - h / 2, w, h);
    if (rt.skin.fruitGlow > 0) ctx.restore();
  }
  /** Overlay de fin de partida: velo oscuro y el mensaje centrado. */
  function drawEndOverlay() {
    ctx.fillStyle = rt.skin.overlayVeil;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = rt.skin.overlayTitle;
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(MSG_GAME_OVER, LOGICAL_W / 2, LOGICAL_H / 2);
  }
  function draw() {
    drawBoard();
    // Bajo el overlay la fruta sobra: lo que interesa ver es dónde quedó la serpiente.
    if (rt.phase !== "gameover") drawFruit();
    // Parpadeo, no rojo fijo: alterna cada FLASH_BLINK ms mientras dura deathFlash.
    const flashing = rt.deathFlash > 0 && Math.floor(rt.deathFlash / FLASH_BLINK) % 2 === 0;
    drawSnake(ctx, rt.body, rt.dir, flashing, rt.skin);
    if (rt.phase === "gameover") drawEndOverlay();
  }
  // ── Publicación de estado al HUD ──────────────────────────────────────────
  let lastPhase: GamePhase | null = null;
  let lastLevel = -1;
  let lastFruits = -1;
  function emitState() {
    rt.stateAccum = 0;
    lastPhase = rt.phase;
    lastLevel = rt.level;
    lastFruits = rt.fruits;
    // Sin `lives` ni `lines`: Serpentina no tiene ninguna de las dos, y su ausencia es lo
    // que oculta esos stats en el HUD. `tripleShot` es específico de Asteroides.
    onState({
      score: rt.score,
      level: rt.level,
      fruits: rt.fruits,
      phase: rt.phase,
      tripleShot: 0,
    });
  }
  /** ~10 Hz, más una emisión inmediata en cada cambio de fase, nivel o frutas. */
  function publishState(dt: number) {
    rt.stateAccum += dt;
    const changed = rt.phase !== lastPhase || rt.level !== lastLevel || rt.fruits !== lastFruits;
    if (changed || rt.stateAccum >= STATE_INTERVAL) emitState();
  }
  // ── Loop principal ────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;
  function loop(ts: number) {
    // Si destroy() llegó entre dos frames, este callback no debe reprogramarse: en React
    // Strict Mode el primer montaje se desmonta y quedarían dos loops corriendo.
    if (destroyed) return;
    // dt en segundos, capado a 50 ms: una pestaña que vuelve del segundo plano no debe
    // traer varios segundos de golpe.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    publishState(dt);
    rafId = requestAnimationFrame(loop);
  }
  function initGame() {
    rt.body = createSnakeBody();
    rt.dir = "right";
    rt.nextDir = "right";
    rt.score = 0;
    rt.fruits = 0;
    rt.level = 1;
    rt.tickMs = TICK_BASE;
    rt.tickAccum = 0;
    rt.phase = "playing";
    rt.prevPhase = "playing";
    rt.deathFlash = 0;
    rt.gameOverTimer = 0;
    rt.stateAccum = 0;
    gameOverNotified = false;
    // Después del cuerpo inicial: la primera fruta tampoco puede caer sobre la serpiente.
    spawnFruit();
  }
  // El juego arranca ya, sin esperar al PNG: hasta que resuelve, la fruta se ve como el
  // círculo de reserva. Si la carga falla, `sheet` se queda en null y la partida sigue
  // siendo jugable con ese círculo. Si para entonces ya se llamó a destroy(), no se toca
  // el runtime de una instancia desmontada.
  loadFruitSheet().then((sheet) => {
    if (!destroyed) rt.sheet = sheet;
  });
  applyResize();
  initGame();
  emitState();
  rafId = requestAnimationFrame(loop);
  // ── Handle público ────────────────────────────────────────────────────────
  return {
    pause: pauseGame,
    resume: resumeGame,
    end: toGameOver,
    restart() {
      lastTime = null;
      initGame();
    },
    // Solo cambia la paleta que lee el dibujo: el siguiente frame ya pinta con la nueva,
    // así que cambiar de skin en mitad de la partida no la reinicia.
    setSkin(id: SkinId) {
      rt.skin = resolveSkin(id);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
    },
  };
};
