// ===== constants.ts — tunables de Ranaria (Frogger), diseñados para este vault =====
//
// El spec fija la cuadrícula en 16 × 14 celdas de 40 px (640 × 560), pero el CRT del
// reproductor es 4:3 y todos los juegos del vault dibujan sobre el mismo espacio lógico
// 800 × 600 al que el canvas solo aplica un transform de escala. Estirar 640 × 560 a
// 4:3 deformaría las celdas —una rana ovalada—, así que el tablero se conserva a su
// tamaño exacto y se **centra** dentro del espacio lógico: 80 px de margen a cada lado
// y una banda de 40 px arriba para el HUD interno. 40 + 560 = 600 justos.
/** Ancho del área lógica en px. LOGICAL_W / LOGICAL_H = 4/3, como el CRT. */
export const LOGICAL_W = 800;
/** Alto del área lógica en px. */
export const LOGICAL_H = 600;
/** Columnas del tablero. */
export const COLS = 16;
/** Filas del tablero, índice 0 = arriba. */
export const ROWS = 14;
/** Lado de una celda en px lógicos. */
export const CELL = 40;
/** Ancho del tablero en px. */
export const BOARD_W = COLS * CELL;
/** Alto del tablero en px. */
export const BOARD_H = ROWS * CELL;
/** Alto de la banda de HUD interno, encima de la fila de bocas. */
export const HUD_H = 40;
/** Desplazamiento del tablero dentro del área lógica: centra los 640 px de ancho. */
export const OFFSET_X = (LOGICAL_W - BOARD_W) / 2;
/** El tablero arranca justo bajo la banda de HUD. HUD_H + BOARD_H = LOGICAL_H. */
export const OFFSET_Y = HUD_H;
// ── Zonas del mapa (índices de fila) ────────────────────────────────────────
/** Fila de las 5 bocas destino. */
export const ROW_GOALS = 0;
/** Primera fila de río (la de más arriba, pegada a las bocas). */
export const ROW_RIVER_TOP = 1;
/** Última fila de río. */
export const ROW_RIVER_BOT = 6;
/** Franja segura intermedia entre río y carretera. */
export const ROW_SAFE_MID = 7;
/** Primera fila de carretera (la más cercana a la franja segura). */
export const ROW_ROAD_TOP = 8;
/** Última fila de carretera. */
export const ROW_ROAD_BOT = 12;
/** Fila segura inferior: donde nace la rana y adonde vuelve tras cada muerte. */
export const ROW_START = 13;
// ── Bocas destino ───────────────────────────────────────────────────────────
/** Bocas que hay que llenar para completar una ronda. */
export const GOAL_COUNT = 5;
/** Columnas que ocupa cada boca. */
export const GOAL_WIDTH = 2;
/** Columna donde empieza la primera boca; la columna 0 es separador. */
export const GOAL_FIRST_COL = 1;
/**
 * Distancia entre los inicios de dos bocas consecutivas: 2 de boca + 1 de separador.
 * GOAL_FIRST_COL + GOAL_STRIDE * (GOAL_COUNT - 1) + GOAL_WIDTH = 15, así que la
 * columna 15 queda de separador derecho igual que la 0 lo es del izquierdo.
 */
export const GOAL_STRIDE = GOAL_WIDTH + 1;
// ── Rana ────────────────────────────────────────────────────────────────────
/** Vidas con las que arranca la partida. */
export const START_LIVES = 3;
/** ms que dura la animación de un salto de una celda. */
export const HOP_MS = 120;
/** Columna en la que nace la rana: centro exacto de las 16. */
export const START_COL = COLS / 2 - 1;
// ── Temporizador de ronda ───────────────────────────────────────────────────
/** Segundos de la ronda en el nivel 1. */
export const ROUND_TIME_BASE = 15;
/** Segundos que se recortan por cada nivel ganado. */
export const ROUND_TIME_STEP = 1;
/** Suelo del temporizador: la ronda deja de acortarse aquí. */
export const ROUND_TIME_MIN = 8;
// ── Velocidad ───────────────────────────────────────────────────────────────
/**
 * El spec expresa las velocidades en px/frame a 60 fps; el loop trabaja con `dt` en
 * segundos y posiciones en celdas, así que se convierten: px/frame × 60 / CELL.
 */
export const PX_FRAME_TO_CELLS_S = 60 / CELL;
/** Fracción que suben todas las velocidades por cada nivel: +15 % acumulado. */
export const LEVEL_SPEED_STEP = 0.15;
// ── Tortugas ────────────────────────────────────────────────────────────────
/** ms que un grupo de tortugas permanece a flote (sirve de apoyo). */
export const TURTLE_VISIBLE_MS = 3000;
/** ms que un grupo permanece sumergido (no sirve de apoyo: la rana se ahoga). */
export const TURTLE_SUBMERGED_MS = 1500;
/** Duración del ciclo completo de inmersión. */
export const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;
// ── Puntuación ──────────────────────────────────────────────────────────────
/** Puntos por cada fila nueva alcanzada hacia arriba, la primera vez en la ronda. */
export const POINTS_FORWARD = 10;
/** Puntos por ocupar una boca destino. */
export const POINTS_GOAL = 50;
/** Puntos por completar una ronda (las 5 bocas). */
export const POINTS_ROUND = 200;
/** Multiplicador del bonus de tiempo al ocupar una boca: segundos restantes × esto. */
export const TIME_BONUS_PER_SECOND = 10;
// ── Fin de partida ──────────────────────────────────────────────────────────
/** ms de parpadeo de la rana tras morir, antes de reaparecer o de cerrar la partida. */
export const DEATH_FLASH = 500;
/** ms de cada mitad del parpadeo: con DEATH_FLASH = 500 salen ~3 destellos. */
export const FLASH_BLINK = 80;
/** ms de overlay GAME OVER en el canvas antes de abrir el modal del reproductor. */
export const GAME_OVER_DELAY = 1200;
/** Segundos entre emisiones de onState: ~10 Hz, para no re-renderizar React a 60 fps. */
export const STATE_INTERVAL = 0.1;
