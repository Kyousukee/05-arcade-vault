"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasRealGame, loadGame } from "@/lib/games/registry";
import type { GameInstance, GameState } from "@/lib/games/types";
/** Teclas del juego que no deben scrollear la página mientras está montado. */
const BLOCKED_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
export default function GamePlayer({ game }: { game: { id: string; title: string } }) {
  const router = useRouter();
  const isReal = hasRealGame(game.id);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<GameInstance | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [mockScore, setMockScore] = useState(0);
  const [mockLevel, setMockLevel] = useState(1);
  const [mockPaused, setMockPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedRank, setSavedRank] = useState<number | null>(null);
  const [saveError, setSaveError] = useState("");
  // Estado mostrado en el HUD: del juego real, o del simulador.
  const score = isReal ? (gameState?.score ?? 0) : mockScore;
  const lives = isReal ? (gameState?.lives ?? 3) : 3;
  const level = isReal ? (gameState?.level ?? 1) : mockLevel;
  const paused = isReal ? gameState?.phase === "paused" : mockPaused;
  const tripleShot = isReal ? (gameState?.tripleShot ?? 0) : 0;
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("av_user") || "null");
      if (user?.name) setName(user.name);
    } catch {
      // no session
    }
  }, []);
  // ── Juego real: montaje sobre el canvas ───────────────────────────────────
  useEffect(() => {
    if (!isReal) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    loadGame(game.id).then((factory) => {
      if (!factory || cancelled) return;
      instanceRef.current = factory({
        canvas,
        onState: setGameState,
        onGameOver: (score) => {
          setFinalScore(score);
          setOver(true);
        },
      });
    });
    return () => {
      cancelled = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [isReal, game.id]);
  // Las teclas del juego no deben scrollear la página (ni robar el foco a un
  // campo de formulario, como el input de iniciales del modal).
  useEffect(() => {
    if (!isReal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      if (BLOCKED_KEYS.has(e.code)) e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isReal]);
  // ── Simulador fake (juegos mock) ──────────────────────────────────────────
  useEffect(() => {
    if (isReal || over || mockPaused) return;
    const t = setInterval(() => setMockScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [isReal, over, mockPaused]);
  useEffect(() => {
    if (isReal) return;
    if (mockScore > 0 && mockScore % 2500 < 100) setMockLevel((l) => l + 1);
  }, [isReal, mockScore]);
  const togglePause = useCallback(() => {
    if (isReal) {
      const inst = instanceRef.current;
      if (!inst) return;
      if (paused) inst.resume();
      else inst.pause();
      return;
    }
    setMockPaused((p) => !p);
  }, [isReal, paused]);
  const endGame = useCallback(() => {
    if (isReal) {
      instanceRef.current?.end();
      return;
    }
    setOver(true);
  }, [isReal]);
  const restart = useCallback(() => {
    setOver(false);
    setSaveState("idle");
    setSavedRank(null);
    setSaveError("");
    if (isReal) {
      setFinalScore(0);
      instanceRef.current?.restart();
      return;
    }
    setMockScore(0);
    setMockLevel(1);
    setMockPaused(false);
  }, [isReal]);
  // En el juego real el modal muestra el puntaje congelado al terminar.
  const modalScore = isReal ? finalScore : mockScore;
  const nameIsValid = name.trim().length >= 3;
  const saveScore = async () => {
    if (!nameIsValid || saveState === "saving") return;
    setSaveState("saving");
    setSaveError("");
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, playerName: name.trim(), score: modalScore }),
      });
      const data = (await res.json()) as { rank?: number; error?: string };
      if (!res.ok) {
        setSaveError(data.error ?? "No se pudo guardar el puntaje");
        setSaveState("error");
        return;
      }
      setSavedRank(data.rank ?? null);
      setSaveState("saved");
    } catch {
      setSaveError("Sin conexión con el servidor");
      setSaveState("error");
    }
  };
  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name || "INVITADO"}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {tripleShot > 0 && (
            <div className="hud-stat power">
              <div className="l">Potenciador</div>
              <div className="v">3x · {tripleShot.toFixed(1)}s</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <Link href={`/game/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>
      <div className="crt">
        <div className="crt-screen">
          {isReal ? (
            <canvas ref={canvasRef} className="game-canvas" />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>
      {isReal && (
        <p className="keyboard-notice mono">
          ▸ ESTE JUEGO REQUIERE TECLADO · ←/→ ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR · P PAUSA
        </p>
      )}
      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{modalScore.toLocaleString("es-ES")}</div>
            {saveState !== "saved" ? (
              <>
                <div className="input-row">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                    placeholder="TUS INICIALES"
                    disabled={saveState === "saving"}
                  />
                  <button
                    className="btn yellow"
                    onClick={saveScore}
                    disabled={!nameIsValid || saveState === "saving"}
                  >
                    {saveState === "saving" ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {saveState === "error" && (
                  <div className="save-error mono">▸ {saveError} · REINTENTA</div>
                )}
              </>
            ) : (
              <div className="toast-saved">
                ▸ PUNTUACIÓN GUARDADA_
                {savedRank !== null && ` PUESTO #${String(savedRank).padStart(2, "0")}`}
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => router.push("/")}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
