// ===== skins.ts — paletas de Serpentina =====
//
// Todo el color del juego vive aquí. Antes estaba repartido entre `game.ts`
// (fondo del tablero, damero y overlay de fin) y `snake.ts` (cuerpo, cabeza,
// ojos y parpadeo de muerte). El renderer no debe tener ni un literal de color;
// si lo tiene, la skin no cambia de verdad y `neon` y `retro` acaban
// pareciéndose.
//
// Excepción declarada: los colores de `sprites.ts` NO son tokens de skin, son
// metadatos del atlas `fruits.png` (el color propio de cada fruta, que es lo
// que la identifica y delata su tramo de puntos). Las frutas no se tiñen; la
// skin solo las rodea de halo y decide el círculo de reserva si el PNG falla.
import type { GameSkin, SkinId } from "../types";
/** Paleta completa de Serpentina: tablero, serpiente y chrome. */
export interface SerpentinaSkin extends GameSkin {
  /** Fondo liso del tablero. */
  background: string;
  /** Celdas del damero, apenas más claras que el fondo. */
  boardCellAlt: string;
  /**
   * Componentes RGB del cuerpo, como `"r, g, b"` (con los espacios del
   * original). Van sueltos porque el cuerpo se desvanece hacia la cola: el alfa
   * lo pone el renderer segmento a segmento con `snakeBodyFill()`.
   */
  snakeBodyRgb: string;
  /** Cabeza: la misma familia aclarada, para distinguirla de un vistazo. */
  snakeHead: string;
  /** Cuerpo entero durante el parpadeo de muerte. */
  snakeDead: string;
  /** Pupilas de la cabeza. Va oscuro, del color del fondo. */
  snakeEye: string;
  /** Color del resplandor bajo la serpiente viva. */
  snakeAura: string;
  /**
   * `shadowBlur` en px lógicos bajo la serpiente. Ojo: en Serpentina el glow es
   * parte del aspecto original (`clasico` lo tiene a 10, no a 0), así que aquí
   * 0 es una decisión de `retro` —fósforo plano—, no el estado neutro.
   */
  snakeGlow: number;
  /**
   * Halo tras el sprite de la fruta, en px lógicos. 0 lo desactiva y el
   * `drawImage` queda idéntico al original.
   */
  fruitGlow: number;
  /** Color del halo de la fruta. Solo se usa si `fruitGlow > 0`. */
  fruitAura: string;
  /**
   * Círculo de reserva cuando `fruits.png` no carga. `null` significa "usa el
   * color propio de la fruta en el atlas", que es el comportamiento original y
   * por eso es lo que trae `clasico`.
   */
  fruitFallback: string | null;
  /** Velo que oscurece el tablero bajo el "GAME OVER". */
  overlayVeil: string;
  /** Texto "GAME OVER". */
  overlayTitle: string;
}
export const SKINS: Record<SkinId, SerpentinaSkin> = {
  // Copia literal del aspecto original: serpiente verde --green sobre tablero
  // casi negro en damero. Cambiar un solo hex sería una regresión visual.
  clasico: {
    id: "clasico",
    label: "CLÁSICO",
    background: "#080810",
    boardCellAlt: "#0d0d18",
    snakeBodyRgb: "0, 255, 136",
    snakeHead: "#b6ffe0",
    snakeDead: "#ff2e4d",
    snakeEye: "#0a0a0f",
    snakeAura: "#00ff88",
    snakeGlow: 10,
    fruitGlow: 0,
    fruitAura: "#00ff88",
    fruitFallback: null,
    overlayVeil: "rgba(0, 0, 0, 0.6)",
    overlayTitle: "#fff",
  },
  // La paleta del vault: cian y magenta saturados con glow sobre casi-negro. El
  // damero se tiñe de violeta para que el tablero no quede muerto bajo el cian.
  neon: {
    id: "neon",
    label: "NEÓN",
    background: "#05050a",
    boardCellAlt: "#100a24",
    snakeBodyRgb: "0, 245, 255",
    snakeHead: "#d6faff",
    snakeDead: "#ff006e",
    snakeEye: "#05050a",
    snakeAura: "#00f5ff",
    snakeGlow: 18,
    fruitGlow: 14,
    fruitAura: "#f5ff00",
    fruitFallback: "#f5ff00",
    overlayVeil: "rgba(8, 0, 20, 0.66)",
    overlayTitle: "#ff006e",
  },
  // Monitor CRT de fósforo: ámbar en tres intensidades más verde de acento.
  // Sin glow, ni en la serpiente ni en la fruta: los fósforos viejos tiran a
  // plano y algo lavado.
  retro: {
    id: "retro",
    label: "RETRO",
    background: "#120a01",
    boardCellAlt: "#1c1004",
    snakeBodyRgb: "255, 176, 0",
    snakeHead: "#ffe6b3",
    snakeDead: "#ff3b00",
    snakeEye: "#120a01",
    snakeAura: "#ffb000",
    snakeGlow: 0,
    fruitGlow: 0,
    fruitAura: "#33ff66",
    fruitFallback: "#33ff66",
    overlayVeil: "rgba(18, 10, 1, 0.72)",
    overlayTitle: "#ffb000",
  },
};
/**
 * Relleno de un segmento del cuerpo con el alfa de su desvanecimiento hacia la
 * cola. El formato reproduce el del original, espacios incluidos.
 */
export function snakeBodyFill(skin: SerpentinaSkin, alpha: number): string {
  return `rgba(${skin.snakeBodyRgb}, ${alpha.toFixed(3)})`;
}
/** Skin pedida, o `clasico` si el id llega ausente o no reconocido. */
export function resolveSkin(id?: SkinId): SerpentinaSkin {
  return (id && SKINS[id]) || SKINS.clasico;
}
