"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { isValidNickname, normalizeNickname } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
type NickCheck = "idle" | "checking" | "free" | "taken" | "invalid";
export default function NicknameOnboarding() {
  const router = useRouter();
  const supabase = useState(() => createClient())[0];
  const { user, profile, loading } = useAuth();
  // `null` = el usuario aún no ha tecleado; se muestra el nick del registro.
  const [typed, setTyped] = useState<string | null>(null);
  const [nickRemote, setNickRemote] = useState<{ nick: string; free: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El registro por correo deja el nick elegido en `user_metadata`: se precarga
  // para que solo haya que confirmarlo.
  const fromMetadata = normalizeNickname(String(user?.user_metadata?.nickname ?? ""));
  const nick = typed ?? (isValidNickname(fromMetadata) ? fromMetadata : "");
  // Sin sesión no hay nada que completar; con perfil, esta pantalla sobra.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (profile) router.replace("/");
  }, [loading, user, profile, router]);
  useEffect(() => {
    if (!isValidNickname(nick)) return;
    let active = true;
    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc("nickname_available", {
        candidate: nick,
      });
      if (!active || rpcError) return;
      setNickRemote({ nick, free: Boolean(data) });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [nick, supabase]);
  const nickCheck: NickCheck =
    nick.length === 0
      ? "idle"
      : !isValidNickname(nick)
        ? "invalid"
        : nickRemote?.nick === nick
          ? nickRemote.free
            ? "free"
            : "taken"
          : "checking";
  const nickHint: Record<NickCheck, string> = {
    idle: "3–10 caracteres · letras y números",
    checking: "COMPROBANDO…",
    free: "NICK DISPONIBLE",
    taken: "ESE NICK YA EXISTE",
    invalid: "3–10 caracteres · solo letras y números",
  };
  const nickHintColor =
    nickCheck === "free"
      ? "var(--green)"
      : nickCheck === "taken" || nickCheck === "invalid"
        ? "var(--magenta)"
        : "var(--ink-faint)";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !user) return;
    setError(null);
    if (!isValidNickname(nick)) {
      setError("El nick debe tener de 3 a 10 caracteres, solo letras y números.");
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id, nickname: nick });
    if (insertError) {
      // 23505 = el índice único; entre la RPC y el insert alguien lo tomó.
      setError(
        insertError.code === "23505"
          ? "Ese nick ya existe. Elige otro."
          : "No se pudo guardar el nick. Inténtalo de nuevo.",
      );
      setSaving(false);
      return;
    }
    // Navegación completa: remonta el AuthProvider con el perfil ya creado.
    window.location.assign("/");
  };
  if (loading || !user || profile) return null;
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ELIGE TU NICK</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ASÍ TE VERÁN EN EL SALÓN DE LA FAMA
          </div>
        </div>
        {error && <div className="contact-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Nick</label>
            <input
              value={nick}
              onChange={(e) => setTyped(normalizeNickname(e.target.value))}
              placeholder="KAI"
              maxLength={10}
              autoComplete="off"
              autoFocus
            />
            <span
              className="mono"
              style={{ fontSize: 10, letterSpacing: "0.12em", color: nickHintColor }}
            >
              {nickHint[nickCheck]}
            </span>
          </div>
          <button
            className="btn lg"
            type="submit"
            style={{ width: "100%", marginTop: 8 }}
            disabled={saving || nickCheck !== "free"}
          >
            {saving ? "GUARDANDO…" : "ENTRAR AL VAULT"}
          </button>
        </form>
      </div>
    </div>
  );
}
