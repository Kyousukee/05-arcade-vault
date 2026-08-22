// ===== constants.ts — tunables del juego (calibrados sobre 800x600) =====
/** Radio del asteroide por tamaño 1, 2, 3. */
export const RADII = [0, 16, 30, 50] as const;
/** Velocidad base por tamaño. */
export const SPEEDS = [0, 85, 55, 32] as const;
/** Puntos por tamaño. */
export const POINTS = [0, 100, 50, 20] as const;
export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_DURATION = 5;
export const POWERUP_TTL = 12;
export const TRIPLE_SPREAD = 0.18;
/** Nave. */
export const SHIP_ROT = 3.5; // rad/s
export const SHIP_THRUST = 260; // px/s²
export const SHIP_DRAG = 0.987;
export const SHIP_RADIUS = 12;
export const SHIP_INVINCIBLE = 3; // s tras reaparecer
export const SHOOT_COOLDOWN = 0.2; // s
export const NOSE = 21; // px desde el centro hasta la punta
/** Bala. */
export const BULLET_SPEED = 520;
export const BULLET_TTL = 1.1;
export const BULLET_RADIUS = 2;
/** Power-up. */
export const POWERUP_RADIUS = 12;
/** Fracción de min(w, h) libre alrededor de la nave al generar asteroides. */
export const SAFE_DIST_RATIO = 130 / 600;
/** Segundos de espera antes de reaparecer tras morir. */
export const DEAD_DELAY = 2;
/** Segundos de overlay GAME OVER en el canvas antes de abrir el modal. */
export const GAME_OVER_DELAY = 1.2;
/** Cadencia de publicación del estado al HUD React (~10 Hz). */
export const STATE_INTERVAL = 0.1;
/** Dimensiones lógicas de referencia: toda la física está calibrada aquí. */
export const BASE_W = 800;
export const BASE_H = 600;
