// ===== sprites.ts — recortes del spritesheet y su carga por instancia =====
//
// El original guardaba la hoja en tres globals de módulo (ssImg, ssLoaded,
// ssCallbacks): justo el patrón que impide que dos instancias del juego
// coexistan y que duplica trabajo bajo React Strict Mode. Aquí loadSpritesheet()
// devuelve una Promise y cada instancia se queda con su propia hoja; el PNG lo
// sirve el caché HTTP del navegador a partir de la segunda carga.
import type { BlockColor } from "./levels";
/** Recorte rectangular dentro del spritesheet, en px de la hoja. */
export interface Frame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}
/** Ruta pública del spritesheet, servida desde public/. */
const SPRITESHEET_SRC = "/games/bloque-buster/spritesheet-breakout.png";
export const SPRITES: {
  paddle: Frame;
  ball: Frame;
  blocks: Record<BlockColor, Frame>;
} = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};
/** Los 4 frames de la explosión de cada color. `gray` reusa los de `red`. */
export const EXPLOSION_FRAMES: Record<BlockColor, [Frame, Frame, Frame, Frame]> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176),
};
/** Los 4 frames de una fila de explosión: mismo `sy`, `sx` cada 32 px. */
function explosionRow(sy: number): [Frame, Frame, Frame, Frame] {
  return [
    { sx: 256, sy, sw: 32, sh: 16 },
    { sx: 288, sy, sw: 32, sh: 16 },
    { sx: 320, sy, sw: 32, sh: 16 },
    { sx: 352, sy, sw: 32, sh: 16 },
  ];
}
/**
 * Carga el spritesheet y lo vuelca a un canvas offscreen, como la fuente: dibujar
 * desde un canvas evita que el navegador vuelva a decodificar el PNG en cada
 * drawImage. Sin caché de módulo — cada instancia carga la suya.
 */
export function loadSpritesheet(): Promise<CanvasImageSource> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const offscreen = document.createElement("canvas");
      offscreen.width = img.width;
      offscreen.height = img.height;
      const octx = offscreen.getContext("2d");
      if (!octx) {
        reject(new Error("No se pudo obtener el contexto 2D del canvas offscreen"));
        return;
      }
      octx.drawImage(img, 0, 0);
      resolve(offscreen);
    };
    img.onerror = () => reject(new Error(`No se pudo cargar el spritesheet: ${SPRITESHEET_SRC}`));
    img.src = SPRITESHEET_SRC;
  });
}
/** Dibuja un recorte concreto. La hoja llega por parámetro, no de un global. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  frame: Frame,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.drawImage(sheet, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}
/** Dibuja el sprite del paddle o de la pelota. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  name: "paddle" | "ball",
  x: number,
  y: number,
  w: number,
  h: number,
) {
  drawFrame(ctx, sheet, SPRITES[name], x, y, w, h);
}
/** Dibuja el sprite de un bloque del color dado. */
export function drawBlockSprite(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  color: BlockColor,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  drawFrame(ctx, sheet, SPRITES.blocks[color], x, y, w, h);
}
