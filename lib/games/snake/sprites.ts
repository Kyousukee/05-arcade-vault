// ===== sprites.ts — atlas de frutas de Serpentina =====
//
// Transcripción de references/source-assets/snake-assets/snake-assets/sprites.js, que no
// se copia al proyecto: aquel archivo asigna `window.SPRITE_ATLAS` y apunta a una ruta
// relativa, así que impediría dos instancias del juego y rompería el SSR. Aquí son datos
// de módulo inmutables y la carga del PNG devuelve una Promise nueva por llamada.
//
// Hoja: 3790×442 px, fondo transparente. Solo se usa la fila y=136–295 (160 px de alto).
// A las coordenadas del original se les añade el tramo (`tier`), los puntos que suma la
// fruta y un color de reserva para dibujarla si el PNG no llega a cargar.
/** Tramo de valor de una fruta. Fija sus puntos y su probabilidad de aparecer. */
export type FruitTier = "common" | "mid" | "big";
export interface FruitSprite {
  /** Recorte en fruits.png. */
  x: number;
  y: number;
  w: number;
  h: number;
  tier: FruitTier;
  /** Puntos base; el score suma `points × level`. */
  points: number;
  /** Color del círculo de reserva si fruits.png no carga. */
  color: string;
}
/** Ruta absoluta desde la raíz del sitio: el archivo vive en public/games/serpentina/. */
export const FRUIT_SOURCE = "/games/serpentina/fruits.png";
/** Puntos por tramo. */
export const TIER_POINTS: Record<FruitTier, number> = {
  common: 10,
  mid: 25,
  big: 50,
};
/** Peso del tramo en el sorteo de la fruta nueva. Suma 100. */
export const TIER_WEIGHTS: Record<FruitTier, number> = {
  common: 70,
  mid: 25,
  big: 5,
};
/** Las 22 frutas del atlas, en el orden en que aparecen en la hoja. */
export const FRUIT_SPRITES: Record<string, FruitSprite> = {
  banana: { x: 34, y: 136, w: 110, h: 160, tier: "common", points: 10, color: "#ffe14d" },
  orange: { x: 186, y: 136, w: 150, h: 160, tier: "common", points: 10, color: "#ff9f1a" },
  grape: { x: 378, y: 136, w: 110, h: 160, tier: "common", points: 10, color: "#9b5de5" },
  garlic: { x: 540, y: 136, w: 130, h: 160, tier: "mid", points: 25, color: "#f2e8d5" },
  eggplant: { x: 712, y: 136, w: 130, h: 160, tier: "big", points: 50, color: "#6a2c91" },
  strawberry: { x: 894, y: 136, w: 110, h: 160, tier: "common", points: 10, color: "#ff2e63" },
  cherry: { x: 1066, y: 136, w: 110, h: 160, tier: "common", points: 10, color: "#e01e5a" },
  carrot: { x: 1228, y: 136, w: 130, h: 160, tier: "mid", points: 25, color: "#ff7f11" },
  mushroom: { x: 1400, y: 136, w: 130, h: 160, tier: "mid", points: 25, color: "#d9a066" },
  broccoli: { x: 1582, y: 136, w: 110, h: 160, tier: "mid", points: 25, color: "#3fa34d" },
  watermelon: { x: 1734, y: 136, w: 150, h: 160, tier: "big", points: 50, color: "#ff4d6d" },
  pepper: { x: 1906, y: 136, w: 150, h: 160, tier: "mid", points: 25, color: "#c1121f" },
  kiwi: { x: 2068, y: 136, w: 170, h: 160, tier: "mid", points: 25, color: "#8ab83d" },
  lemon: { x: 2250, y: 136, w: 140, h: 160, tier: "common", points: 10, color: "#f7e017" },
  peach: { x: 2432, y: 136, w: 130, h: 160, tier: "common", points: 10, color: "#ffb07c" },
  peanut: { x: 2604, y: 136, w: 130, h: 160, tier: "mid", points: 25, color: "#c99b6a" },
  apple: { x: 2786, y: 136, w: 110, h: 160, tier: "common", points: 10, color: "#ff3b3b" },
  tomato: { x: 2948, y: 136, w: 130, h: 160, tier: "common", points: 10, color: "#e63946" },
  berries: { x: 3110, y: 136, w: 150, h: 160, tier: "common", points: 10, color: "#5465ff" },
  grapes2: { x: 3302, y: 136, w: 110, h: 160, tier: "common", points: 10, color: "#7b2cbf" },
  pineapple: { x: 3454, y: 136, w: 150, h: 160, tier: "big", points: 50, color: "#f4d35e" },
  melon: { x: 3637, y: 136, w: 130, h: 160, tier: "big", points: 50, color: "#90be6d" },
};
/** Clave de FRUIT_SPRITES. */
export type FruitKind = keyof typeof FRUIT_SPRITES & string;
/** Tipos agrupados por tramo, para sortear uniforme dentro del tramo elegido. */
export const KINDS_BY_TIER: Record<FruitTier, FruitKind[]> = {
  common: [],
  mid: [],
  big: [],
};
for (const [kind, sprite] of Object.entries(FRUIT_SPRITES)) {
  KINDS_BY_TIER[sprite.tier].push(kind);
}
/**
 * Carga fruits.png. Devuelve una Promise nueva en cada llamada y resuelve a `null` si la
 * imagen falla (404, red caída, bloqueo en DevTools): el juego sigue siendo jugable con
 * el círculo de reserva. Nunca rechaza, para no obligar al llamador a un catch.
 */
export function loadFruitSheet(): Promise<CanvasImageSource | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = FRUIT_SOURCE;
  });
}
