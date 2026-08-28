// ===== sprites.ts — recortes del spritesheet, su carga y su tintado por skin =====
//
// El original guardaba la hoja en tres globals de módulo (ssImg, ssLoaded,
// ssCallbacks): justo el patrón que impide que dos instancias del juego
// coexistan y que duplica trabajo bajo React Strict Mode. Aquí loadSpritesheet()
// devuelve una Promise y cada instancia se queda con su propia hoja; el PNG lo
// sirve el caché HTTP del navegador a partir de la segunda carga.
//
// Como el color del juego está horneado en el PNG y no podemos añadir assets
// nuevos, las skins se aplican **tintando en canvas**: buildTintedSheet()
// produce una copia offscreen de la hoja entera con los sprites recoloreados.
// Se genera una vez por skin y se cachea; nunca por frame.
import type { BlockColor } from "./levels";
import type { SpriteTint } from "./skins";
/** Recorte rectangular dentro del spritesheet, en px de la hoja. */
export interface Frame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}
/**
 * La hoja de sprites ya volcada a un canvas. Es HTMLCanvasElement y no un
 * CanvasImageSource genérico porque el tintado necesita leer `width`/`height`.
 */
export type Spritesheet = HTMLCanvasElement;
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
export function loadSpritesheet(): Promise<Spritesheet> {
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
// ── Tintado por skin ────────────────────────────────────────────────────────
/**
 * Hoja lista para dibujar con una skin concreta. En `clasico` es la hoja
 * original sin tocar (`grayExplosion: null`) y el render es el de siempre.
 */
export interface SkinnedSheet {
  /** Hoja completa, tintada o no, con la geometría de SPRITES intacta. */
  sheet: Spritesheet;
  /**
   * Tira de 4 frames (128×16) con la explosión de `gray` tintada aparte: en la
   * hoja comparte fila con `red`, así que dentro de la copia solo cabe uno de
   * los dos tintes. `null` cuando no hay tintado.
   */
  grayExplosion: Spritesheet | null;
}
/** Alfa del refuerzo de tinte sobre los píxeles casi blancos del sprite. */
const TINT_OVERLAY_ALPHA = 0.22;
/** Ancho de la tira de explosión: 4 frames de 32 px. */
const EXPLOSION_STRIP_W = 128;
/**
 * Recolorea un recorte y lo pega en `dst`. Tres pasadas: `color` aplica tono y
 * saturación conservando la luminosidad (el biselado del sprite sobrevive),
 * `destination-in` restaura la máscara alfa que esa pasada había rellenado, y
 * un `source-atop` tenue arrastra hacia el tinte los píxeles casi blancos, que
 * el modo `color` deja intactos por tener luminosidad máxima.
 */
function tintFrameInto(
  dst: CanvasRenderingContext2D,
  base: Spritesheet,
  frame: Frame,
  color: string,
  dx: number,
  dy: number,
) {
  const temp = document.createElement("canvas");
  temp.width = frame.sw;
  temp.height = frame.sh;
  const tctx = temp.getContext("2d");
  if (!tctx) return;
  tctx.drawImage(base, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, frame.sw, frame.sh);
  tctx.globalCompositeOperation = "color";
  tctx.fillStyle = color;
  tctx.fillRect(0, 0, frame.sw, frame.sh);
  tctx.globalCompositeOperation = "destination-in";
  tctx.drawImage(base, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, frame.sw, frame.sh);
  tctx.globalCompositeOperation = "source-atop";
  tctx.globalAlpha = TINT_OVERLAY_ALPHA;
  tctx.fillStyle = color;
  tctx.fillRect(0, 0, frame.sw, frame.sh);
  dst.clearRect(dx, dy, frame.sw, frame.sh);
  dst.drawImage(temp, dx, dy);
}
/**
 * Genera la copia tintada de la hoja para una skin. Se llama una sola vez por
 * skin (el runtime la cachea): tintar por frame costaría decenas de canvas
 * intermedios cada 16 ms.
 */
export function buildTintedSheet(base: Spritesheet, tint: SpriteTint): SkinnedSheet {
  const sheet = document.createElement("canvas");
  sheet.width = base.width;
  sheet.height = base.height;
  const sctx = sheet.getContext("2d");
  if (!sctx) return { sheet: base, grayExplosion: null };
  sctx.drawImage(base, 0, 0);
  tintFrameInto(sctx, base, SPRITES.paddle, tint.paddle, SPRITES.paddle.sx, SPRITES.paddle.sy);
  tintFrameInto(sctx, base, SPRITES.ball, tint.ball, SPRITES.ball.sx, SPRITES.ball.sy);
  for (const key of Object.keys(SPRITES.blocks) as BlockColor[]) {
    const frame = SPRITES.blocks[key];
    tintFrameInto(sctx, base, frame, tint.blocks[key], frame.sx, frame.sy);
    // `gray` comparte la fila de explosión con `red`: se tinta aparte, abajo.
    if (key === "gray") continue;
    for (const exp of EXPLOSION_FRAMES[key]) {
      tintFrameInto(sctx, base, exp, tint.blocks[key], exp.sx, exp.sy);
    }
  }
  return { sheet, grayExplosion: buildGrayExplosion(base, tint.blocks.gray) };
}
/** Tira aparte con la explosión de `gray`, tintada con su propio color. */
function buildGrayExplosion(base: Spritesheet, color: string): Spritesheet | null {
  const strip = document.createElement("canvas");
  strip.width = EXPLOSION_STRIP_W;
  strip.height = SPRITES.blocks.gray.sh;
  const gctx = strip.getContext("2d");
  if (!gctx) return null;
  EXPLOSION_FRAMES.gray.forEach((frame, i) => tintFrameInto(gctx, base, frame, color, i * 32, 0));
  return strip;
}
// ── Dibujo ──────────────────────────────────────────────────────────────────
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
  skinned: SkinnedSheet,
  name: "paddle" | "ball",
  x: number,
  y: number,
  w: number,
  h: number,
) {
  drawFrame(ctx, skinned.sheet, SPRITES[name], x, y, w, h);
}
/** Dibuja el sprite de un bloque del color dado. */
export function drawBlockSprite(
  ctx: CanvasRenderingContext2D,
  skinned: SkinnedSheet,
  color: BlockColor,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  drawFrame(ctx, skinned.sheet, SPRITES.blocks[color], x, y, w, h);
}
/**
 * Dibuja el frame `index` (0–3) de la explosión de un bloque. `gray` sale de la
 * tira aparte cuando hay tintado, para no heredar el tinte de `red`.
 */
export function drawExplosionFrame(
  ctx: CanvasRenderingContext2D,
  skinned: SkinnedSheet,
  color: BlockColor,
  index: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const source = EXPLOSION_FRAMES[color][index];
  if (color === "gray" && skinned.grayExplosion) {
    const { sw, sh } = source;
    drawFrame(ctx, skinned.grayExplosion, { sx: index * sw, sy: 0, sw, sh }, x, y, w, h);
    return;
  }
  drawFrame(ctx, skinned.sheet, source, x, y, w, h);
}
