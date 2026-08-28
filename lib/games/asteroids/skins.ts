// ===== skins.ts — paletas de Asteroides =====
//
// Todo el color del juego vive aquí. Antes no había ni una constante: los hex
// estaban inline en `entities.ts` (nave, asteroides, balas, power-up,
// partículas) y en `game.ts` (fondo y overlay de GAME OVER). El renderer no
// debe tener ni un literal de color; si lo tiene, la skin no cambia de verdad
// y `neon` y `retro` acaban pareciéndose.
import type { GameSkin, SkinId } from "../types";
/** Paleta completa de Asteroides: entidades más chrome. */
export interface AsteroidsSkin extends GameSkin {
  /** Fondo del canvas completo. */
  background: string;
  /** Trazo de la silueta de la nave. */
  ship: string;
  /** Llama del propulsor. */
  thrust: string;
  /** Relleno de las balas. */
  bullet: string;
  /** Trazo del polígono de los asteroides. */
  asteroid: string;
  /** Marco y rótulo "3x" del power-up de disparo triple. */
  powerUp: string;
  /**
   * Componentes RGB de la chispa de explosión, como `"r,g,b"`. Van sueltos
   * porque la partícula se desvanece: el alfa lo pone el renderer frame a
   * frame con `particleStroke()`, no la paleta.
   */
  particleRgb: string;
  /** Texto "GAME OVER". */
  overlayTitle: string;
  /** Línea de puntaje bajo el "GAME OVER". */
  overlayScore: string;
  /**
   * Intensidad del `shadowBlur` en px CSS. 0 desactiva el glow por completo
   * (`clasico` y `retro` son planos, sin resplandor).
   */
  glow: number;
}
export const SKINS: Record<SkinId, AsteroidsSkin> = {
  // Copia literal del aspecto original: vectores blancos sobre negro, power-up
  // cian y llama naranja. Cambiar un solo hex sería una regresión visual.
  clasico: {
    id: "clasico",
    label: "CLÁSICO",
    background: "#000",
    ship: "#fff",
    thrust: "rgba(255, 130, 0, 0.85)",
    bullet: "#fff",
    asteroid: "#fff",
    powerUp: "#0ff",
    particleRgb: "255,255,255",
    overlayTitle: "#fff",
    overlayScore: "rgba(255,255,255,0.65)",
    glow: 0,
  },
  // La paleta del vault: cian y magenta saturados con glow sobre casi-negro.
  neon: {
    id: "neon",
    label: "NEÓN",
    background: "#05050a",
    ship: "#00f5ff",
    thrust: "#ff9d00",
    bullet: "#f5ff00",
    asteroid: "#ff006e",
    powerUp: "#00ff88",
    particleRgb: "0,245,255",
    overlayTitle: "#ff006e",
    overlayScore: "#00f5ff",
    glow: 12,
  },
  // Monitor CRT de fósforo: ámbar en tres intensidades más verde de acento.
  // Sin glow: los fósforos viejos tiran a plano y algo lavado.
  retro: {
    id: "retro",
    label: "RETRO",
    background: "#160d02",
    ship: "#ffb000",
    thrust: "#ffd166",
    bullet: "#ffe6b3",
    asteroid: "#c07800",
    powerUp: "#33ff66",
    particleRgb: "255,176,0",
    overlayTitle: "#ffb000",
    overlayScore: "#33ff66",
    glow: 0,
  },
};
/** Trazo de una chispa de explosión con el alfa de su desvanecimiento. */
export function particleStroke(skin: AsteroidsSkin, alpha: number): string {
  return `rgba(${skin.particleRgb},${alpha.toFixed(2)})`;
}
/** Skin pedida, o `clasico` si el id llega ausente o no reconocido. */
export function resolveSkin(id?: SkinId): AsteroidsSkin {
  return (id && SKINS[id]) || SKINS.clasico;
}
/**
 * Enciende el resplandor de la skin antes de un trazo. En `clasico` y `retro`
 * (`glow: 0`) no toca el contexto: cero cambio respecto al render original.
 */
export function pushGlow(
  c: CanvasRenderingContext2D,
  skin: AsteroidsSkin,
  color: string,
  scale = 1,
) {
  if (skin.glow <= 0) return;
  c.shadowColor = color;
  c.shadowBlur = skin.glow * scale;
}
/** Apaga el resplandor: el canvas comparte contexto entre todas las capas. */
export function popGlow(c: CanvasRenderingContext2D) {
  c.shadowBlur = 0;
  c.shadowColor = "transparent";
}
