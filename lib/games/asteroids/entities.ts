// ===== entities.ts — entidades del juego, sin globals de módulo =====
//
// Cada entidad recibe las dimensiones lógicas en update(dt, w, h) y el contexto
// y la paleta en draw(ctx, skin): así dos instancias pueden coexistir sin interferirse.
import {
  BULLET_RADIUS,
  BULLET_SPEED,
  BULLET_TTL,
  NOSE,
  POINTS,
  POWERUP_RADIUS,
  POWERUP_TTL,
  RADII,
  SHIP_DRAG,
  SHIP_INVINCIBLE,
  SHIP_RADIUS,
  SHIP_ROT,
  SHIP_THRUST,
  SHOOT_COOLDOWN,
  SPEEDS,
  TRIPLE_SPREAD,
} from "./constants";
import { particleStroke, popGlow, pushGlow, type AsteroidsSkin } from "./skins";
import { rand, randInt, wrap } from "./utils";
/** Teclas pulsadas, por `KeyboardEvent.code`. */
export type KeyState = Record<string, boolean>;
/** Tamaño de asteroide: 1 (pequeño), 2 (mediano) o 3 (grande). */
export type AsteroidSize = 1 | 2 | 3;
/** Todo lo que se mueve por el campo y puede reescalarse al redimensionar. */
export interface Positioned {
  x: number;
  y: number;
}
// ── Bullet ──────────────────────────────────────────────────────────────────
export class Bullet implements Positioned {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = BULLET_TTL;
  radius = BULLET_RADIUS;
  dead = false;
  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * BULLET_SPEED;
    this.vy = Math.sin(angle) * BULLET_SPEED;
  }
  update(dt: number, w: number, h: number) {
    this.x = wrap(this.x + this.vx * dt, w);
    this.y = wrap(this.y + this.vy * dt, h);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D, skin: AsteroidsSkin) {
    ctx.fillStyle = skin.bullet;
    pushGlow(ctx, skin, skin.bullet);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    popGlow(ctx);
  }
}
// ── Asteroid ────────────────────────────────────────────────────────────────
export class Asteroid implements Positioned {
  x: number;
  y: number;
  size: AsteroidSize;
  radius: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  verts: [number, number][] = [];
  dead = false;
  constructor(x: number, y: number, size: AsteroidSize = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];
    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);
    // Polígono irregular
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }
  get points() {
    return POINTS[this.size];
  }
  update(dt: number, w: number, h: number) {
    this.x = wrap(this.x + this.vx * dt, w);
    this.y = wrap(this.y + this.vy * dt, h);
    this.rot += this.rotSpeed * dt;
  }
  split(): Asteroid[] {
    if (this.size <= 1) return [];
    const size = (this.size - 1) as AsteroidSize;
    return [new Asteroid(this.x, this.y, size), new Asteroid(this.x, this.y, size)];
  }
  draw(ctx: CanvasRenderingContext2D, skin: AsteroidsSkin) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = skin.asteroid;
    pushGlow(ctx, skin, skin.asteroid);
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    popGlow(ctx);
    ctx.restore();
  }
}
// ── PowerUp ─────────────────────────────────────────────────────────────────
export class PowerUp implements Positioned {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = POWERUP_RADIUS;
  ttl = POWERUP_TTL;
  dead = false;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }
  update(dt: number, w: number, h: number) {
    this.x = wrap(this.x + this.vx * dt, w);
    this.y = wrap(this.y + this.vy * dt, h);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D, skin: AsteroidsSkin) {
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = skin.powerUp;
    pushGlow(ctx, skin, skin.powerUp);
    ctx.lineWidth = 2;
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    popGlow(ctx);
    ctx.restore();
    ctx.fillStyle = skin.powerUp;
    pushGlow(ctx, skin, skin.powerUp);
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
    popGlow(ctx);
  }
}
// ── Ship ────────────────────────────────────────────────────────────────────
export class Ship implements Positioned {
  x = 0;
  y = 0;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = SHIP_RADIUS;
  thrusting = false;
  invincible = SHIP_INVINCIBLE;
  shootCooldown = 0;
  dead = false;
  tripleShot = 0;
  constructor(w: number, h: number) {
    this.reset(w, h);
  }
  reset(w: number, h: number) {
    this.x = w / 2;
    this.y = h / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = SHIP_RADIUS;
    this.thrusting = false;
    this.invincible = SHIP_INVINCIBLE;
    this.shootCooldown = 0;
    this.dead = false;
  }
  update(dt: number, w: number, h: number, keys: KeyState) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot = Math.max(0, this.tripleShot - dt);
    if (keys["ArrowLeft"]) this.angle -= SHIP_ROT * dt;
    if (keys["ArrowRight"]) this.angle += SHIP_ROT * dt;
    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * SHIP_THRUST * dt;
      this.vy += Math.sin(this.angle) * SHIP_THRUST * dt;
    }
    this.vx *= SHIP_DRAG;
    this.vy *= SHIP_DRAG;
    this.x = wrap(this.x + this.vx * dt, w);
    this.y = wrap(this.y + this.vy * dt, h);
  }
  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = SHOOT_COOLDOWN;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }
  draw(ctx: CanvasRenderingContext2D, skin: AsteroidsSkin) {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = skin.ship;
    pushGlow(ctx, skin, skin.ship);
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca trasera
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    ctx.stroke();
    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = skin.thrust;
      pushGlow(ctx, skin, skin.thrust);
      ctx.stroke();
    }
    popGlow(ctx);
    ctx.restore();
  }
}
// ── Partículas (explosión) ──────────────────────────────────────────────────
export class Particle implements Positioned {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }
  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D, skin: AsteroidsSkin) {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = particleStroke(skin, alpha);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}
