// ===== registry.ts — juegos reales montables en el reproductor =====
//
// El id es el mismo de la tabla `games` en Supabase. El import() dinámico mantiene el
// código del juego fuera del bundle de las rutas que no lo usan.
import type { GameFactory } from "./types";
export const GAME_REGISTRY: Record<string, () => Promise<GameFactory>> = {
  asteroides: async () => (await import("./asteroids/game")).createAsteroidsGame,
  caida: async () => (await import("./tetris/game")).createCaidaGame,
  "bloque-buster": async () => (await import("./arkanoid/game")).createBloqueBusterGame,
  serpentina: async () => (await import("./snake/game")).createSerpentinaGame,
};
/** true si el id tiene un juego real; si no, el reproductor usa el simulador. */
export function hasRealGame(id: string): boolean {
  return id in GAME_REGISTRY;
}
/** Carga la factory del juego, o null si el id no está registrado. */
export async function loadGame(id: string): Promise<GameFactory | null> {
  const loader = GAME_REGISTRY[id];
  return loader ? loader() : null;
}
