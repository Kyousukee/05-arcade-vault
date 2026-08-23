// ===== queries.ts — lectura de juegos y puntajes desde Supabase =====
// Solo para server components y route handlers: usa el cliente con cookies,
// que depende de `cookies()` de next/headers.
import type { Game, GameCategory, ScoreRow } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
/** Fila de `games` con los puntajes embebidos, tal como la devuelve PostgREST. */
type GameWithScores = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
  playable: boolean;
  sort_order: number;
  scores: { score: number }[];
};
const GAME_COLUMNS =
  "id, title, short, long, cat, cover, color, playable, sort_order, scores(score)";
/** `best` = max(score) y `plays` = count(scores), derivados de los puntajes embebidos. */
function toGame(row: GameWithScores): Game {
  const scores = row.scores ?? [];
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat as GameCategory,
    cover: row.cover,
    color: row.color as Game["color"],
    playable: row.playable,
    best: scores.length ? Math.max(...scores.map((s) => s.score)) : 0,
    plays: scores.length,
  };
}
/** created_at (ISO, UTC) → dd/mm/yyyy. */
function toDate(createdAt: string): string {
  const d = new Date(createdAt);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getUTCFullYear()}`;
}
type ScoreRecord = { game_id: string; player_name: string; score: number; created_at: string };
function toRows(records: ScoreRecord[]): ScoreRow[] {
  return records.map((r, i) => ({
    rank: i + 1,
    name: r.player_name,
    score: r.score,
    date: toDate(r.created_at),
  }));
}
/** Todos los juegos, en el orden de la vitrina. */
export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`No se pudieron cargar los juegos: ${error.message}`);
  return (data as GameWithScores[]).map(toGame);
}
/** Un juego por id, o `null` si no existe. */
export async function getGameById(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar el juego ${id}: ${error.message}`);
  return data ? toGame(data as GameWithScores) : null;
}
/** Top `limit` puntajes de un juego. Desempate: el más antiguo primero. */
export async function getTopScores(gameId: string, limit = 10): Promise<ScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("game_id, player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`No se pudieron cargar los puntajes de ${gameId}: ${error.message}`);
  return toRows(data as ScoreRecord[]);
}
/** Top `limit` puntajes de cada juego, indexados por id de juego. */
export async function getAllTopScores(limit = 12): Promise<Record<string, ScoreRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("game_id, player_name, score, created_at")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`No se pudieron cargar los puntajes: ${error.message}`);
  const byGame: Record<string, ScoreRecord[]> = {};
  for (const record of data as ScoreRecord[]) {
    const bucket = (byGame[record.game_id] ??= []);
    if (bucket.length < limit) bucket.push(record);
  }
  return Object.fromEntries(Object.entries(byGame).map(([id, records]) => [id, toRows(records)]));
}
