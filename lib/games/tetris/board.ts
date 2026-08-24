// ===== board.ts — lógica del tablero, sin estado de módulo =====
//
// Todas las funciones reciben el tablero y la pieza como parámetros: en la
// fuente eran globals (`board`, `current`), aquí no hay nada mutable a nivel de
// módulo, así que dos instancias del juego pueden coexistir sin interferirse.
import { COLS, PIECES, ROWS } from "./constants";
/** Celda: 0 = vacía; 1–8 = índice en COLORS de la pieza que la ocupa. */
export type Cell = number;
/** Tablero ROWS × COLS. */
export type Board = Cell[][];
export interface Piece {
  shape: Cell[][]; // matriz cuadrada, rotada in situ
  x: number; // columna de la esquina superior izquierda
  y: number; // fila de la esquina superior izquierda
}
/** Tablero vacío ROWS × COLS. */
export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(0));
}
/** Pieza al azar de las 8, centrada arriba. Sin 7-bag: como la fuente. */
export function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return { shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}
/** true si `shape` colocada en (ox, oy) sale del tablero o pisa una celda ocupada. */
export function collide(board: Board, shape: Cell[][], ox: number, oy: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}
/** Rotación horaria; devuelve una matriz nueva, no toca la original. */
export function rotateCW(shape: Cell[][]): Cell[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array<Cell>(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}
/** Fija la pieza en el tablero (lo muta). */
export function merge(board: Board, piece: Piece): void {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) board[piece.y + r][piece.x + c] = piece.shape[r][c];
    }
  }
}
/**
 * Elimina las filas completas (muta el tablero) y devuelve cuántas eliminó.
 * Tras cada `splice` + `unshift` la fila r pasa a contener lo que había encima,
 * así que hay que volver a examinarla (`r++` compensa el `r--` del bucle) o un
 * tetris contaría como una sola línea.
 */
export function clearLines(board: Board): number {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array<Cell>(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}
/** Fila en la que aterrizaría la pieza si cayera recto (para la ghost piece). */
export function ghostY(board: Board, piece: Piece): number {
  let gy = piece.y;
  while (!collide(board, piece.shape, piece.x, gy + 1)) gy++;
  return gy;
}
