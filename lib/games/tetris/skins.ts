// ===== skins.ts — paletas de Caída (Tetris) =====
//
// Todo el color del juego vive aquí: los fills de las 8 piezas y también el
// chrome (fondo, rejilla, realce de celda, marco, panel NEXT y overlay de game
// over). El renderer no debe tener ni un literal de color; si lo tiene, la skin
// no cambia de verdad y `neon` y `retro` acaban pareciéndose.
import type { GameSkin, SkinId } from "../types";
/**
 * Paleta completa de Caída. `pieces` está indexado por el valor de la celda,
 * igual que el antiguo `COLORS`: el índice 0 es la celda vacía, de ahí el
 * `null` inicial.
 */
export interface CaidaSkin extends GameSkin {
  /** Fill de cada pieza, indexado por valor de celda (0 = vacía). */
  pieces: readonly (string | null)[];
  /** Fondo del canvas completo. */
  background: string;
  /** Líneas de la rejilla del tablero. */
  gridLine: string;
  /** Realce superior de cada celda, el brillo de la fuente original. */
  cellHighlight: string;
  /** Borde del tablero 10×20. */
  boardFrame: string;
  /** Rótulo "NEXT" del panel lateral. */
  panelLabel: string;
  /** Caja 4×4 del panel NEXT. */
  panelBox: string;
  /** Velo que oscurece el canvas al terminar la partida. */
  overlayVeil: string;
  /** Texto "GAME OVER". */
  overlayTitle: string;
  /** Línea de puntaje bajo el "GAME OVER". */
  overlayScore: string;
  /**
   * Intensidad del `shadowBlur`, como fracción del lado de celda. 0 desactiva
   * el glow por completo (`clasico` y `retro` son planos, sin resplandor).
   */
  glow: number;
}
export const SKINS: Record<SkinId, CaidaSkin> = {
  // Copia literal del aspecto original: los hex de COLORS y los rgba() que
  // estaban inline en game.ts. Cambiar uno solo sería una regresión visual.
  clasico: {
    id: "clasico",
    label: "CLÁSICO",
    pieces: [
      null,
      "#4dd0e1", // I - cian
      "#ffd54f", // O - amarillo
      "#ba68c8", // T - púrpura
      "#81c784", // S - verde
      "#e57373", // Z - rojo
      "#90caf9", // J - azul pálido
      "#ffb74d", // L - naranja
      "#9e9e9e", // N - tuerca (gris metálico)
    ],
    background: "#000",
    gridLine: "rgba(255,255,255,0.06)",
    cellHighlight: "rgba(255,255,255,0.12)",
    boardFrame: "rgba(255,255,255,0.22)",
    panelLabel: "rgba(255,255,255,0.6)",
    panelBox: "rgba(255,255,255,0.14)",
    overlayVeil: "rgba(0,0,0,0.6)",
    overlayTitle: "#fff",
    overlayScore: "rgba(255,255,255,0.65)",
    glow: 0,
  },
  // La paleta del vault: cian y magenta saturados con glow sobre casi-negro.
  neon: {
    id: "neon",
    label: "NEÓN",
    pieces: [
      null,
      "#00f5ff", // I - cian del vault
      "#f5ff00", // O - amarillo del vault
      "#ff006e", // T - magenta del vault
      "#00ff88", // S - verde del vault
      "#ff3d81", // Z - magenta claro
      "#4d7cff", // J - azul eléctrico
      "#ff9d00", // L - ámbar saturado
      "#b388ff", // N - violeta
    ],
    background: "#05050a",
    gridLine: "rgba(0,245,255,0.10)",
    cellHighlight: "rgba(255,255,255,0.32)",
    boardFrame: "rgba(0,245,255,0.55)",
    panelLabel: "#00f5ff",
    panelBox: "rgba(255,0,110,0.45)",
    overlayVeil: "rgba(5,5,10,0.72)",
    overlayTitle: "#ff006e",
    overlayScore: "#00f5ff",
    glow: 0.3,
  },
  // Monitor CRT de fósforo: ámbar en tres intensidades más verde de acento.
  // Sin glow: los fósforos viejos tiran a plano y algo lavado.
  retro: {
    id: "retro",
    label: "RETRO",
    pieces: [
      null,
      "#ffb000", // I - ámbar puro
      "#ffd166", // O - ámbar claro
      "#c07800", // T - ámbar oscuro
      "#33ff66", // S - verde fósforo
      "#1f9e45", // Z - verde fósforo oscuro
      "#8a5a00", // J - ámbar quemado
      "#ffe6b3", // L - ámbar pálido
      "#7a6a3d", // N - tuerca, ámbar apagado
    ],
    background: "#160d02",
    gridLine: "rgba(255,176,0,0.10)",
    cellHighlight: "rgba(255,232,180,0.22)",
    boardFrame: "rgba(255,176,0,0.45)",
    panelLabel: "#ffb000",
    panelBox: "rgba(255,176,0,0.25)",
    overlayVeil: "rgba(22,13,2,0.78)",
    overlayTitle: "#ffb000",
    overlayScore: "#33ff66",
    glow: 0,
  },
};
/** Skin pedida, o `clasico` si el id llega ausente o no reconocido. */
export function resolveSkin(id?: SkinId): CaidaSkin {
  return (id && SKINS[id]) || SKINS.clasico;
}
