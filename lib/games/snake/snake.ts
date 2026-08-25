// ===== snake.ts — la serpiente: celdas, avance, colisiones y dibujo =====
//
// El atlas solo trae frutas: no hay sprites de cabeza, cuerpo ni cola, así que la
// serpiente se dibuja con formas en el verde de la paleta del vault. Aquí no vive ningún
// estado de módulo: todas las funciones reciben el `body` de su instancia y lo devuelven
// o lo mutan, de modo que dos partidas simultáneas no comparten nada.
import { CELL, COLS, ROWS, START_LENGTH } from "./constants";
export type Dir = "up" | "down" | "left" | "right";
export interface Cell {
  /** Columna, 0–31. */
  col: number;
  /** Fila, 0–23. */
  row: number;
}
/** Desplazamiento en celdas de cada dirección. */
export const DIR_VECTORS: Record<Dir, Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};
/** Dirección contraria: un giro hacia ella se ignora (sería suicidio inmediato). */
export const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
/** Verde de la paleta (--green). El canvas no lee variables CSS, así que va literal. */
const SNAKE_GREEN = "#00ff88";
/** Cabeza: el mismo verde aclarado, para distinguirla de un vistazo. */
const SNAKE_HEAD = "#b6ffe0";
/** Rojo del parpadeo de muerte. */
const SNAKE_DEAD = "#ff2e4d";
/**
 * Serpiente inicial: START_LENGTH celdas horizontales centradas en el grid, con la cabeza
 * en el índice 0 y el cuerpo extendiéndose hacia la izquierda, mirando a la derecha.
 */
export function createSnakeBody(): Cell[] {
  const row = Math.floor(ROWS / 2);
  const headCol = Math.floor(COLS / 2) - 1;
  const body: Cell[] = [];
  for (let i = 0; i < START_LENGTH; i++) {
    body.push({ col: headCol - i, row });
  }
  return body;
}
/**
 * Avanza un paso: mete una cabeza nueva en `dir` y quita la cola, salvo que `grow` sea
 * true (acaba de comer), en cuyo caso la serpiente gana una celda de largo.
 */
export function stepSnake(body: Cell[], dir: Dir, grow: boolean): void {
  const head = body[0];
  const v = DIR_VECTORS[dir];
  body.unshift({ col: head.col + v.col, row: head.row + v.row });
  if (!grow) body.pop();
}
/** true si la cabeza se ha salido del grid. No hay wrap: la pared mata. */
export function hitsWall(body: Cell[]): boolean {
  const head = body[0];
  return head.col < 0 || head.col >= COLS || head.row < 0 || head.row >= ROWS;
}
/** true si la cabeza cae sobre alguna celda del propio cuerpo. */
export function hitsSelf(body: Cell[]): boolean {
  const head = body[0];
  for (let i = 1; i < body.length; i++) {
    if (body[i].col === head.col && body[i].row === head.row) return true;
  }
  return false;
}
/** true si la serpiente ocupa esa celda. Lo usa el spawn de fruta para no taparla. */
export function occupies(body: Cell[], cell: Cell): boolean {
  return body.some((c) => c.col === cell.col && c.row === cell.row);
}
/** Rectángulo redondeado en coordenadas lógicas. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
/** Ojos de la cabeza, colocados según hacia dónde mira. */
function drawEyes(ctx: CanvasRenderingContext2D, head: Cell, dir: Dir): void {
  const cx = head.col * CELL + CELL / 2;
  const cy = head.row * CELL + CELL / 2;
  const off = CELL * 0.18;
  const fwd = CELL * 0.16;
  const v = DIR_VECTORS[dir];
  // Los ojos se separan en el eje perpendicular al avance y se adelantan en el paralelo.
  const px = v.row;
  const py = v.col;
  ctx.fillStyle = "#0a0a0f";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      cx + v.col * fwd + px * off * s,
      cy + v.row * fwd + py * off * s,
      CELL * 0.09,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}
/**
 * Dibuja la serpiente en el espacio lógico. Cada celda es un cuadrado redondeado con un
 * poco de aire alrededor; la cabeza va más clara y con ojos, y el cuerpo se apaga
 * progresivamente hacia la cola. Con `flashing` toda la serpiente se pinta en rojo: es el
 * parpadeo de los ~200 ms que siguen a la colisión.
 */
export function drawSnake(
  ctx: CanvasRenderingContext2D,
  body: Cell[],
  dir: Dir,
  flashing: boolean,
): void {
  const pad = CELL * 0.08;
  const size = CELL - pad * 2;
  const radius = CELL * 0.28;
  ctx.save();
  ctx.shadowColor = flashing ? SNAKE_DEAD : SNAKE_GREEN;
  ctx.shadowBlur = 10;
  for (let i = body.length - 1; i >= 0; i--) {
    const cell = body[i];
    if (flashing) {
      ctx.fillStyle = SNAKE_DEAD;
    } else if (i === 0) {
      ctx.fillStyle = SNAKE_HEAD;
    } else {
      // Degradado hacia la cola: de opaco a translúcido, sin llegar a desaparecer.
      const t = i / Math.max(1, body.length - 1);
      ctx.fillStyle = `rgba(0, 255, 136, ${(1 - t * 0.55).toFixed(3)})`;
    }
    roundedRect(ctx, cell.col * CELL + pad, cell.row * CELL + pad, size, size, radius);
    ctx.fill();
  }
  ctx.restore();
  if (body.length > 0) drawEyes(ctx, body[0], dir);
}
