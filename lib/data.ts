// ===== data.ts — tipos compartidos de la UI (los datos viven en Supabase) =====
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: "cyan" | "magenta" | "green" | "yellow";
  playable: boolean;
  best: number; // derivado: max(score); 0 si no hay partidas
  plays: number; // derivado: count(scores)
}
/** 12400 -> "12.4K"; por debajo de 1000 se muestra el número tal cual. */
export function formatPlays(plays: number): string {
  if (plays < 1000) return String(plays);
  return (plays / 1000).toFixed(1).replace(/\.0$/, "") + "K";
}
export const CATS: ("TODOS" | GameCategory)[] = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/yyyy
}
