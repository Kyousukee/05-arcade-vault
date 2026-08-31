// ===== skins.ts — paletas de Ranaria =====
//
// Todo el color del juego vive aquí. `sprites.ts` ya dibujaba recibiendo la paleta por
// parámetro, así que las skins no tocan ni una línea de dibujo: solo cambian el objeto
// que se les pasa. `RanariaPalette` y `CLASSIC_PALETTE` vivían en `sprites.ts` y se han
// movido a este archivo para seguir la convención de los otros juegos (todo el color en
// `skins.ts`, cero literales en el renderer).
//
// Ranaria no usa imágenes ni spritesheets: es todo rectángulos, arcos y elipses, así que
// no hay ninguna limitación — cada píxel de color cambia con la skin, chrome incluido.
import type { GameSkin, SkinId } from "../types";
/**
 * Tokens de color de Ranaria. Es la forma que reciben las funciones de dibujo de
 * `sprites.ts`; una `RanariaSkin` es una paleta con id y rótulo.
 */
export interface RanariaPalette {
  /** Fondo del área lógica, fuera del tablero. */
  background: string;
  /** Banda del HUD interno. */
  hudBg: string;
  hudText: string;
  hudDim: string;
  /** Franja de asfalto. */
  roadBg: string;
  /** Línea discontinua entre carriles de carretera. */
  roadMark: string;
  /** Agua. */
  riverBg: string;
  /** Reflejo tenue sobre el agua. */
  riverShine: string;
  /** Franjas seguras (inicio y mediana). */
  safeBg: string;
  /** Bordillo que separa las zonas. */
  curb: string;
  /** Fondo de la fila de bocas: el seto entre boca y boca. */
  goalRowBg: string;
  /** Interior de una boca libre. */
  goalBg: string;
  goalBorder: string;
  /** Silueta de la rana ya colocada en una boca. */
  goalFilled: string;
  /** Carrocerías de los coches; se elige por `variant`. */
  carBodies: string[];
  carGlass: string;
  wheel: string;
  truckBody: string;
  truckCab: string;
  logBody: string;
  logGrain: string;
  turtleShell: string;
  turtleShellDark: string;
  /** Contorno de un grupo sumergido: se ve, pero no sostiene. */
  turtleSubmerged: string;
  frogBody: string;
  frogBelly: string;
  frogEye: string;
  frogPupil: string;
  /** Color de la rana durante el parpadeo de muerte. */
  frogDead: string;
  /** Barra de tiempo, de sobrado a agotándose. */
  timeGood: string;
  timeWarn: string;
  timeBad: string;
  overlayVeil: string;
  overlayTitle: string;
}
/**
 * Skin completa: la paleta más la identidad (`id`, `label`) y el halo. El halo no es un
 * token de paleta porque las funciones de dibujo no lo leen: lo aplica `game.ts` sobre la
 * capa de entidades y rana, así que `sprites.ts` sigue intacto.
 */
export interface RanariaSkin extends GameSkin, RanariaPalette {
  /**
   * `shadowBlur` en px lógicos bajo entidades y rana. 0 lo desactiva y el render queda
   * byte a byte igual al original: es lo que traen `clasico` y `retro`.
   */
  glow: number;
  /** Color del halo. Solo se usa si `glow > 0`. */
  glowColor: string;
}
export const SKINS: Record<SkinId, RanariaSkin> = {
  // Copia literal del aspecto original (la antigua CLASSIC_PALETTE de sprites.ts):
  // asfalto gris, río azul noche, mediana verde y rana --green. Cambiar un solo hex
  // sería una regresión visual.
  clasico: {
    id: "clasico",
    label: "CLÁSICO",
    background: "#0a0a18",
    hudBg: "#05050c",
    hudText: "#e8f8ec",
    hudDim: "#5c7a66",
    roadBg: "#1b1b22",
    roadMark: "#4a4a55",
    riverBg: "#0d2b52",
    riverShine: "#154a7a",
    safeBg: "#123d1e",
    curb: "#2f2f3a",
    goalRowBg: "#0d3316",
    goalBg: "#061b0c",
    goalBorder: "#c8a13a",
    goalFilled: "#3ddc6b",
    carBodies: ["#ff3b30", "#ffd60a", "#4aa3ff", "#ff8a3d"],
    carGlass: "#0b1622",
    wheel: "#15151a",
    truckBody: "#b9bec7",
    truckCab: "#6d7480",
    logBody: "#7a4a24",
    logGrain: "#5a3418",
    turtleShell: "#2fa14f",
    turtleShellDark: "#1d6b35",
    turtleSubmerged: "rgba(70, 190, 120, 0.28)",
    frogBody: "#3ddc6b",
    frogBelly: "#a8f5c0",
    frogEye: "#ffffff",
    frogPupil: "#0a0a18",
    frogDead: "#ff3b30",
    timeGood: "#3ddc6b",
    timeWarn: "#ffd60a",
    timeBad: "#ff3b30",
    overlayVeil: "rgba(5, 5, 12, 0.78)",
    overlayTitle: "#3ddc6b",
    glow: 0,
    glowColor: "#3ddc6b",
  },
  // La paleta del vault: cian y magenta saturados con halo sobre casi-negro. El asfalto y
  // el agua se apagan casi a negro para que el tráfico cian/magenta sea lo único que
  // brilla; los troncos van violeta para no competir con la rana verde.
  neon: {
    id: "neon",
    label: "NEÓN",
    background: "#05050a",
    hudBg: "#08000f",
    hudText: "#e6e9ff",
    hudDim: "#8a4fd0",
    roadBg: "#0c0c18",
    roadMark: "#ff006e",
    riverBg: "#06122b",
    riverShine: "#00f5ff",
    safeBg: "#150435",
    curb: "#2a0f5c",
    goalRowBg: "#12002a",
    goalBg: "#05000c",
    goalBorder: "#f5ff00",
    goalFilled: "#00f5ff",
    carBodies: ["#ff006e", "#f5ff00", "#00f5ff", "#ff5cf0"],
    carGlass: "#05050a",
    wheel: "#1a0030",
    truckBody: "#d6d0ff",
    truckCab: "#7a3cff",
    logBody: "#5a1a8a",
    logGrain: "#33095c",
    turtleShell: "#00f5ff",
    turtleShellDark: "#00808f",
    turtleSubmerged: "rgba(0, 245, 255, 0.28)",
    frogBody: "#00ff88",
    frogBelly: "#c9ffe8",
    frogEye: "#ffffff",
    frogPupil: "#05050a",
    frogDead: "#ff006e",
    timeGood: "#00ff88",
    timeWarn: "#f5ff00",
    timeBad: "#ff006e",
    overlayVeil: "rgba(8, 0, 20, 0.78)",
    overlayTitle: "#ff006e",
    glow: 9,
    glowColor: "#00f5ff",
  },
  // Monitor CRT de fósforo: ámbar para la carretera y sus vehículos, verde para el agua y
  // lo vivo, y nada más. Sin halo: los fósforos viejos tiran a plano.
  retro: {
    id: "retro",
    label: "RETRO",
    background: "#0d0a02",
    hudBg: "#070500",
    hudText: "#ffb000",
    hudDim: "#7a5200",
    roadBg: "#1a1204",
    roadMark: "#7a5200",
    riverBg: "#04140a",
    riverShine: "#0f3d1e",
    safeBg: "#1c1304",
    curb: "#3a2708",
    goalRowBg: "#08200f",
    goalBg: "#040c06",
    goalBorder: "#ffb000",
    goalFilled: "#33ff66",
    carBodies: ["#ffb000", "#ff8c00", "#ffd48a", "#c07800"],
    carGlass: "#0d0a02",
    wheel: "#2b1d05",
    truckBody: "#ffd48a",
    truckCab: "#8a5c00",
    logBody: "#8a5c00",
    logGrain: "#5c3d00",
    turtleShell: "#33ff66",
    turtleShellDark: "#1a7a33",
    turtleSubmerged: "rgba(51, 255, 102, 0.28)",
    frogBody: "#33ff66",
    frogBelly: "#b6ffc9",
    frogEye: "#ffd48a",
    frogPupil: "#0d0a02",
    frogDead: "#ff3b00",
    timeGood: "#33ff66",
    timeWarn: "#ffb000",
    timeBad: "#ff3b00",
    overlayVeil: "rgba(13, 10, 2, 0.78)",
    overlayTitle: "#ffb000",
    glow: 0,
    glowColor: "#33ff66",
  },
};
/** Activa el halo de la skin. No toca el contexto si `glow` es 0 (`clasico`/`retro`). */
export function pushGlow(ctx: CanvasRenderingContext2D, skin: RanariaSkin): void {
  if (skin.glow <= 0) return;
  ctx.save();
  ctx.shadowColor = skin.glowColor;
  ctx.shadowBlur = skin.glow;
}
/** Deshace `pushGlow`. Debe llamarse siempre en pareja con él. */
export function popGlow(ctx: CanvasRenderingContext2D, skin: RanariaSkin): void {
  if (skin.glow <= 0) return;
  ctx.restore();
}
/** Skin pedida, o `clasico` si el id llega ausente o no reconocido. */
export function resolveSkin(id?: SkinId): RanariaSkin {
  return (id && SKINS[id]) || SKINS.clasico;
}
