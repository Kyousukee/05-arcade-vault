import { createClient } from "@/lib/supabase/server";
type ScorePayload = {
  gameId: string;
  playerName: string;
  score: number;
};
const NAME_MIN = 3;
const NAME_MAX = 10;
/** trim + mayúsculas + recorte a 10, igual que el CHECK de la tabla. */
function normalizeName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase().slice(0, NAME_MAX) : "";
}
export async function POST(request: Request) {
  let body: Partial<ScorePayload>;
  try {
    body = (await request.json()) as Partial<ScorePayload>;
  } catch {
    return Response.json({ error: "Cuerpo de la petición inválido" }, { status: 400 });
  }
  const gameId = typeof body.gameId === "string" ? body.gameId.trim() : "";
  const score = body.score;
  if (!gameId) {
    return Response.json({ error: "gameId es obligatorio" }, { status: 400 });
  }
  const supabase = await createClient();
  // Con sesión manda el nick del perfil: el `playerName` del cuerpo se ignora.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user
    ? (await supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle()).data
    : null;
  const playerName = profile ? profile.nickname : normalizeName(body.playerName);
  const userId = profile ? user!.id : null;
  if (playerName.length < NAME_MIN) {
    return Response.json(
      { error: `playerName debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres` },
      { status: 400 },
    );
  }
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0) {
    return Response.json({ error: "score debe ser un entero mayor o igual a 0" }, { status: 400 });
  }
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id")
    .eq("id", gameId)
    .maybeSingle();
  if (gameError) {
    return Response.json({ error: "No se pudo guardar el puntaje" }, { status: 500 });
  }
  if (!game) {
    return Response.json({ error: `El juego ${gameId} no existe` }, { status: 400 });
  }
  const { data: inserted, error: insertError } = await supabase
    .from("scores")
    .insert({ game_id: gameId, player_name: playerName, score, user_id: userId })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return Response.json({ error: "No se pudo guardar el puntaje" }, { status: 500 });
  }
  // Rango informativo en el momento del insert: cuántos puntajes lo superan, +1.
  const { count } = await supabase
    .from("scores")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .gt("score", score);
  return Response.json({ id: inserted.id, rank: (count ?? 0) + 1 }, { status: 201 });
}
