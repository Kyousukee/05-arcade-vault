// ===== game.ts — instancia jugable de Caída (Tetris) =====
//
// Todo el estado vive dentro de createCaidaGame(): donde la fuente tenía doce
// globals de módulo (board, current, next, score, lines, level, paused,
// gameOver, lastTime, dropAccum, dropInterval, animId) aquí hay un `runtime`
// local, así que dos instancias pueden coexistir sin interferirse.
import type { GameFactory, GameInstance, GameMountOptions, GamePhase } from "../types";
import {
  clearLines,
  collide,
  createBoard,
  ghostY,
  merge,
  randomPiece,
  rotateCW,
  type Board,
  type Piece,
} from "./board";
import {
  COLORS,
  COLS,
  DROP_BASE_MS,
  DROP_MIN_MS,
  DROP_STEP_MS,
  GAME_OVER_DELAY,
  GRID_LINE_COLOR,
  KICKS,
  LINE_SCORES,
  ROWS,
  STATE_INTERVAL,
} from "./constants";
interface TetrisRuntime {
  board: Board;
  current: Piece;
  next: Piece;
  score: number;
  lines: number;
  level: number;
  phase: GamePhase;
  /** Fase previa a la pausa, a la que se vuelve al reanudar. */
  prevPhase: GamePhase;
  /** ms acumulados desde la última bajada. */
  dropAccum: number;
  /** ms entre bajadas, derivado del nivel. */
  dropInterval: number;
  /** ms restantes de overlay GAME OVER antes de avisar al reproductor. */
  gameOverTimer: number;
  /** ms acumulados desde la última emisión de onState. */
  stateAccum: number;
  /** Dimensiones lógicas en px CSS del canvas completo (el CRT 4:3). */
  w: number;
  h: number;
  /** Lado de celda en px CSS: h / ROWS. Sustituye al BLOCK = 30 fijo. */
  block: number;
  /** Esquina superior izquierda del tablero dentro del canvas. */
  boardX: number;
  boardY: number;
}
/** Tamaño de referencia si el canvas todavía no está maquetado. */
const FALLBACK_W = 800;
const FALLBACK_H = 600;
export const createCaidaGame: GameFactory = ({
  canvas,
  onState,
  onGameOver,
}: GameMountOptions): GameInstance => {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = ctx2d;
  const rt: TetrisRuntime = {
    board: createBoard(),
    current: randomPiece(),
    next: randomPiece(),
    score: 0,
    lines: 0,
    level: 1,
    phase: "playing",
    prevPhase: "playing",
    dropAccum: 0,
    dropInterval: DROP_BASE_MS,
    gameOverTimer: 0,
    stateAccum: 0,
    w: FALLBACK_W,
    h: FALLBACK_H,
    block: FALLBACK_H / ROWS,
    boardX: 0,
    boardY: 0,
  };
  let gameOverNotified = false;
  // ── Tamaño lógico y layout ────────────────────────────────────────────────
  /** Mide el canvas en px CSS; cae al tamaño de referencia si aún no hay caja. */
  function measure() {
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || canvas.clientWidth || FALLBACK_W;
    const cssH = rect.height || canvas.clientHeight || FALLBACK_H;
    return { cssW, cssH };
  }
  /**
   * Letterbox dentro del CRT 4:3: el tablero (10×20) llena la altura completa y
   * el ancho sobrante aloja el panel NEXT. Ancho total del contenido:
   * 10 (tablero) + 1 (separación) + 4 (panel) = 15 celdas, centrado.
   */
  function layout() {
    rt.block = rt.h / ROWS;
    rt.boardX = (rt.w - 15 * rt.block) / 2;
    rt.boardY = 0;
  }
  /**
   * Ajusta el búfer del canvas al tamaño CSS actual (con devicePixelRatio) y
   * recalcula el layout. No hay que reposicionar nada: el tablero vive en
   * coordenadas de celda, así que basta con recalcular `block` y los offsets.
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
    // Se dibuja en px CSS; el dpr solo aumenta la resolución del búfer.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rt.w = cssW;
    rt.h = cssH;
    layout();
  }
  const resizeObserver = new ResizeObserver(() => applyResize());
  resizeObserver.observe(canvas);
  // ── Progresión ────────────────────────────────────────────────────────────
  function dropIntervalFor(level: number) {
    return Math.max(DROP_MIN_MS, DROP_BASE_MS - (level - 1) * DROP_STEP_MS);
  }
  // ── Ciclo de la pieza ─────────────────────────────────────────────────────
  /** Única entrada a la fase final: overlay en canvas y luego onGameOver(). */
  function toGameOver() {
    if (rt.phase === "gameover") return;
    // Si venía de una pausa, el primer dt no debe comerse el overlay.
    lastTime = null;
    rt.phase = "gameover";
    rt.gameOverTimer = GAME_OVER_DELAY;
  }
  function spawn() {
    rt.current = rt.next;
    rt.next = randomPiece();
    // Si la pieza recién generada ya no cabe, se acabó la partida.
    if (collide(rt.board, rt.current.shape, rt.current.x, rt.current.y)) toGameOver();
  }
  function lockPiece() {
    merge(rt.board, rt.current);
    const cleared = clearLines(rt.board);
    if (cleared) {
      rt.lines += cleared;
      rt.score += (LINE_SCORES[cleared] ?? 0) * rt.level;
      rt.level = Math.floor(rt.lines / 10) + 1;
      rt.dropInterval = dropIntervalFor(rt.level);
    }
    spawn();
  }
  function move(dx: number) {
    if (!collide(rt.board, rt.current.shape, rt.current.x + dx, rt.current.y)) rt.current.x += dx;
  }
  function tryRotate() {
    const rotated = rotateCW(rt.current.shape);
    for (const kick of KICKS) {
      if (!collide(rt.board, rotated, rt.current.x + kick, rt.current.y)) {
        rt.current.shape = rotated;
        rt.current.x += kick;
        return;
      }
    }
  }
  function softDrop() {
    if (!collide(rt.board, rt.current.shape, rt.current.x, rt.current.y + 1)) {
      rt.current.y++;
      rt.score += 1;
    } else {
      lockPiece();
    }
  }
  function hardDrop() {
    const gy = ghostY(rt.board, rt.current);
    rt.score += (gy - rt.current.y) * 2;
    rt.current.y = gy;
    lockPiece();
  }
  // ── Pausa ─────────────────────────────────────────────────────────────────
  function pauseGame() {
    if (rt.phase !== "playing") return;
    rt.prevPhase = rt.phase;
    rt.phase = "paused";
  }
  function resumeGame() {
    if (rt.phase !== "paused") return;
    // Sin resetear ambos, el primer frame tras la pausa traería el tiempo
    // acumulado y la pieza bajaría una fila de golpe al reanudar.
    lastTime = null;
    rt.dropAccum = 0;
    rt.phase = rt.prevPhase;
  }
  function togglePause() {
    if (rt.phase === "paused") resumeGame();
    else pauseGame();
  }
  // ── Input (por instancia, no global) ──────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "KeyP" || e.code === "Escape") {
      togglePause();
      return;
    }
    if (rt.phase !== "playing") return;
    switch (e.code) {
      case "ArrowLeft":
        move(-1);
        break;
      case "ArrowRight":
        move(1);
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  };
  window.addEventListener("keydown", onKeyDown);
  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (rt.phase === "gameover") {
      // El overlay se ve en el canvas antes de que el reproductor abra el modal.
      if (rt.gameOverTimer > 0) {
        rt.gameOverTimer -= dt;
        if (rt.gameOverTimer <= 0 && !gameOverNotified) {
          gameOverNotified = true;
          onGameOver(rt.score);
        }
      }
      return;
    }
    // En pausa no se acumula tiempo: el canvas sigue mostrando el último frame.
    if (rt.phase !== "playing") return;
    rt.dropAccum += dt;
    if (rt.dropAccum >= rt.dropInterval) {
      rt.dropAccum = 0;
      if (!collide(rt.board, rt.current.shape, rt.current.x, rt.current.y + 1)) rt.current.y++;
      else lockPiece();
    }
  }
  // ── Draw ──────────────────────────────────────────────────────────────────
  /** Dibuja una celda en px absolutos, con el realce superior de la fuente. */
  function drawCell(
    c: CanvasRenderingContext2D,
    px: number,
    py: number,
    size: number,
    cell: number,
    alpha = 1,
  ) {
    if (!cell) return;
    const color = COLORS[cell];
    if (!color) return;
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(px + 1, py + 1, size - 2, size - 2);
    c.fillStyle = "rgba(255,255,255,0.12)";
    c.fillRect(px + 1, py + 1, size - 2, Math.max(2, size * 0.13));
    c.globalAlpha = 1;
  }
  /** Celda en coordenadas de tablero. */
  function drawBlock(c: CanvasRenderingContext2D, x: number, y: number, cell: number, alpha = 1) {
    drawCell(c, rt.boardX + x * rt.block, rt.boardY + y * rt.block, rt.block, cell, alpha);
  }
  function drawPiece(c: CanvasRenderingContext2D, piece: Piece, oy: number, alpha = 1) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let col = 0; col < piece.shape[r].length; col++) {
        drawBlock(c, piece.x + col, oy + r, piece.shape[r][col], alpha);
      }
    }
  }
  function drawGrid(c: CanvasRenderingContext2D) {
    const b = rt.block;
    c.strokeStyle = GRID_LINE_COLOR;
    c.lineWidth = 0.5;
    for (let col = 1; col < COLS; col++) {
      c.beginPath();
      c.moveTo(rt.boardX + col * b, rt.boardY);
      c.lineTo(rt.boardX + col * b, rt.boardY + ROWS * b);
      c.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      c.beginPath();
      c.moveTo(rt.boardX, rt.boardY + r * b);
      c.lineTo(rt.boardX + COLS * b, rt.boardY + r * b);
      c.stroke();
    }
  }
  function drawBoardFrame(c: CanvasRenderingContext2D) {
    const b = rt.block;
    c.strokeStyle = "rgba(255,255,255,0.22)";
    c.lineWidth = Math.max(1, b * 0.06);
    c.strokeRect(rt.boardX, rt.boardY, COLS * b, ROWS * b);
  }
  /**
   * Panel NEXT en el hueco lateral del CRT: rótulo encima y la pieza siguiente
   * centrada en una caja de 4×4 celdas. Todo dimensionado en múltiplos de
   * `block`, así que escala con el tablero en cualquier tamaño de CRT.
   */
  function drawNextPanel(c: CanvasRenderingContext2D) {
    const b = rt.block;
    const panelX = rt.boardX + 11 * b;
    const labelY = rt.boardY + 1.6 * b;
    const boxY = rt.boardY + 2.2 * b;
    const boxSize = 4 * b;
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.font = `${Math.round(b * 0.5)}px monospace`;
    c.fillText("NEXT", panelX, labelY);
    c.strokeStyle = "rgba(255,255,255,0.14)";
    c.lineWidth = Math.max(1, b * 0.05);
    c.strokeRect(panelX, boxY, boxSize, boxSize);
    const shape = rt.next.shape;
    const offX = (4 - shape[0].length) / 2;
    const offY = (4 - shape.length) / 2;
    for (let r = 0; r < shape.length; r++) {
      for (let col = 0; col < shape[r].length; col++) {
        drawCell(c, panelX + (offX + col) * b, boxY + (offY + r) * b, b, shape[r][col]);
      }
    }
  }
  /** Mismo patrón que Asteroides: overlay en canvas, y luego el modal React. */
  function drawGameOverOverlay(c: CanvasRenderingContext2D) {
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillRect(0, 0, rt.w, rt.h);
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    c.fillStyle = "#fff";
    c.font = "bold 46px monospace";
    c.fillText("GAME OVER", rt.w / 2, rt.h / 2 - 18);
    c.font = "18px monospace";
    c.fillStyle = "rgba(255,255,255,0.65)";
    c.fillText(`PUNTAJE: ${rt.score}`, rt.w / 2, rt.h / 2 + 22);
  }
  function draw(c: CanvasRenderingContext2D) {
    c.fillStyle = "#000";
    c.fillRect(0, 0, rt.w, rt.h);
    drawGrid(c);
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) drawBlock(c, col, r, rt.board[r][col]);
    }
    // Ghost piece: dónde aterrizaría la pieza actual si cayera recto.
    drawPiece(c, rt.current, ghostY(rt.board, rt.current), 0.2);
    drawPiece(c, rt.current, rt.current.y);
    drawBoardFrame(c);
    drawNextPanel(c);
    if (rt.phase === "gameover") drawGameOverOverlay(c);
  }
  // ── Publicación de estado al HUD ──────────────────────────────────────────
  let lastPhase: GamePhase | null = null;
  let lastLevel = -1;
  let lastLines = -1;
  function emitState() {
    rt.stateAccum = 0;
    lastPhase = rt.phase;
    lastLevel = rt.level;
    lastLines = rt.lines;
    // Sin `lives`: Caída no tiene vidas, y su ausencia es lo que oculta ese
    // stat en el HUD. `tripleShot` es específico de Asteroides.
    onState({
      score: rt.score,
      level: rt.level,
      lines: rt.lines,
      phase: rt.phase,
      tripleShot: 0,
    });
  }
  /** ~10 Hz, más una emisión inmediata en cada cambio de fase, nivel o líneas. */
  function publishState(dt: number) {
    rt.stateAccum += dt;
    const changed = rt.phase !== lastPhase || rt.level !== lastLevel || rt.lines !== lastLines;
    if (changed || rt.stateAccum >= STATE_INTERVAL) emitState();
  }
  // ── Loop principal ────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let destroyed = false;
  function loop(ts: number) {
    // Si destroy() llegó entre dos frames, este callback no debe reprogramarse:
    // en React Strict Mode el primer montaje se desmonta y quedarían dos loops.
    if (destroyed) return;
    // dt en ms, capado: una pestaña en segundo plano no debe desplomar la pieza.
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;
    update(dt);
    draw(ctx);
    publishState(dt);
    rafId = requestAnimationFrame(loop);
  }
  function initGame() {
    rt.board = createBoard();
    rt.score = 0;
    rt.lines = 0;
    rt.level = 1;
    rt.phase = "playing";
    rt.prevPhase = "playing";
    rt.dropAccum = 0;
    rt.dropInterval = DROP_BASE_MS;
    rt.gameOverTimer = 0;
    rt.stateAccum = 0;
    gameOverNotified = false;
    rt.next = randomPiece();
    spawn();
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
