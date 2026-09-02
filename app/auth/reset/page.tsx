"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_RULES, checkPassword } from "@/lib/auth/password";
type Phase = "checking" | "ready" | "invalid" | "saved";
export default function ResetPassword() {
  const router = useRouter();
  const supabase = useState(() => createClient())[0];
  const [phase, setPhase] = useState<Phase>("checking");
  const [pass, setPass] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La sesión de recuperación llega en el enlace del correo: o ya está abierta,
  // o viene un `code` que hay que canjear.
  useEffect(() => {
    let active = true;
    const open = async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setPhase(user ? "ready" : "invalid");
    };
    void open();
    return () => {
      active = false;
    };
  }, [supabase]);
  const passCheck = checkPassword(pass);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    if (!passCheck.valid) {
      setError("La contraseña no cumple todos los requisitos.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: pass });
    if (updateError) {
      setError("No se pudo cambiar la contraseña. Pide un enlace nuevo.");
      setSaving(false);
      return;
    }
    setPhase("saved");
    setSaving(false);
    router.refresh();
  };
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">NUEVA CONTRASEÑA</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            RECUPERACIÓN DE ACCESO
          </div>
        </div>
        {phase === "checking" && (
          <div className="mono" style={{ textAlign: "center", color: "var(--ink-faint)" }}>
            COMPROBANDO EL ENLACE…
          </div>
        )}
        {phase === "invalid" && (
          <>
            <div className="contact-error">
              Este enlace no es válido o ya caducó. Pide otro desde el acceso.
            </div>
            <Link href="/login" className="btn ghost" style={{ width: "100%", marginTop: 10 }}>
              VOLVER AL ACCESO
            </Link>
          </>
        )}
        {phase === "saved" && (
          <div className="auth-sent">
            <div className="pixel neon-green" style={{ fontSize: 11, marginBottom: 12 }}>
              CONTRASEÑA ACTUALIZADA
            </div>
            <p>Ya puedes entrar al vault con tu contraseña nueva.</p>
            <Link href="/" className="btn" style={{ width: "100%", marginTop: 14 }}>
              IR AL VAULT
            </Link>
          </div>
        )}
        {phase === "ready" && (
          <>
            {error && <div className="contact-error">{error}</div>}
            <form onSubmit={submit}>
              <div className="field">
                <label>Contraseña nueva</label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoFocus
                />
                <ul className="password-rules mono">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(pass);
                    return (
                      <li key={rule.id} className={ok ? "ok" : ""}>
                        <span aria-hidden="true">{ok ? "▪" : "▫"}</span> {rule.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <button
                className="btn lg"
                type="submit"
                style={{ width: "100%", marginTop: 8 }}
                disabled={saving || !passCheck.valid}
              >
                {saving ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
