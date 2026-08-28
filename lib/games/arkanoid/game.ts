// ===== game.ts — instancia jugable de Bloque Buster (Arkanoid) =====
//
// Donde la fuente tenía trece globals de módulo (canvas, ctx, paddle, ball,
// blocks, explosions, lives, score, gameState, currentLevel, isPaused, keys,
// lastTime) más los tres del spritesheet, aquí hay un `runtime` local a la
// factory: dos instancias pueden coexistir sin interferirse.
//
// Todo el juego vive en el espacio lógico 800×600 de la fuente. El canvas solo
// aplica un transform de escala, así que la física se porta sin recalibrar.
import type { GameFactory, GameInstance, GameMountOptions, GamePhase, SkinId } from "../types";
import { createGameAudio } from "./audio";
import {
  BALL_SIZE,
  BASE_BALL_VX,
  BASE_BALL_VY,
  BLOCKS_ORIGIN_X,
  BLOCKS_ORIGIN_Y,
  BLOCK_H,
  BLOCK_W,
  EXPLOSION_DURATION,
  GAME_OVER_DELAY,
  LOGICAL_H,
  LOGICAL_W,
  PADDLE_INIT,
  PADDLE_SPEED,
  POINTS_PER_BLOCK,
  START_LIVES,
  STATE_INTERVAL,
} from "./constants";
import { LEVELS, type BlockColor } from "./levels";
import { type ArkanoidSkin, popGlow, pushGlow, resolveSkin } from "./skins";
import {
  EXPLOSION_FRAMES,
  type SkinnedSheet,
  type Spritesheet,
  buildTintedSheet,
  drawBlockSprite,
  drawExplosionFrame,
  drawSprite,
  loadSpritesheet,
} from "./sprites";
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Ball extends Rect {
  /** px lógicos/segundo. */
  vx: number;
  vy: number;
}
interface Block extends Rect {
  color: BlockColor;
  alive: boolean;
}
interface Explosion extends Rect {
  color: BlockColor;
  /** ms desde que se rompió el bloque. */
  elapsed: number;
}
interface ArkanoidRuntime {
  paddle: Rect;
  ball: Ball;
  blocks: Block[];
  explosions: Explosion[];
  score: number;
  lives: number;
  /** 1–5. */
  level: number;
  phase: GamePhase;
  /** Fase previa a la pausa, a la que se vuelve al reanudar. */
  prevPhase: GamePhase;
  keys: { left: boolean; right: boolean };
  /** null hasta que resuelve el PNG; mientras tanto solo se pinta el fondo. */
  sheet: Spritesheet | null;
  /** Skin activa. La muta setSkin(); el siguiente frame ya pinta con ella. */
  skin: ArkanoidSkin;
  /**
   * Hojas ya tintadas, una por skin. El tintado recorre la hoja entera, así que
   * se genera una sola vez por skin y nunca por frame.
   */
  tinted: Map<SkinId, SkinnedSheet>;
  /** Mensaje del overlay de fin de partida. */
  endMessage: string;
  /** ms restantes de overlay de fin antes de avisar al reproductor. */
  gameOverTimer: number;
  /** segundos acumulados desde la última emisión de onState. */
  stateAccum: number;
  /** Tamaño del canvas en px CSS. Solo se usa para calcular el transform. */
  cssW: number;
  cssH: number;
}
/** Tamaño de referencia si el canvas todavía no está maquetado. */
const FALLBACK_W = LOGICAL_W;
const FALLBACK_H = LOGICAL_H;
/** Overlay al agotar las vidas. */
const MSG_GAME_OVER = "GAME OVER";
/** Overlay al romper el último bloque del nivel 5. */
const MSG_WIN = "¡COMPLETASTE EL JUEGO!";
export const createBloqueBusterGame: GameFactory = ({
  canvas,
  onState,
  onGameOver,
  skin,
}: GameMountOptions): GameInstance => {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = ctx2d;
  const audio = createGameAudio();
  const rt: ArkanoidRuntime = {
    paddle: { x: 0, y: PADDLE_INIT.y, w: PADDLE_INIT.w, h: PADDLE_INIT.h },
    ball: { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: BASE_BALL_VX, vy: BASE_BALL_VY },
    blocks: [],
    explosions: [],
    score: 0,
    lives: START_LIVES,
    level: 1,
    phase: "playing",
    prevPhase: "playing",
    keys: { left: false, right: false },
    sheet: null,
    skin: resolveSkin(skin),
    tinted: new Map(),
    endMessage: MSG_GAME_OVER,
    gameOverTimer: 0,
    stateAccum: 0,
    cssW: FALLBACK_W,
    cssH: FALLBACK_H,
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
   * Ajusta el búfer al tamaño CSS (con devicePixelRatio) y aplica un único
   * transform que combina DPR y escala lógica. Ninguna entidad se reposiciona:
   * sus coordenadas son lógicas y no dependen del tamaño del canvas.
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
  const resizeObserver = new ResizeObserver(() => applyResize());
  resizeObserver.observe(canvas);
  // ── Inicialización de entidades ───────────────────────────────────────────
  function initPaddle() {
    rt.paddle.x = (LOGICAL_W - rt.paddle.w) / 2;
  }
  /** Coloca la pelota sobre el paddle con la velocidad del nivel actual. */
  function initBall() {
    const { speed } = LEVELS[rt.level - 1];
    rt.ball.x = rt.paddle.x + (rt.paddle.w - rt.ball.w) / 2;
    rt.ball.y = rt.paddle.y - rt.ball.h;
    rt.ball.vx = BASE_BALL_VX * speed;
    rt.ball.vy = BASE_BALL_VY * speed;
  }
  function loadLevel(n: number) {
    rt.level = n;
    const level = LEVELS[n - 1];
    rt.blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    rt.explosions = [];
    initBall();
  }
  function collideAABB(block: Block) {
    const { ball } = rt;
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }
  // ── Fin de partida ────────────────────────────────────────────────────────
  /** Única entrada a la fase final: overlay en canvas y luego onGameOver(). */
  function toGameOver(message: string) {
    if (rt.phase === "gameover") return;
    // Si venía de una pausa, el primer dt no debe comerse parte del overlay.
    lastTime = null;
    rt.phase = "gameover";
    rt.endMessage = message;
    rt.gameOverTimer = GAME_OVER_DELAY;
    audio.setMuted(true);
  }
  // ── Pausa ─────────────────────────────────────────────────────────────────
  function pauseGame() {
    if (rt.phase !== "playing") return;
    rt.prevPhase = rt.phase;
    rt.phase = "paused";
    // Un rebote a medio sonar no debe seguir sonando bajo el panel EN PAUSA.
    audio.setMuted(true);
  }
  function resumeGame() {
    if (rt.phase !== "paused") return;
    // Sin resetear lastTime, el primer frame tras la pausa traería todo el
    // tiempo transcurrido y la pelota saltaría media pantalla.
    lastTime = null;
    rt.phase = rt.prevPhase;
    audio.setMuted(false);
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
    if (e.code === "ArrowLeft") rt.keys.left = true;
    if (e.code === "ArrowRight") rt.keys.right = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft") rt.keys.left = false;
    if (e.code === "ArrowRight") rt.keys.right = false;
  };
  /**
   * El ratón centra el paddle en el puntero. La fuente no comprobaba la fase, así
   * que el paddle se deslizaba bajo el overlay de GAME OVER; aquí solo se mueve
   * mientras se juega.
   */
  const onMouseMove = (e: MouseEvent) => {
    if (rt.phase !== "playing") return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return;
    // Camino inverso al transform: del px CSS al espacio lógico 800×600.
    const mx = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
    rt.paddle.x = Math.max(0, Math.min(LOGICAL_W - rt.paddle.w, mx - rt.paddle.w / 2));
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousemove", onMouseMove);
  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (rt.phase === "gameover") {
      // El overlay se ve en el canvas antes de que el reproductor abra el modal.
      if (rt.gameOverTimer > 0) {
        rt.gameOverTimer -= dt * 1000;
        if (rt.gameOverTimer <= 0 && !gameOverNotified) {
          gameOverNotified = true;
          onGameOver(rt.score);
        }
      }
      return;
    }
    // En pausa no se acumula tiempo: el canvas sigue mostrando el último frame.
    if (rt.phase !== "playing") return;
    const { paddle, ball } = rt;
    // Paddle
    if (rt.keys.left) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (rt.keys.right) paddle.x = Math.min(LOGICAL_W - paddle.w, paddle.x + PADDLE_SPEED * dt);
    // Movimiento de la pelota
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    // Rebotes en los muros izquierdo, derecho y superior
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      audio.playBounce();
    }
    if (ball.x + ball.w >= LOGICAL_W) {
      ball.x = LOGICAL_W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      audio.playBounce();
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      audio.playBounce();
    }
    // Rebote en el paddle
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      audio.playBounce();
    }
    // Colisión con bloques. Portada tal cual: solo se invierte vy (nunca vx) y
    // se procesa un bloque por frame.
    for (const block of rt.blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        rt.explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        rt.score += POINTS_PER_BLOCK;
        ball.vy = -ball.vy;
        audio.playBreak();
        if (rt.blocks.every((b) => !b.alive)) {
          if (rt.level < LEVELS.length) loadLevel(rt.level + 1);
          else toGameOver(MSG_WIN);
        }
        break; // un bloque por frame
      }
    }
    // Explosiones
    for (const exp of rt.explosions) exp.elapsed += dt * 1000;
    rt.explosions = rt.explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);
    // Pelota perdida
    if (ball.y > LOGICAL_H) {
      rt.lives--;
      if (rt.lives <= 0) {
        rt.lives = 0;
        toGameOver(MSG_GAME_OVER);
      } else {
        initBall();
      }
    }
  }
  // ── Draw ──────────────────────────────────────────────────────────────────
  /**
   * HUD en canvas, portado de la fuente: Score a la izquierda, Nivel centrado y
   * las vidas como sprites de pelota a la derecha. Todo en px lógicos, así que
   * escala con el resto del tablero.
   */
  function drawHud(skinned: SkinnedSheet) {
    const { skin: active } = rt;
    ctx.fillStyle = active.hudText;
    pushGlow(ctx, active, active.hudText);
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Score: ${rt.score}`, 10, 10);
    ctx.textAlign = "center";
    ctx.fillText(`Nivel: ${rt.level}`, LOGICAL_W / 2, 10);
    if (active.tint) pushGlow(ctx, active, active.tint.ball);
    const spacing = 4;
    for (let i = 0; i < rt.lives; i++) {
      const x = LOGICAL_W - 10 - (rt.lives - i) * (BALL_SIZE + spacing);
      drawSprite(ctx, skinned, "ball", x, 10, BALL_SIZE, BALL_SIZE);
    }
    popGlow(ctx);
  }
  /** Overlay de fin de partida: velo oscuro y el mensaje centrado. */
  function drawEndOverlay() {
    const { skin: active } = rt;
    ctx.fillStyle = active.overlayVeil;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = active.overlayTitle;
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    pushGlow(ctx, active, active.overlayTitle);
    ctx.fillText(rt.endMessage, LOGICAL_W / 2, LOGICAL_H / 2);
    popGlow(ctx);
  }
  /**
   * Marco de los tres muros que rebotan. Solo lo pintan las skins que lo
   * declaran: `clasico` lo tiene a `null` y el canvas queda como el original.
   */
  function drawWalls() {
    const { wall } = rt.skin;
    if (!wall) return;
    ctx.strokeStyle = wall;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(1, LOGICAL_H);
    ctx.lineTo(1, 1);
    ctx.lineTo(LOGICAL_W - 1, 1);
    ctx.lineTo(LOGICAL_W - 1, LOGICAL_H);
    ctx.stroke();
  }
  /**
   * Hoja lista para la skin activa. Sin tint (`clasico`) devuelve la hoja
   * original intacta: el sprite no pasa por el pipeline de tintado y el render
   * es exactamente el de siempre.
   */
  function skinnedSheet(): SkinnedSheet | null {
    const base = rt.sheet;
    if (!base) return null;
    const active = rt.skin;
    if (!active.tint) return { sheet: base, grayExplosion: null };
    let cached = rt.tinted.get(active.id);
    if (!cached) {
      cached = buildTintedSheet(base, active.tint);
      rt.tinted.set(active.id, cached);
    }
    return cached;
  }
  function draw() {
    const active = rt.skin;
    ctx.fillStyle = active.background;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawWalls();
    // Mientras el spritesheet no haya cargado solo se ve el fondo.
    const skinned = skinnedSheet();
    if (!skinned) return;
    for (const block of rt.blocks) {
      if (!block.alive) continue;
      if (active.tint) pushGlow(ctx, active, active.tint.blocks[block.color]);
      drawBlockSprite(ctx, skinned, block.color, block.x, block.y, block.w, block.h);
    }
    for (const exp of rt.explosions) {
      const frames = EXPLOSION_FRAMES[exp.color];
      const index = Math.min(Math.floor((exp.elapsed / EXPLOSION_DURATION) * frames.length), 3);
      if (active.tint) pushGlow(ctx, active, active.tint.blocks[exp.color]);
      drawExplosionFrame(ctx, skinned, exp.color, index, exp.x, exp.y, exp.w, exp.h);
    }
    if (active.tint) pushGlow(ctx, active, active.tint.paddle);
    drawSprite(ctx, skinned, "paddle", rt.paddle.x, rt.paddle.y, rt.paddle.w, rt.paddle.h);
    if (active.tint) pushGlow(ctx, active, active.tint.ball);
    drawSprite(ctx, skinned, "ball", rt.ball.x, rt.ball.y, rt.ball.w, rt.ball.h);
    popGlow(ctx);
    // El HUD desaparece bajo el overlay de fin; en pausa sigue visible.
    if (rt.phase === "gameover") drawEndOverlay();
    else drawHud(skinned);
  }
  // ── Publicación de estado al HUD ──────────────────────────────────────────
  let lastPhase: GamePhase | null = null;
  let lastLives = -1;
  let lastLevel = -1;
  function emitState() {
    rt.stateAccum = 0;
    lastPhase = rt.phase;
    lastLives = rt.lives;
    lastLevel = rt.level;
    // Sin `lines`: no aplica a este juego, y su ausencia es lo que oculta ese
    // stat en el HUD. `tripleShot` es específico de Asteroides.
    onState({
      score: rt.score,
      level: rt.level,
      lives: rt.lives,
      phase: rt.phase,
      tripleShot: 0,
    });
  }
  /** ~10 Hz, más una emisión inmediata en cada cambio de fase, vidas o nivel. */
  function publishState(dt: number) {
    rt.stateAccum += dt;
    const changed = rt.phase !== lastPhase || rt.lives !== lastLives || rt.level !== lastLevel;
    if (changed || rt.stateAccum >= STATE_INTERVAL) emitState();
  }
  // ── Loop principal ────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;
  function loop(ts: number) {
    // Si destroy() llegó entre dos frames, este callback no debe reprogramarse:
    // en React Strict Mode el primer montaje se desmonta y quedarían dos loops.
    if (destroyed) return;
    // dt en segundos, capado a 50 ms: una pestaña en segundo plano no debe
    // teletransportar la pelota a través de los bloques.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    publishState(dt);
    rafId = requestAnimationFrame(loop);
  }
  function initGame() {
    rt.score = 0;
    rt.lives = START_LIVES;
    rt.phase = "playing";
    rt.prevPhase = "playing";
    rt.endMessage = MSG_GAME_OVER;
    rt.gameOverTimer = 0;
    rt.stateAccum = 0;
    rt.keys.left = false;
    rt.keys.right = false;
    rt.explosions = [];
    gameOverNotified = false;
    audio.setMuted(false);
    initPaddle();
    loadLevel(1);
  }
  // El juego arranca ya, sin esperar al PNG: hasta que resuelve, draw() pinta el
  // fondo negro. Si la carga falla, la partida sigue siendo jugable.
  loadSpritesheet()
    .then((sheet) => {
      if (!destroyed) rt.sheet = sheet;
    })
    .catch(() => {});
  applyResize();
  initGame();
  emitState();
  rafId = requestAnimationFrame(loop);
  // ── Handle público ────────────────────────────────────────────────────────
  return {
    pause: pauseGame,
    resume: resumeGame,
    end() {
      toGameOver(MSG_GAME_OVER);
    },
    restart() {
      lastTime = null;
      initGame();
    },
    setSkin(id: SkinId) {
      // Sin remontar ni reiniciar la partida: el siguiente frame ya pinta con la
      // nueva, y su hoja tintada sale del caché si ya se generó antes.
      rt.skin = resolveSkin(id);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      audio.dispose();
    },
  };
};
