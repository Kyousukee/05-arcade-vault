// ===== game.ts — instancia jugable de Asteroides =====
//
// Todo el estado vive dentro de createAsteroidsGame(): no hay variables de
// módulo mutables, así que dos instancias pueden coexistir sin interferirse.
import type { GameFactory, GameInstance, GameMountOptions, GamePhase } from "../types";
import {
  BASE_H,
  BASE_W,
  DEAD_DELAY,
  GAME_OVER_DELAY,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  SAFE_DIST_RATIO,
  STATE_INTERVAL,
} from "./constants";
import {
  Asteroid,
  Bullet,
  Particle,
  PowerUp,
  Ship,
  type KeyState,
  type Positioned,
} from "./entities";
import { dist, rand } from "./utils";
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
  /** Segundos restantes de overlay GAME OVER antes de avisar al reproductor. */
  gameOverTimer: number;
  powerUpSpawned: boolean;
  killsSinceSpawn: number;
  /** Dimensiones lógicas actuales (antes constantes W=800, H=600). */
  w: number;
  h: number;
}
export const createAsteroidsGame: GameFactory = ({
  canvas,
  onState,
  onGameOver,
}: GameMountOptions): GameInstance => {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = ctx2d;
  // ── Input (por instancia, no global) ──────────────────────────────────────
  const keys: KeyState = {};
  const justPressed: KeyState = {};
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "KeyP" || e.code === "Escape") togglePause();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  const pressed = (code: string) => {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  };
  // ── Tamaño lógico ─────────────────────────────────────────────────────────
  /** Mide el canvas en px CSS; cae a 800x600 si todavía no está maquetado. */
  function measure() {
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || canvas.clientWidth || BASE_W;
    const cssH = rect.height || canvas.clientHeight || BASE_H;
    return { cssW, cssH };
  }
  const { cssW: w, cssH: h } = measure();
  const rt: AsteroidsRuntime = {
    ship: new Ship(w, h),
    bullets: [],
    asteroids: [],
    particles: [],
    powerUps: [],
    score: 0,
    lives: 3,
    level: 1,
    phase: "playing",
    deadTimer: 0,
    gameOverTimer: 0,
    powerUpSpawned: false,
    killsSinceSpawn: 0,
    w,
    h,
  };
  let gameOverNotified = false;
  /** Fase a la que se vuelve al reanudar (`playing` o `dead`). */
  let phaseBeforePause: GamePhase = "playing";
  /**
   * Ajusta el búfer del canvas al tamaño CSS actual (con devicePixelRatio) y
   * reescala proporcionalmente las posiciones para que nada quede fuera.
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
    const sx = cssW / rt.w;
    const sy = cssH / rt.h;
    if (sx !== 1 || sy !== 1) {
      const entities: Positioned[] = [
        rt.ship,
        ...rt.asteroids,
        ...rt.bullets,
        ...rt.particles,
        ...rt.powerUps,
      ];
      for (const e of entities) {
        e.x *= sx;
        e.y *= sy;
      }
      rt.w = cssW;
      rt.h = cssH;
    }
  }
  const resizeObserver = new ResizeObserver(() => applyResize());
  resizeObserver.observe(canvas);
  function spawnAsteroids(count: number) {
    const safeDist = Math.min(rt.w, rt.h) * SAFE_DIST_RATIO;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, rt.w);
        y = rand(0, rt.h);
      } while (Math.hypot(x - rt.w / 2, y - rt.h / 2) < safeDist);
      rt.asteroids.push(new Asteroid(x, y, 3));
    }
  }
  function initGame() {
    rt.ship = new Ship(rt.w, rt.h);
    rt.bullets = [];
    rt.asteroids = [];
    rt.particles = [];
    rt.powerUps = [];
    rt.powerUpSpawned = false;
    rt.killsSinceSpawn = 0;
    rt.score = 0;
    rt.lives = 3;
    rt.level = 1;
    rt.phase = "playing";
    rt.deadTimer = 0;
    rt.gameOverTimer = 0;
    gameOverNotified = false;
    phaseBeforePause = "playing";
    spawnAsteroids(4);
  }
  function nextLevel() {
    rt.level++;
    rt.bullets = [];
    rt.particles = [];
    rt.powerUps = [];
    rt.powerUpSpawned = false;
    rt.killsSinceSpawn = 0;
    rt.ship.reset(rt.w, rt.h);
    spawnAsteroids(3 + rt.level);
  }
  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) rt.particles.push(new Particle(x, y));
  }
  /** Única entrada a la fase final: overlay en canvas y luego onGameOver(). */
  function toGameOver() {
    if (rt.phase === "gameover") return;
    // Si venía de una pausa, el primer dt no debe comerse el overlay.
    lastTime = null;
    rt.phase = "gameover";
    rt.gameOverTimer = GAME_OVER_DELAY;
    rt.ship.thrusting = false;
  }
  function killShip() {
    explode(rt.ship.x, rt.ship.y, 14);
    rt.ship.dead = true;
    rt.lives--;
    if (rt.lives <= 0) {
      rt.lives = 0;
      toGameOver();
    } else {
      rt.phase = "dead";
      rt.deadTimer = DEAD_DELAY;
    }
  }
  // ── Pausa ─────────────────────────────────────────────────────────────────
  function pauseGame() {
    if (rt.phase !== "playing" && rt.phase !== "dead") return;
    phaseBeforePause = rt.phase;
    rt.phase = "paused";
  }
  function resumeGame() {
    if (rt.phase !== "paused") return;
    // Sin esto, el primer frame tras la pausa llegaría con un dt enorme.
    lastTime = null;
    rt.phase = phaseBeforePause;
  }
  function togglePause() {
    if (rt.phase === "paused") resumeGame();
    else pauseGame();
  }
  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    // En pausa no se acumula tiempo: el canvas sigue mostrando el último frame.
    if (rt.phase === "paused") return;
    if (rt.phase === "gameover") {
      rt.particles.forEach((p) => p.update(dt));
      rt.particles = rt.particles.filter((p) => !p.dead);
      if (rt.gameOverTimer > 0) {
        rt.gameOverTimer -= dt;
        if (rt.gameOverTimer <= 0 && !gameOverNotified) {
          gameOverNotified = true;
          onGameOver(rt.score);
        }
      }
      return;
    }
    if (rt.phase === "dead") {
      rt.deadTimer -= dt;
      rt.particles.forEach((p) => p.update(dt));
      rt.particles = rt.particles.filter((p) => !p.dead);
      rt.asteroids.forEach((a) => a.update(dt, rt.w, rt.h));
      if (rt.deadTimer <= 0) {
        rt.phase = "playing";
        rt.ship.reset(rt.w, rt.h);
      }
      return;
    }
    // Disparar
    if (pressed("Space")) rt.bullets.push(...rt.ship.tryShoot());
    rt.ship.update(dt, rt.w, rt.h, keys);
    rt.bullets.forEach((b) => b.update(dt, rt.w, rt.h));
    rt.asteroids.forEach((a) => a.update(dt, rt.w, rt.h));
    rt.particles.forEach((p) => p.update(dt));
    rt.powerUps.forEach((p) => p.update(dt, rt.w, rt.h));
    rt.bullets = rt.bullets.filter((b) => !b.dead);
    rt.particles = rt.particles.filter((p) => !p.dead);
    rt.powerUps = rt.powerUps.filter((p) => !p.dead);
    for (const p of rt.powerUps) {
      if (!p.dead && dist(rt.ship, p) < rt.ship.radius + p.radius) {
        p.dead = true;
        rt.ship.tripleShot = POWERUP_DURATION;
      }
    }
    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of rt.bullets) {
      for (const a of rt.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          rt.score += a.points;
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!rt.powerUpSpawned) {
            rt.killsSinceSpawn++;
            const guaranteed = rt.killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              rt.powerUps.push(new PowerUp(a.x, a.y));
              rt.powerUpSpawned = true;
            }
          }
        }
      }
    }
    rt.asteroids = rt.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    rt.bullets = rt.bullets.filter((b) => !b.dead);
    // Nave vs asteroide
    if (rt.ship.invincible <= 0) {
      for (const a of rt.asteroids) {
        if (dist(rt.ship, a) < rt.ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }
    // Nivel completado
    if (rt.asteroids.length === 0) nextLevel();
  }
  // ── Draw ──────────────────────────────────────────────────────────────────
  function drawOverlay(c: CanvasRenderingContext2D, title: string, sub: string) {
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    c.fillStyle = "#fff";
    c.font = "bold 46px monospace";
    c.fillText(title, rt.w / 2, rt.h / 2 - 18);
    c.font = "18px monospace";
    c.fillStyle = "rgba(255,255,255,0.65)";
    c.fillText(sub, rt.w / 2, rt.h / 2 + 22);
  }
  function draw(c: CanvasRenderingContext2D) {
    c.fillStyle = "#000";
    c.fillRect(0, 0, rt.w, rt.h);
    rt.particles.forEach((p) => p.draw(c));
    rt.asteroids.forEach((a) => a.draw(c));
    rt.powerUps.forEach((p) => p.draw(c));
    rt.bullets.forEach((b) => b.draw(c));
    rt.ship.draw(c);
    if (rt.phase === "gameover") drawOverlay(c, "GAME OVER", `PUNTAJE: ${rt.score}`);
  }
  // ── Publicación de estado al HUD ──────────────────────────────────────────
  let stateTimer = 0;
  let lastPhase: GamePhase | null = null;
  let lastLives = -1;
  let lastLevel = -1;
  function emitState() {
    stateTimer = 0;
    lastPhase = rt.phase;
    lastLives = rt.lives;
    lastLevel = rt.level;
    onState({
      score: rt.score,
      lives: rt.lives,
      level: rt.level,
      phase: rt.phase,
      tripleShot: Math.max(0, rt.ship.tripleShot),
    });
  }
  /** ~10 Hz, más una emisión inmediata en cada cambio de fase, vida o nivel. */
  function publishState(dt: number) {
    stateTimer += dt;
    const changed = rt.phase !== lastPhase || rt.lives !== lastLives || rt.level !== lastLevel;
    if (changed || stateTimer >= STATE_INTERVAL) emitState();
  }
  // ── Loop principal ────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let destroyed = false;
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw(ctx);
    publishState(dt);
    rafId = requestAnimationFrame(loop);
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
      window.removeEventListener("keyup", onKeyUp);
    },
  };
};
