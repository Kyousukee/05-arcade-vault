// ===== types.ts — contrato que todo juego real debe cumplir para montarse =====

export type GamePhase = "playing" | "paused" | "dead" | "gameover";

/** Estado que el juego publica al HUD React. */
export interface GameState {
  score: number;
  lives: number;
  level: number;
  phase: GamePhase;
  /** Segundos restantes de disparo triple; 0 si no está activo. */
  tripleShot: number;
}

/** Handle que el reproductor usa para controlar la partida desde el HUD. */
export interface GameInstance {
  pause(): void;
  resume(): void;
  /** Termina la partida inmediatamente (botón FIN). */
  end(): void;
  restart(): void;
  /** Cancela el rAF y quita listeners y ResizeObserver. */
  destroy(): void;
}

export interface GameMountOptions {
  canvas: HTMLCanvasElement;
  /** Se invoca a ~10 Hz, no en cada frame, para no re-renderizar React a 60 fps. */
  onState: (state: GameState) => void;
  /** Se invoca una vez, tras el overlay GAME OVER del canvas. */
  onGameOver: (finalScore: number) => void;
}

export type GameFactory = (opts: GameMountOptions) => GameInstance;
