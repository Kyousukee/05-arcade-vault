"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { GAMES } from "@/lib/data";
import { hasRealGame, loadGame } from "@/lib/games/registry";
import type { GameInstance, GameState } from "@/lib/games/types";
/** Teclas del juego que no deben scrollear la página mientras está montado. */
const BLOCKED_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
export default function GamePlayer() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const game = GAMES.find((g) => g.id === params.id);
  const isReal = !!game && hasRealGame(game.id);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<GameInstance | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [mockScore, setMockScore] = useState(0);
  const [mockLevel, setMockLevel] = useState(1);
  const [mockPaused, setMockPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);
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
    if (!isReal || !game) return;
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
  }, [isReal, game]);
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
    setSaved(false);
    if (isReal) {
      setFinalScore(0);
      instanceRef.current?.restart();
      return;
    }
    setMockScore(0);
    setMockLevel(1);
    setMockPaused(false);
  }, [isReal]);
  if (!game) notFound();
  // En el juego real el modal muestra el puntaje congelado al terminar.
  const modalScore = isReal ? finalScore : mockScore;
  const saveScore = () => {
    try {
      const all = JSON.parse(localStorage.getItem("av_scores") || "[]");
      all.push({ game: game.id, score: modalScore, name, at: Date.now() });
      localStorage.setItem("av_scores", JSON.stringify(all));
    } catch {
      // storage unavailable
    }
    setSaved(true);
  };
  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
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
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={saveScore}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
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
