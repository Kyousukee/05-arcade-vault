// ===== constants.ts — tunables de Serpentina (Snake), diseñados para este vault =====
//
// Serpentina no viene de una fuente portada: no hay original al que ajustarse, solo el
// atlas de frutas. Aun así reusa el área lógica 800×600 de Asteroides y Bloque Buster,
// que es el 4:3 exacto del CRT: el canvas solo aplica un transform de escala y toda la
// lógica vive en este espacio. El grid nace de dividir esa área en celdas de 25 px.
/** Ancho del área lógica en px. LOGICAL_W / LOGICAL_H = 4/3, como el CRT. */
export const LOGICAL_W = 800;
/** Alto del área lógica en px. */
export const LOGICAL_H = 600;
/** Columnas del grid. LOGICAL_W / CELL = 32 exactas, sin resto. */
export const COLS = 32;
/** Filas del grid. LOGICAL_H / CELL = 24 exactas, sin resto. */
export const ROWS = 24;
/** Lado de una celda en px lógicos. */
export const CELL = 25;
/** Segmentos con los que arranca la serpiente. */
export const START_LENGTH = 3;
/** ms entre pasos en el nivel 1. Más alto = más lento. */
export const TICK_BASE = 140;
/** Suelo del intervalo de tick: la velocidad deja de subir aquí. */
export const TICK_MIN = 60;
/** ms que baja el tick por cada nivel ganado. */
export const TICK_STEP = 10;
/** Frutas necesarias para subir un nivel. */
export const FRUITS_PER_LEVEL = 5;
/** ms de parpadeo rojo de la serpiente tras la colisión, antes del overlay. */
export const DEATH_FLASH = 200;
/** ms de overlay GAME OVER en el canvas antes de abrir el modal del reproductor. */
export const GAME_OVER_DELAY = 1200;
/** Segundos entre emisiones de onState: ~10 Hz, para no re-renderizar React a 60 fps. */
export const STATE_INTERVAL = 0.1;
