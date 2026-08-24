// ===== constants.ts — tunables de Caída (Tetris), portados de la fuente =====
//
// Todo en px de celda (`block`) o en milisegundos: a diferencia de Asteroides,
// que trabaja en segundos, aquí el reloj de caída del original es en ms.
/** Columnas del tablero. */
export const COLS = 10;
/** Filas del tablero. */
export const ROWS = 20;
/**
 * Color de cada pieza, indexado por el valor de la celda. El índice 0 es la
 * celda vacía, de ahí el `null` inicial: el valor de la celda es el índice.
 */
export const COLORS: readonly (string | null)[] = [
  null,
  "#4dd0e1", // I - cian
  "#ffd54f", // O - amarillo
  "#ba68c8", // T - púrpura
  "#81c784", // S - verde
  "#e57373", // Z - rojo
  "#90caf9", // J - azul pálido
  "#ffb74d", // L - naranja
  "#9e9e9e", // N - tuerca (gris metálico)
];
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
/**
 * Color de la rejilla. En la fuente se leía de la CSS var `--grid-line` con
 * getComputedStyle; esa var no existe en app/globals.css y la lógica del juego
 * no debe tocar el DOM, así que es una constante.
 */
export const GRID_LINE_COLOR = "rgba(255,255,255,0.06)";
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
