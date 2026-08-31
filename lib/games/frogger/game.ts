// ===== game.ts — instancia jugable de Ranaria (Frogger) =====
//
// Ranaria no viene de una fuente portada: la mecánica la define el spec. Lo que sí hereda
// de los otros juegos del vault es la forma — un `runtime` local a la factory en vez de
// globals de módulo, de modo que dos instancias coexisten sin interferirse, y el espacio
// lógico fijo 800×600 sobre el que el canvas solo aplica un transform de escala.
//
// El movimiento aquí es mixto, y es lo único delicado del loop: el tráfico y el río corren
// en continuo (posiciones fraccionarias, `dt` real), mientras que la rana salta de celda
// en celda con una animación de 120 ms. Los dos se encuentran cuando la rana descansa
// sobre un tronco: entonces —y solo entonces— su columna también se vuelve fraccionaria,
// arrastrada por la entidad que la sostiene.
import type { GameFactory, GameInstance, GameMountOptions, GamePhase, SkinId } from "../types";
import {
  BOARD_H,
  BOARD_W,
  CELL,
  COLS,
  DEATH_FLASH,
  FLASH_BLINK,
  GAME_OVER_DELAY,
  GOAL_COUNT,
  GOAL_FIRST_COL,
  GOAL_STRIDE,
  GOAL_WIDTH,
  HOP_MS,
  HUD_H,
  LOGICAL_H,
  LOGICAL_W,
  OFFSET_X,
  OFFSET_Y,
  POINTS_FORWARD,
  POINTS_GOAL,
  POINTS_ROUND,
  ROUND_TIME_BASE,
  ROUND_TIME_MIN,
  ROUND_TIME_STEP,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_SAFE_MID,
  ROW_START,
  START_COL,
  START_LIVES,
  STATE_INTERVAL,
  TIME_BONUS_PER_SECOND,
} from "./constants";
import {
  advanceLanes,
  buildLanes,
  isRiverRow,
  isRoadRow,
  laneAt,
  type Entity,
  type Lane,
} from "./lanes";
import {
  drawCar,
  drawFrog,
  drawGoal,
  drawLifeIcon,
  drawLog,
  drawTruck,
  drawTurtles,
} from "./sprites";
import { popGlow, pushGlow, resolveSkin, type RanariaSkin } from "./skins";
type Direction = "up" | "down" | "left" | "right";
/** Desplazamiento en celdas y ángulo del sprite para cada dirección. */
const DIRS: Record<Direction, { dcol: number; drow: number; facing: number }> = {
  up: { dcol: 0, drow: -1, facing: 0 },
  right: { dcol: 1, drow: 0, facing: Math.PI / 2 },
  down: { dcol: 0, drow: 1, facing: Math.PI },
  left: { dcol: -1, drow: 0, facing: -Math.PI / 2 },
};
interface Frog {
  /** Borde izquierdo en celdas. Fraccionario mientras un tronco la arrastra. */
  col: number;
  row: number;
  hopping: boolean;
  /** ms transcurridos del salto en curso. */
  hopT: number;
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  /** Ángulo del sprite, en radianes. */
  facing: number;
}
interface RanariaRuntime {
  lanes: Lane[];
  frog: Frog;
  /** Una casilla por boca destino: true = ya ocupada en esta ronda. */
  goals: boolean[];
  score: number;
  lives: number;
  level: number;
  /** Fila más alta pisada en la ronda (índice menor). Fija el +10 por avance. */
  bestRow: number;
  /** Segundos que dura una ronda de este nivel. */
  roundTime: number;
  /** Segundos restantes. */
  timeLeft: number;
  phase: GamePhase;
  /** Fase previa a la pausa, a la que se vuelve al reanudar. */
  prevPhase: GamePhase;
  /** ms restantes de parpadeo tras morir, 0 si no aplica. */
  deathFlash: number;
  /** ms restantes de overlay de fin antes de avisar al reproductor. */
  gameOverTimer: number;
  /** Segundos acumulados desde la última emisión de onState. */
  stateAccum: number;
  /**
   * Skin activa. Se muta desde `setSkin()`: el dibujo la lee en cada frame, así que el
   * cambio entra en el siguiente sin remontar ni reiniciar la partida.
   */
  palette: RanariaSkin;
}
/** Texto del overlay de fin. Ranaria no tiene victoria: las rondas no se acaban. */
const MSG_GAME_OVER = "GAME OVER";
/** Columna de inicio de la boca `i`. */
function goalStartCol(i: number): number {
  return GOAL_FIRST_COL + i * GOAL_STRIDE;
}
/** Boca que cubre una celda, o -1 si esa celda es seto entre bocas. */
function goalAtCell(cell: number): number {
  const i = Math.floor((cell - GOAL_FIRST_COL) / GOAL_STRIDE);
  if (i < 0 || i >= GOAL_COUNT) return -1;
  const start = goalStartCol(i);
  return cell >= start && cell < start + GOAL_WIDTH ? i : -1;
}
/** Segundos de ronda del nivel, con suelo en ROUND_TIME_MIN. */
function roundTimeFor(level: number): number {
  return Math.max(ROUND_TIME_MIN, ROUND_TIME_BASE - (level - 1) * ROUND_TIME_STEP);
}
export const createRanariaGame: GameFactory = ({
  canvas,
  onState,
  onGameOver,
  skin,
}: GameMountOptions): GameInstance => {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = ctx2d;
  function freshFrog(): Frog {
    return {
      col: START_COL,
      row: ROW_START,
      hopping: false,
      hopT: 0,
      fromCol: START_COL,
      fromRow: ROW_START,
      toCol: START_COL,
      toRow: ROW_START,
      facing: 0,
    };
  }
  const rt: RanariaRuntime = {
    lanes: buildLanes(1),
    frog: freshFrog(),
    goals: new Array(GOAL_COUNT).fill(false),
    score: 0,
    lives: START_LIVES,
    level: 1,
    bestRow: ROW_START,
    roundTime: roundTimeFor(1),
    timeLeft: roundTimeFor(1),
    phase: "playing",
    prevPhase: "playing",
    deathFlash: 0,
    gameOverTimer: 0,
    stateAccum: 0,
    palette: resolveSkin(skin),
  };
  let gameOverNotified = false;
  let destroyed = false;
  /** Dirección encolada por el input, consumida en cuanto la rana no está saltando. */
  let pendingDir: Direction | null = null;
  // ── Canvas y transform ────────────────────────────────────────────────────
  /** Mide el canvas en px CSS; cae al tamaño lógico si aún no hay caja. */
  function measure() {
    const rect = canvas.getBoundingClientRect();
    return {
      cssW: rect.width || canvas.clientWidth || LOGICAL_W,
      cssH: rect.height || canvas.clientHeight || LOGICAL_H,
    };
  }
  /**
   * Ajusta el búfer al tamaño CSS (con devicePixelRatio) y aplica un único transform que
   * combina DPR y escala lógica. La cuadrícula no se recalcula: sus 16×14 celdas de 40 px
   * son fijas, así que nada se mueve de sitio al redimensionar.
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
  }
  const resizeObserver = new ResizeObserver(() => applyResize());
  resizeObserver.observe(canvas);
  // ── Colisiones y soporte ──────────────────────────────────────────────────
  /**
   * Centro de la rana en celdas. Todas las comprobaciones van contra el centro y no
   * contra la caja entera: es lo que dice el spec y además es lo justo cuando un tronco
   * la deja a medio caballo entre dos celdas.
   */
  function frogCenter(): number {
    return rt.frog.col + 0.5;
  }
  /** true si el centro de la rana cae dentro de una entidad de su carril de carretera. */
  function checkRoadCollision(): boolean {
    const lane = laneAt(rt.lanes, rt.frog.row);
    if (!lane || lane.kind !== "road") return false;
    const c = frogCenter();
    return lane.entities.some((e) => c >= e.col && c < e.col + e.width);
  }
  /**
   * Entidad de río que sostiene a la rana, o `null` si no hay ninguna. Un grupo de
   * tortugas sumergido no cuenta: está dibujado, pero no sostiene.
   */
  function getSupport(): Entity | null {
    const lane = laneAt(rt.lanes, rt.frog.row);
    if (!lane || lane.kind !== "river") return null;
    const c = frogCenter();
    const hit = lane.entities.find((e) => c >= e.col && c < e.col + e.width);
    if (!hit || (hit.type === "turtle" && hit.submerged)) return null;
    return hit;
  }
  /**
   * Llegada a la fila de bocas. Boca libre: se ocupa y puntúa. Seto o boca ya ocupada:
   * muerte — es lo que impide llenar la ronda repitiendo siempre el mismo camino.
   */
  function checkGoal() {
    const index = goalAtCell(Math.floor(frogCenter()));
    if (index < 0 || rt.goals[index]) {
      killFrog();
      return;
    }
    rt.goals[index] = true;
    rt.score += POINTS_GOAL + Math.floor(rt.timeLeft) * TIME_BONUS_PER_SECOND;
    if (rt.goals.every(Boolean)) completeRound();
    else respawnFrog();
  }
  // ── Ronda, muerte y reaparición ───────────────────────────────────────────
  /** Devuelve la rana al inicio y reinicia el temporizador. No toca vidas ni bocas. */
  function respawnFrog() {
    rt.frog = freshFrog();
    rt.bestRow = ROW_START;
    rt.timeLeft = rt.roundTime;
    pendingDir = null;
  }
  /** Las 5 bocas llenas: puntos de ronda, nivel nuevo y carriles más rápidos. */
  function completeRound() {
    rt.score += POINTS_ROUND;
    rt.level += 1;
    rt.goals = new Array(GOAL_COUNT).fill(false);
    rt.lanes = buildLanes(rt.level);
    rt.roundTime = roundTimeFor(rt.level);
    respawnFrog();
  }
  /**
   * Única entrada a la muerte, venga de un coche, del agua, de una tortuga que se hunde,
   * de salirse por el borde del río o del temporizador. Resta una vida y entra en el
   * parpadeo; de ahí sale sola, en `update`, a reaparecer o al overlay de fin.
   */
  function killFrog() {
    if (rt.phase !== "playing") return;
    rt.lives -= 1;
    rt.phase = "dead";
    rt.deathFlash = DEATH_FLASH;
    pendingDir = null;
  }
  /**
   * Única entrada a la fase final: overlay en canvas y, al agotarse, un solo onGameOver().
   * Por aquí pasan tanto la última vida como el botón FIN del reproductor.
   */
  function toGameOver() {
    if (rt.phase === "gameover") return;
    lastTime = null;
    rt.phase = "gameover";
    rt.deathFlash = 0;
    rt.gameOverTimer = GAME_OVER_DELAY;
  }
  // ── Pausa ─────────────────────────────────────────────────────────────────
  function pauseGame() {
    if (rt.phase !== "playing" && rt.phase !== "dead") return;
    rt.prevPhase = rt.phase;
    rt.phase = "paused";
  }
  function resumeGame() {
    if (rt.phase !== "paused") return;
    // Sin resetear lastTime, el primer frame tras la pausa traería todo el tiempo
    // transcurrido de golpe y se comería el temporizador de la ronda.
    lastTime = null;
    rt.phase = rt.prevPhase;
  }
  function togglePause() {
    if (rt.phase === "paused") resumeGame();
    else pauseGame();
  }
  // ── Input (por instancia, no global) ──────────────────────────────────────
  /** Tecla → dirección. Flechas como control primario y WASD como alternativa. */
  const KEY_DIRS: Record<string, Direction> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right",
  };
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
    // Solo se guarda la última: pulsar dos teclas durante un salto no encadena dos saltos.
    if (dir && rt.phase === "playing") pendingDir = dir;
  };
  window.addEventListener("keydown", onKeyDown);
  // ── Salto ─────────────────────────────────────────────────────────────────
  /**
   * Arranca un salto si el destino es legal. Fuera de los bordes laterales y por debajo
   * de la fila de inicio no se salta: la pulsación se descarta en vez de matar.
   */
  function startHop(dir: Direction) {
    const { dcol, drow, facing } = DIRS[dir];
    const toCol = rt.frog.col + dcol;
    const toRow = rt.frog.row + drow;
    rt.frog.facing = facing;
    if (toCol < 0 || toCol + 1 > COLS) return;
    if (toRow > ROW_START || toRow < ROW_GOALS) return;
    rt.frog.hopping = true;
    rt.frog.hopT = 0;
    rt.frog.fromCol = rt.frog.col;
    rt.frog.fromRow = rt.frog.row;
    rt.frog.toCol = toCol;
    rt.frog.toRow = toRow;
  }
  /**
   * Cierre del salto: la rana aterriza y se resuelve la celda destino. El +10 por avance
   * se paga una sola vez por fila y ronda — volver a bajar y subir no vuelve a puntuar.
   */
  function finishHop() {
    const frog = rt.frog;
    frog.hopping = false;
    frog.hopT = 0;
    frog.col = frog.toCol;
    frog.row = frog.toRow;
    if (frog.row < rt.bestRow) {
      rt.score += POINTS_FORWARD * (rt.bestRow - frog.row);
      rt.bestRow = frog.row;
    }
    if (frog.row === ROW_GOALS) checkGoal();
  }
  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    const ms = dt * 1000;
    // Parpadeo tras morir: deja ver dónde ocurrió antes de reaparecer o de cerrar.
    if (rt.phase === "dead") {
      rt.deathFlash -= ms;
      if (rt.deathFlash > 0) return;
      rt.deathFlash = 0;
      if (rt.lives <= 0) {
        rt.phase = "gameover";
        rt.gameOverTimer = GAME_OVER_DELAY;
      } else {
        rt.phase = "playing";
        respawnFrog();
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
    // En pausa no corre nada, pero `draw()` se sigue llamando desde el loop.
    if (rt.phase !== "playing") return;
    advanceLanes(rt.lanes, dt);
    const frog = rt.frog;
    if (frog.hopping) {
      frog.hopT += ms;
      if (frog.hopT >= HOP_MS) finishHop();
    } else if (pendingDir) {
      const dir = pendingDir;
      pendingDir = null;
      startHop(dir);
    }
    // El salto acaba de resolverse y puede haber matado o completado ronda: si la fase
    // cambió, este frame no sigue evaluando una situación que ya no existe.
    if (rt.phase !== "playing") return;
    if (!frog.hopping) {
      if (isRoadRow(frog.row)) {
        if (checkRoadCollision()) {
          killFrog();
          return;
        }
      } else if (isRiverRow(frog.row)) {
        const support = getSupport();
        // Sin apoyo la rana se ahoga: en el río, quedarse quieto en el agua es la muerte.
        if (!support) {
          killFrog();
          return;
        }
        const lane = laneAt(rt.lanes, frog.row);
        if (lane) frog.col += lane.speed * lane.dir * dt;
        // Arrastrada fuera del cauce: el tronco la saca de la pantalla y se pierde.
        if (frog.col < 0 || frog.col + 1 > COLS) {
          killFrog();
          return;
        }
      }
    }
    rt.timeLeft -= dt;
    if (rt.timeLeft <= 0) {
      rt.timeLeft = 0;
      killFrog();
    }
  }
  // ── Draw ──────────────────────────────────────────────────────────────────
  /** Franja de una zona, en coordenadas del tablero. */
  function fillRows(from: number, to: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(0, from * CELL, BOARD_W, (to - from + 1) * CELL);
  }
  function drawTerrain() {
    const p = rt.palette;
    fillRows(ROW_GOALS, ROW_GOALS, p.goalRowBg);
    fillRows(ROW_RIVER_TOP, ROW_RIVER_BOT, p.riverBg);
    fillRows(ROW_SAFE_MID, ROW_SAFE_MID, p.safeBg);
    fillRows(ROW_ROAD_TOP, ROW_ROAD_BOT, p.roadBg);
    fillRows(ROW_START, ROW_START, p.safeBg);
    // Reflejos del agua: rayas horizontales tenues, una por carril de río.
    ctx.fillStyle = p.riverShine;
    for (let row = ROW_RIVER_TOP; row <= ROW_RIVER_BOT; row++) {
      ctx.fillRect(0, (row + 0.5) * CELL - 1, BOARD_W, 2);
    }
    // Marcas de carril: discontinuas, entre carriles de carretera pero no en los bordes.
    ctx.fillStyle = p.roadMark;
    for (let row = ROW_ROAD_TOP + 1; row <= ROW_ROAD_BOT; row++) {
      for (let x = 0; x < BOARD_W; x += CELL) {
        ctx.fillRect(x + CELL * 0.2, row * CELL - 1, CELL * 0.6, 2);
      }
    }
    // Bordillos: separan las tres zonas de un vistazo.
    ctx.fillStyle = p.curb;
    for (const row of [ROW_SAFE_MID, ROW_SAFE_MID + 1, ROW_START]) {
      ctx.fillRect(0, row * CELL - 2, BOARD_W, 4);
    }
    for (let i = 0; i < GOAL_COUNT; i++) {
      drawGoal(ctx, goalStartCol(i) * CELL, ROW_GOALS * CELL, GOAL_WIDTH * CELL, rt.goals[i], p);
    }
  }
  function drawEntities() {
    pushGlow(ctx, rt.palette);
    for (const lane of rt.lanes) {
      const y = lane.row * CELL;
      for (const e of lane.entities) {
        const x = e.col * CELL;
        const w = e.width * CELL;
        if (e.type === "car") drawCar(ctx, x, y, w, e.variant, rt.palette);
        else if (e.type === "truck") drawTruck(ctx, x, y, w, lane.dir, rt.palette);
        else if (e.type === "log") drawLog(ctx, x, y, w, rt.palette);
        else drawTurtles(ctx, x, y, w, e.submerged, rt.palette);
      }
    }
    popGlow(ctx, rt.palette);
  }
  function drawPlayer() {
    const frog = rt.frog;
    // Durante el salto la posición se interpola; el estiramiento de las patas sube y baja
    // con un seno, así que la rana está más abierta a mitad de vuelo.
    const t = frog.hopping ? frog.hopT / HOP_MS : 0;
    const col = frog.hopping ? frog.fromCol + (frog.toCol - frog.fromCol) * t : frog.col;
    const row = frog.hopping ? frog.fromRow + (frog.toRow - frog.fromRow) * t : frog.row;
    const stretch = frog.hopping ? Math.sin(t * Math.PI) : 0;
    // Parpadeo, no rojo fijo: alterna cada FLASH_BLINK ms mientras dura deathFlash.
    const dead = rt.deathFlash > 0 && Math.floor(rt.deathFlash / FLASH_BLINK) % 2 === 0;
    pushGlow(ctx, rt.palette);
    drawFrog(ctx, (col + 0.5) * CELL, (row + 0.5) * CELL, frog.facing, stretch, dead, rt.palette);
    popGlow(ctx, rt.palette);
  }
  /**
   * HUD interno del canvas, en la banda de 40 px sobre el tablero: score a la izquierda,
   * nivel al centro, vidas como iconos de rana a la derecha y la barra de tiempo debajo,
   * alineada al ancho del tablero.
   */
  function drawHud() {
    const p = rt.palette;
    ctx.fillStyle = p.hudBg;
    ctx.fillRect(0, 0, LOGICAL_W, HUD_H);
    ctx.textBaseline = "middle";
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = p.hudText;
    ctx.textAlign = "left";
    ctx.fillText(String(rt.score).padStart(6, "0"), OFFSET_X, HUD_H * 0.42);
    ctx.textAlign = "center";
    ctx.fillStyle = p.hudDim;
    ctx.fillText(`NIVEL ${rt.level}`, LOGICAL_W / 2, HUD_H * 0.42);
    // Las vidas que quedan por gastar, de derecha a izquierda.
    for (let i = 0; i < Math.max(0, rt.lives); i++) {
      drawLifeIcon(ctx, LOGICAL_W - OFFSET_X - CELL * 0.2 - i * CELL * 0.42, HUD_H * 0.42, p);
    }
    // Barra de tiempo: se vacía de derecha a izquierda y cambia de color al agotarse.
    const ratio = rt.roundTime > 0 ? Math.max(0, rt.timeLeft / rt.roundTime) : 0;
    const barY = HUD_H - 8;
    ctx.fillStyle = p.curb;
    ctx.fillRect(OFFSET_X, barY, BOARD_W, 4);
    ctx.fillStyle = ratio > 0.5 ? p.timeGood : ratio > 0.25 ? p.timeWarn : p.timeBad;
    ctx.fillRect(OFFSET_X, barY, BOARD_W * ratio, 4);
  }
  /** Overlay de fin de partida: velo oscuro y el mensaje centrado. */
  function drawEndOverlay() {
    const p = rt.palette;
    ctx.fillStyle = p.overlayVeil;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = p.overlayTitle;
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(MSG_GAME_OVER, LOGICAL_W / 2, LOGICAL_H / 2);
  }
  function draw() {
    ctx.fillStyle = rt.palette.background;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawHud();
    ctx.save();
    ctx.translate(OFFSET_X, OFFSET_Y);
    // Recorte al tablero: las entidades salen del borde deslizándose, no se ven en los
    // márgenes laterales mientras esperan a reaparecer por el otro lado.
    ctx.beginPath();
    ctx.rect(0, 0, BOARD_W, BOARD_H);
    ctx.clip();
    drawTerrain();
    drawEntities();
    if (rt.phase !== "gameover") drawPlayer();
    ctx.restore();
    if (rt.phase === "gameover") drawEndOverlay();
  }
  // ── Publicación de estado al HUD ──────────────────────────────────────────
  let lastPhase: GamePhase | null = null;
  let lastLevel = -1;
  let lastLives = -1;
  function emitState() {
    rt.stateAccum = 0;
    lastPhase = rt.phase;
    lastLevel = rt.level;
    lastLives = rt.lives;
    // Sin `lines` ni `fruits`: Ranaria no cuenta ninguna de las dos, y su ausencia es lo
    // que oculta esos stats en el HUD. `tripleShot` es específico de Asteroides.
    onState({
      score: rt.score,
      level: rt.level,
      lives: Math.max(0, rt.lives),
      phase: rt.phase,
      tripleShot: 0,
    });
  }
  /** ~10 Hz, más una emisión inmediata en cada cambio de fase, nivel o vidas. */
  function publishState(dt: number) {
    rt.stateAccum += dt;
    const changed = rt.phase !== lastPhase || rt.level !== lastLevel || rt.lives !== lastLives;
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
    rt.level = 1;
    rt.lanes = buildLanes(1);
    rt.goals = new Array(GOAL_COUNT).fill(false);
    rt.score = 0;
    rt.lives = START_LIVES;
    rt.roundTime = roundTimeFor(1);
    rt.phase = "playing";
    rt.prevPhase = "playing";
    rt.deathFlash = 0;
    rt.gameOverTimer = 0;
    rt.stateAccum = 0;
    gameOverNotified = false;
    respawnFrog();
  }
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
    // Solo muta la paleta: el dibujo la lee en cada frame, así que cambiar de skin en
    // mitad de la partida no la reinicia.
    setSkin(id: SkinId) {
      rt.palette = resolveSkin(id);
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
