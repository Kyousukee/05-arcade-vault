// ===== constants.ts — tunables de Caída (Tetris), portados de la fuente =====
//
// Todo en px de celda (`block`) o en milisegundos: a diferencia de Asteroides,
// que trabaja en segundos, aquí el reloj de caída del original es en ms.
/** Columnas del tablero. */
export const COLS = 10;
/** Filas del tablero. */
export const ROWS = 20;
/**
 * Los colores de las piezas ya no viven aquí: son parte de la skin activa y
 * están en `skins.ts` (`CaidaSkin.pieces`, mismo indexado por valor de celda,
 * con `null` en el índice 0). Este archivo solo guarda tunables sin color.
 */
/**
 * Las 8 piezas, con la matriz de la fuente. El índice 0 es `null` para que el
 * tipo de pieza coincida con su índice de color en COLORS.
 *
 * La pieza `N` (tuerca, anillo 3×3 con hueco) es propia de esta fuente y no del
 * Tetris estándar: se porta por fidelidad, aunque deje un hueco irrellenable.
 */
export const PIECES: readonly (readonly (readonly number[])[] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];
/** Puntos por número de líneas eliminadas de golpe, multiplicados por el nivel. */
export const LINE_SCORES = [0, 100, 300, 500, 800] as const;
/** Desplazamientos que se prueban al rotar pegado a una pared (wall kicks). */
export const KICKS = [0, -1, 1, -2, 2] as const;
/** ms entre bajadas en el nivel 1. */
export const DROP_BASE_MS = 1000;
/** ms que se restan al intervalo por cada nivel ganado. */
export const DROP_STEP_MS = 90;
/** Suelo del intervalo de bajada, por rápido que sea el nivel. */
export const DROP_MIN_MS = 100;
/** ms de overlay GAME OVER en el canvas antes de abrir el modal. */
export const GAME_OVER_DELAY = 1200;
/** Cadencia de publicación del estado al HUD React (~10 Hz), en ms. */
export const STATE_INTERVAL = 100;
