// ===== constants.ts — tunables de Bloque Buster (Arkanoid), portados de la fuente =====
//
// A diferencia de Caída, aquí no se recalibra nada: el original ya trabajaba en un
// canvas de 800×600, que es exactamente el 4:3 del CRT. Toda la geometría y la
// física viven en ese espacio lógico y el canvas solo aplica un transform de
// escala, así que estos valores son los de la fuente sin tocar.
/** Ancho del área lógica en px. Coincide con el canvas del original. */
export const LOGICAL_W = 800;
/** Alto del área lógica en px. LOGICAL_W / LOGICAL_H = 4/3, como el CRT. */
export const LOGICAL_H = 600;
/** Velocidad del paddle con teclado, en px lógicos/segundo. */
export const PADDLE_SPEED = 400;
/** Columnas de la rejilla de bloques. */
export const BLOCK_COLS = 10;
/** Filas de la rejilla de bloques. */
export const BLOCK_ROWS = 6;
/** Ancho de un bloque en px lógicos. */
export const BLOCK_W = 64;
/** Alto de un bloque en px lógicos. */
export const BLOCK_H = 24;
/** Margen izquierdo de la rejilla: la deja centrada en el área lógica. */
export const BLOCKS_ORIGIN_X = (LOGICAL_W - BLOCK_COLS * BLOCK_W) / 2;
/** Margen superior de la rejilla, bajo el HUD en canvas. */
export const BLOCKS_ORIGIN_Y = 80;
/** Velocidad horizontal de la pelota en el nivel 1, en px lógicos/segundo. */
export const BASE_BALL_VX = 200;
/** Velocidad vertical de la pelota en el nivel 1. Negativa: sale hacia arriba. */
export const BASE_BALL_VY = -300;
/** Posición y tamaño inicial del paddle. La `x` se calcula al centrarlo. */
export const PADDLE_INIT = { y: 560, w: 81, h: 14 } as const;
/** Lado de la pelota en px lógicos. El sprite es cuadrado. */
export const BALL_SIZE = 16;
/** Vidas con las que arranca una partida. */
export const START_LIVES = 3;
/** Puntos por bloque roto. El score se acumula a través de los 5 niveles. */
export const POINTS_PER_BLOCK = 10;
/** Duración de la animación de explosión de un bloque, en ms (4 frames). */
export const EXPLOSION_DURATION = 150;
/** ms de overlay de fin en el canvas antes de abrir el modal del reproductor. */
export const GAME_OVER_DELAY = 1200;
/** Cadencia de publicación del estado al HUD React (~10 Hz), en segundos. */
export const STATE_INTERVAL = 0.1;
