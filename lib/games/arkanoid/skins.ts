// ===== skins.ts — paletas de Bloque Buster =====
//
// Bloque Buster no tiene paleta: bloques, paddle, pelota y explosiones salen de
// un único spritesheet PNG (`/games/bloque-buster/spritesheet-breakout.png`).
// No podemos añadir assets nuevos, así que la vía elegida es **tintado en
// canvas**: `sprites.ts` genera, una sola vez por skin, una copia offscreen de
// la hoja recoloreada con `globalCompositeOperation`. Aquí solo vive el color:
// el `tint` que consume ese pipeline y el chrome no-sprite (fondo, HUD,
// overlay, muros). El renderer no debe tener ni un literal de color.
import type { GameSkin, SkinId } from "../types";
import type { BlockColor } from "./levels";
/**
 * Colores destino del tintado de sprites. `null` en `clasico`: cuando no hay
 * tint el sprite se dibuja tal cual, sin pasar por el pipeline de tintado, y el
 * render es bit a bit el original.
 */
export interface SpriteTint {
  /** Color destino de cada familia de bloque. Manda también en su explosión. */
  blocks: Record<BlockColor, string>;
  /** Color destino del sprite del paddle. */
  paddle: string;
  /** Color destino del sprite de la pelota (también las vidas del HUD). */
  ball: string;
}
/** Paleta completa de Bloque Buster: tintado de sprites más chrome. */
export interface ArkanoidSkin extends GameSkin {
  /** Fondo del canvas completo. */
  background: string;
  /** Texto del HUD en canvas (Score y Nivel). */
  hudText: string;
  /** Velo oscuro del overlay de fin de partida. */
  overlayVeil: string;
  /** Mensaje centrado del overlay ("GAME OVER" / "¡COMPLETASTE EL JUEGO!"). */
  overlayTitle: string;
  /**
   * Marco de los tres muros que rebotan (izquierdo, superior y derecho).
   * `null` en `clasico`: el original no dibujaba ningún marco y añadirlo sería
   * una regresión visual.
   */
  wall: string | null;
  /** Recolorización de la hoja de sprites. `null` = sprite intacto. */
  tint: SpriteTint | null;
  /**
   * Intensidad del `shadowBlur` en px lógicos. 0 desactiva el glow por completo
   * (`clasico` y `retro` son planos, sin resplandor).
   */
  glow: number;
}
export const SKINS: Record<SkinId, ArkanoidSkin> = {
  // Copia literal del aspecto original: fondo negro, HUD y overlay blancos,
  // velo al 60 % y sprites sin tocar. Cambiar un solo hex —o activar el
  // tintado— sería una regresión visual.
  clasico: {
    id: "clasico",
    label: "CLÁSICO",
    background: "#000",
    hudText: "#fff",
    overlayVeil: "rgba(0, 0, 0, 0.6)",
    overlayTitle: "#fff",
    wall: null,
    tint: null,
    glow: 0,
  },
  // La paleta del vault: cian y magenta saturados con glow sobre casi-negro.
  neon: {
    id: "neon",
    label: "NEÓN",
    background: "#05050a",
    hudText: "#00f5ff",
    overlayVeil: "rgba(5, 5, 15, 0.72)",
    overlayTitle: "#ff006e",
    wall: "rgba(0, 245, 255, 0.35)",
    tint: {
      blocks: {
        red: "#ff006e",
        yellow: "#f5ff00",
        cyan: "#00f5ff",
        magenta: "#ff2fd0",
        hotpink: "#ff4fa3",
        green: "#00ff88",
        gray: "#7a5cff",
      },
      paddle: "#00f5ff",
      ball: "#f5ff00",
    },
    glow: 10,
  },
  // Monitor CRT de fósforo: ámbar en dos intensidades más verde de acento.
  // Sin glow: los fósforos viejos tiran a plano y algo lavado.
  retro: {
    id: "retro",
    label: "RETRO",
    background: "#160d02",
    hudText: "#ffb000",
    overlayVeil: "rgba(10, 6, 0, 0.72)",
    overlayTitle: "#ffb000",
    wall: "rgba(255, 176, 0, 0.25)",
    tint: {
      blocks: {
        red: "#ffb000",
        yellow: "#ffd166",
        cyan: "#33ff66",
        magenta: "#c07800",
        hotpink: "#ffb000",
        green: "#33ff66",
        gray: "#8a5a00",
      },
      paddle: "#ffb000",
      ball: "#ffd166",
    },
    glow: 0,
  },
};
/** Skin pedida, o `clasico` si el id llega ausente o no reconocido. */
export function resolveSkin(id?: SkinId): ArkanoidSkin {
  return (id && SKINS[id]) || SKINS.clasico;
}
/**
 * Enciende el resplandor de la skin antes de un trazo o un `drawImage`. En
 * `clasico` y `retro` (`glow: 0`) no toca el contexto: cero cambio respecto al
 * render original.
 */
export function pushGlow(c: CanvasRenderingContext2D, skin: ArkanoidSkin, color: string) {
  if (skin.glow <= 0) return;
  c.shadowColor = color;
  c.shadowBlur = skin.glow;
}
/** Apaga el resplandor: el canvas comparte contexto entre todas las capas. */
export function popGlow(c: CanvasRenderingContext2D) {
  c.shadowBlur = 0;
  c.shadowColor = "transparent";
}
