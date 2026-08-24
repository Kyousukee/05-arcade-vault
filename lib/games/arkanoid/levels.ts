// ===== levels.ts — los 5 patrones de bloques, portados de la fuente =====
//
// El original los generaba en una IIFE con tres arrays de color sueltos en el
// scope del módulo. Aquí cada patrón es una función pura exportada y LEVELS es
// el resultado de llamarlas: mismo dato, sin estado compartido.
import { BLOCK_COLS, BLOCK_ROWS } from "./constants";
export type BlockColor = "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";
/** Posición de un bloque en la rejilla, sin píxeles: el juego los convierte. */
export interface BlockDef {
  /** Columna, 0–9. */
  col: number;
  /** Fila, 0–5. */
  row: number;
  color: BlockColor;
}
export interface LevelDef {
  /** Multiplicador de BASE_BALL_VX / BASE_BALL_VY para este nivel. */
  speed: number;
  blocks: BlockDef[];
}
/** Color por fila del nivel 1. */
const ROW_COLORS_1: readonly BlockColor[] = [
  "red",
  "yellow",
  "cyan",
  "magenta",
  "hotpink",
  "green",
];
/** Color por fila del nivel 2. */
const ROW_COLORS_2: readonly BlockColor[] = [
  "gray",
  "cyan",
  "hotpink",
  "yellow",
  "magenta",
  "green",
];
/** Color por fila del nivel 4. */
const ROW_COLORS_4: readonly BlockColor[] = [
  "cyan",
  "magenta",
  "green",
  "yellow",
  "hotpink",
  "red",
];
/** Nivel 1 — parrilla completa: las 6 filas × 10 columnas. */
export function buildGrid(): BlockDef[] {
  const blocks: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      blocks.push({ col, row, color: ROW_COLORS_1[row] });
    }
  }
  return blocks;
}
/** Nivel 2 — pirámide invertida: cada fila se ensancha hacia abajo. */
export function buildPyramid(): BlockDef[] {
  const start = [4, 3, 2, 1, 0, 0];
  const end = [5, 6, 7, 8, 9, 9];
  const blocks: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = start[row]; col <= end[row]; col++) {
      blocks.push({ col, row, color: ROW_COLORS_2[row] });
    }
  }
  return blocks;
}
/** Nivel 3 — ajedrez: solo las casillas de paridad par, amarillas arriba. */
export function buildCheckerboard(): BlockDef[] {
  const blocks: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      if ((col + row) % 2 === 0) {
        blocks.push({ col, row, color: row < 3 ? "yellow" : "magenta" });
      }
    }
  }
  return blocks;
}
/** Nivel 4 — filas completas con huecos distintos en cada una. */
export function buildGappedRows(): BlockDef[] {
  const gaps = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const blocks: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      if (!gaps[row].includes(col)) {
        blocks.push({ col, row, color: ROW_COLORS_4[row] });
      }
    }
  }
  return blocks;
}
/** Nivel 5 — marco cian con una cruz rosa por dentro. */
export function buildFrameCross(): BlockDef[] {
  const blocks: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === BLOCK_COLS - 1 || row === 0 || row === BLOCK_ROWS - 1;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross) {
        blocks.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
      }
    }
  }
  return blocks;
}
/** Los 5 niveles con su multiplicador de velocidad, en orden de juego. */
export const LEVELS: LevelDef[] = [
  { speed: 1.0, blocks: buildGrid() },
  { speed: 1.1, blocks: buildPyramid() },
  { speed: 1.21, blocks: buildCheckerboard() },
  { speed: 1.33, blocks: buildGappedRows() },
  { speed: 1.46, blocks: buildFrameCross() },
];
