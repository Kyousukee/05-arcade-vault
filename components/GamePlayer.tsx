"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TouchGamepad from "@/components/TouchGamepad";
import { hasRealGame, loadGame } from "@/lib/games/registry";
import { SKIN_IDS, type GameInstance, type GameState, type SkinId } from "@/lib/games/types";
/** Teclas del juego que no deben scrollear la página mientras está montado. */
const BLOCKED_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
/** Rótulo de cada skin en el selector del HUD. */
const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};
/**
 * Skin guardada para un juego, o `clasico`. Devuelve `clasico` también en el
 * servidor (no hay `localStorage`), lo cual es seguro: el selector solo se
 * renderiza cuando `supportsSkins` es true, y eso ocurre después del montaje
 * asíncrono del juego, así que nunca hay markup de skin que hidratar.
 */
function readStoredSkin(gameId: string): SkinId {
  if (typeof window === "undefined") return "clasico";
  try {
    const saved = localStorage.getItem(`av_skin_${gameId}`) as SkinId | null;
    return saved && SKIN_IDS.includes(saved) ? saved : "clasico";
  } catch {
    return "clasico";
  }
}
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
  // Skin activa, sembrada desde localStorage con la clave `av_skin_<gameId>`.
  const [skin, setSkin] = useState<SkinId>(() => readStoredSkin(game.id));
  // El montaje no debe depender de `skin` (remontaría y reiniciaría la partida
  // al cambiarla), pero sí necesita el valor inicial: va por ref.
  const skinRef = useRef<SkinId>(skin);
  // Solo los juegos que implementan `setSkin` muestran el selector.
  const [supportsSkins, setSupportsSkins] = useState(false);
  // Puntero grueso (móvil, tableta): decide si se monta el mando táctil.
  const [isCoarse, setIsCoarse] = useState(false);
  // Estado mostrado en el HUD: del juego real, o del simulador.
  const score = isReal ? (gameState?.score ?? 0) : mockScore;
  // `undefined` = el juego no tiene vidas (Caída) y el HUD no muestra ese stat.
  const lives = isReal ? gameState?.lives : 3;
  // Solo los juegos que llevan la cuenta de líneas publican `lines` (Caída).
  const lines = isReal ? gameState?.lines : undefined;
  // Solo los juegos que cuentan frutas publican `fruits` (Serpentina).
  const fruits = isReal ? gameState?.fruits : undefined;
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
      // Relectura: si el componente se reutiliza para otro juego sin remontarse,
      // la ref todavía traería la skin del juego anterior.
      const stored = readStoredSkin(game.id);
      skinRef.current = stored;
      setSkin(stored);
      const instance = factory({
        canvas,
        onState: setGameState,
        onGameOver: (score) => {
          setFinalScore(score);
          setOver(true);
        },
        // Desde la ref, no del state: meter `skin` en las deps remontaría el
        // juego —y reiniciaría la partida— cada vez que se cambia de skin.
        skin: skinRef.current,
      });
      instanceRef.current = instance;
      setSupportsSkins(typeof instance.setSkin === "function");
    });
    return () => {
      cancelled = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
      setSupportsSkins(false);
    };
  }, [isReal, game.id]);
  // Cambios de skin en caliente: efecto aparte del montaje, para no reiniciar.
  useEffect(() => {
    skinRef.current = skin;
    instanceRef.current?.setSkin?.(skin);
  }, [skin]);
  const chooseSkin = useCallback(
    (id: SkinId) => {
      setSkin(id);
      try {
        localStorage.setItem(`av_skin_${game.id}`, id);
      } catch {
        // Sin persistencia: la skin sigue aplicándose en esta sesión.
      }
    },
    [game.id],
  );
  // --- Combo box de skin -----------------------------------------------
  const [skinOpen, setSkinOpen] = useState(false);
  const skinBoxRef = useRef<HTMLDivElement | null>(null);
  const skinTriggerRef = useRef<HTMLButtonElement | null>(null);
  const skinOptionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const closeSkins = useCallback((focusTrigger = true) => {
    setSkinOpen(false);
    if (focusTrigger) skinTriggerRef.current?.focus();
  }, []);
  const pickSkin = useCallback(
    (id: SkinId) => {
      chooseSkin(id);
      closeSkins();
    },
    [chooseSkin, closeSkins],
  );
  // Al abrir, el foco entra en la opción activa para que el teclado siga la
  // lista. No hay setState aquí: la apertura ya la decidió el manejador.
  useEffect(() => {
    if (!skinOpen) return;
    skinOptionRefs.current[SKIN_IDS.indexOf(skin)]?.focus();
  }, [skinOpen, skin]);
  // Clic fuera del combo: cerrar sin robar el foco de donde haya ido.
  useEffect(() => {
    if (!skinOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!skinBoxRef.current?.contains(e.target as Node)) setSkinOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [skinOpen]);
  const onTriggerKeyDown = useCallback((e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setSkinOpen(true);
    }
  }, []);
  const onListKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLUListElement>) => {
      const opts = skinOptionRefs.current;
      const at = opts.indexOf(document.activeElement as HTMLLIElement);
      const focusAt = (i: number) => {
        e.preventDefault();
        opts[(i + opts.length) % opts.length]?.focus();
      };
      if (e.key === "ArrowDown") return focusAt(at + 1);
      if (e.key === "ArrowUp") return focusAt(at - 1);
      if (e.key === "Home") return focusAt(0);
      if (e.key === "End") return focusAt(opts.length - 1);
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (at >= 0) pickSkin(SKIN_IDS[at]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeSkins();
        return;
      }
      // Tab sale del combo: se cierra, pero el foco sigue su curso natural.
      if (e.key === "Tab") closeSkins(false);
    },
    [closeSkins, pickSkin],
  );
  // ── Móvil: mando táctil y layout a pantalla completa ──────────────────────
  // El mando solo se monta con puntero grueso: en escritorio no hay markup ni
  // listeners táctiles, solo esta comprobación. `av-playing` es la señal que el
  // CSS usa para ocultar navegación, pie y franja del CRT mientras se juega.
  useEffect(() => {
    if (!isReal) return;
    const mq = window.matchMedia("(pointer: coarse)");
    // `pointer: coarse` no basta: Chrome para Android en modo «sitio para
    // ordenador» —y algún navegador con lápiz— se anuncia como puntero fino y
    // dejaría el móvil sin controles. Si la pantalla acepta toques, hay mando.
    const touchable = () => mq.matches || navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    const apply = () => {
      const coarse = touchable();
      setIsCoarse(coarse);
      document.body.classList.toggle("av-playing", coarse);
    };
    apply();
    const onChange = () => apply();
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      document.body.classList.remove("av-playing");
    };
  }, [isReal]);
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
      <div className="player-hud hud-compact">
        <div className="hud-stats">
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
          {lives !== undefined && (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
            </div>
          )}
          {lines !== undefined && (
            <div className="hud-stat lines">
              <div className="l">Líneas</div>
              <div className="v">{lines.toLocaleString("es-ES")}</div>
            </div>
          )}
          {fruits !== undefined && (
            <div className="hud-stat fruits">
              <div className="l">Frutas</div>
              <div className="v">{fruits.toLocaleString("es-ES")}</div>
            </div>
          )}
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
          {isReal && supportsSkins && (
            <div
              className={`skin-select${skinOpen ? " open" : ""}`}
              data-skin={skin}
              ref={skinBoxRef}
            >
              <span className="skin-legend">SKIN</span>
              <button
                type="button"
                className="skin-trigger"
                ref={skinTriggerRef}
                aria-haspopup="listbox"
                aria-expanded={skinOpen}
                aria-label={`Skin del juego: ${SKIN_LABELS[skin]}`}
                onClick={() => setSkinOpen((open) => !open)}
                onKeyDown={onTriggerKeyDown}
              >
                <span className="skin-dot" aria-hidden="true" />
                <span className="name">{SKIN_LABELS[skin]}</span>
                <span className="skin-caret" aria-hidden="true" />
              </button>
              {skinOpen && (
                <ul
                  className="skin-list"
                  role="listbox"
                  aria-label="Skin del juego"
                  onKeyDown={onListKeyDown}
                >
                  {SKIN_IDS.map((id, i) => (
                    <li
                      key={id}
                      role="option"
                      tabIndex={-1}
                      data-skin={id}
                      className="skin-option"
                      aria-selected={skin === id}
                      ref={(el) => {
                        skinOptionRefs.current[i] = el;
                      }}
                      onClick={() => pickSkin(id)}
                    >
                      <span className="skin-dot" aria-hidden="true" />
                      <span className="name">{SKIN_LABELS[id]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
      {isReal && isCoarse && <TouchGamepad gameId={game.id} />}
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
