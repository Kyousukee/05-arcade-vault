"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidNickname, normalizeNickname } from "@/lib/auth";
/** Traduce al español los errores que devuelve Supabase Auth. */
function authErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Tienes que confirmar tu correo antes de entrar.";
  if (m.includes("invalid email")) return "Ese correo no es válido.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ya existe una cuenta con ese correo.";
  if (m.includes("password") && m.includes("6"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos. Espera un momento y vuelve a probar.";
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
type NickCheck = "idle" | "checking" | "free" | "taken" | "invalid";
export default function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useState(() => createClient())[0];
  const [tab, setTab] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [nick, setNick] = useState("");
  const [nickRemote, setNickRemote] = useState<{ nick: string; free: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Modo recuperación: la misma tarjeta pide solo el correo.
  const [recovering, setRecovering] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  // Errores que traen de vuelta los handlers de `app/auth/*`.
  const urlError = searchParams.get("error");
  const shownError =
    error ??
    (urlError === "confirm"
      ? "No se pudo confirmar el enlace. Pide uno nuevo."
      : urlError === "oauth"
        ? "No se pudo completar el acceso con el proveedor."
        : null);
  // Disponibilidad del nick: la RPC solo informa, la verdad es el índice único.
  useEffect(() => {
    if (tab !== "up" || !isValidNickname(nick)) return;
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
  }, [nick, tab, supabase]);
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
  const signIn = async () => {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    if (signInError) {
      setError(authErrorMessage(signInError.message));
      setSending(false);
      return;
    }
    // Cuenta sin perfil (confirmación que no llegó a crearlo): faltaba el nick.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle()
      : { data: null };
    router.push(profile ? "/" : "/auth/nickname");
    router.refresh();
  };
  const signUp = async () => {
    const address = email.trim();
    const { error: signUpError } = await supabase.auth.signUp({
      email: address,
      password: pass,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: { nickname: nick },
      },
    });
    if (signUpError) {
      setError(authErrorMessage(signUpError.message));
      setSending(false);
      return;
    }
    setSentTo(address);
    setSending(false);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    if (tab === "up") {
      if (!isValidNickname(nick)) {
        setError("El nick debe tener de 3 a 10 caracteres, solo letras y números.");
        return;
      }
      if (nickCheck === "taken") {
        setError("Ese nick ya existe. Elige otro.");
        return;
      }
    }
    setSending(true);
    if (tab === "in") await signIn();
    else await signUp();
  };
  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    const address = email.trim();
    if (!address) {
      setError("Escribe el correo de tu cuenta.");
      return;
    }
    setSending(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (resetError) {
      setError(authErrorMessage(resetError.message));
      setSending(false);
      return;
    }
    setResetSentTo(address);
    setSending(false);
  };
  const signInWithProvider = async (provider: "google" | "github") => {
    if (sending) return;
    setError(null);
    setSending(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(authErrorMessage(oauthError.message));
      setSending(false);
    }
  };
  const guest = () => {
    router.push("/");
  };
  const switchTab = (next: "in" | "up") => {
    setTab(next);
    setError(null);
  };
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
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>
        <div className="auth-tabs">
          <button className={tab === "in" ? "on" : ""} onClick={() => switchTab("in")}>
            INICIAR SESIÓN
          </button>
          <button className={tab === "up" ? "on" : ""} onClick={() => switchTab("up")}>
            CREAR CUENTA
          </button>
        </div>
        {sentTo ? (
          <div className="auth-sent">
            <div className="pixel neon-green" style={{ fontSize: 11, marginBottom: 12 }}>
              REVISA TU CORREO
            </div>
            <p>
              Te enviamos un enlace de confirmación a <strong>{sentTo}</strong>. Ábrelo para activar
              tu cuenta y entrar al vault.
            </p>
            <button
              className="btn ghost"
              type="button"
              style={{ width: "100%", marginTop: 14 }}
              onClick={() => {
                setSentTo(null);
                switchTab("in");
              }}
            >
              VOLVER AL ACCESO
            </button>
          </div>
        ) : resetSentTo ? (
          <div className="auth-sent">
            <div className="pixel neon-green" style={{ fontSize: 11, marginBottom: 12 }}>
              REVISA TU CORREO
            </div>
            <p>
              Si <strong>{resetSentTo}</strong> tiene cuenta, le llega un enlace para poner una
              contraseña nueva.
            </p>
            <button
              className="btn ghost"
              type="button"
              style={{ width: "100%", marginTop: 14 }}
              onClick={() => {
                setResetSentTo(null);
                setRecovering(false);
              }}
            >
              VOLVER AL ACCESO
            </button>
          </div>
        ) : recovering ? (
          <>
            {shownError && <div className="contact-error">{shownError}</div>}
            <form onSubmit={sendReset}>
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <button
                className="btn lg"
                type="submit"
                style={{ width: "100%", marginTop: 8 }}
                disabled={sending}
              >
                {sending ? "ENVIANDO…" : "ENVIARME EL ENLACE"}
              </button>
            </form>
            <button
              className="btn ghost"
              type="button"
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => {
                setRecovering(false);
                setError(null);
              }}
            >
              VOLVER AL ACCESO
            </button>
          </>
        ) : (
          <>
            {shownError && <div className="contact-error">{shownError}</div>}
            <form onSubmit={submit}>
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                  autoComplete="email"
                />
              </div>
              {tab === "up" && (
                <div className="field slide-in">
                  <label>Nick</label>
                  <input
                    value={nick}
                    onChange={(e) => setNick(normalizeNickname(e.target.value))}
                    placeholder="KAI"
                    maxLength={10}
                    autoComplete="off"
                  />
                  <span
                    className="mono"
                    style={{ fontSize: 10, letterSpacing: "0.12em", color: nickHintColor }}
                  >
                    {nickHint[nickCheck]}
                  </span>
                </div>
              )}
              <div className="field">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={tab === "in" ? "current-password" : "new-password"}
                />
              </div>
              <button
                className="btn lg"
                type="submit"
                style={{ width: "100%", marginTop: 8 }}
                disabled={
                  sending || (tab === "up" && (nickCheck === "taken" || nickCheck === "invalid"))
                }
              >
                {tab === "in"
                  ? sending
                    ? "ENTRANDO…"
                    : "ENTRAR AL VAULT"
                  : sending
                    ? "CREANDO…"
                    : "CREAR Y JUGAR"}
              </button>
            </form>
            {tab === "in" && (
              <button
                className="auth-link mono"
                type="button"
                onClick={() => {
                  setRecovering(true);
                  setError(null);
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
            <button className="btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={guest}>
              JUGAR COMO INVITADO
            </button>
            <div className="auth-divider">O CONTINÚA CON</div>
            <div className="social">
              <button
                className="btn ghost"
                type="button"
                onClick={() => signInWithProvider("google")}
                disabled={sending}
              >
                ◆ GOOGLE
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => signInWithProvider("github")}
                disabled={sending}
              >
                ▣ GITHUB
              </button>
            </div>
          </>
        )}
        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
