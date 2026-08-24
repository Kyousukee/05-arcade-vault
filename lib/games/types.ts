// ===== types.ts — contrato que todo juego real debe cumplir para montarse =====

export type GamePhase = "playing" | "paused" | "dead" | "gameover";

/** Estado que el juego publica al HUD React. */
export interface GameState {
  score: number;
  level: number;
  phase: GamePhase;
  /**
   * Vidas restantes. Opcional: hay juegos sin vidas (Caída), y su ausencia es la
   * señal de que el HUD no debe mostrar ese stat. Publicar 0 no serviría:
   * ocultaría el stat en Asteroides justo al perder la última vida.
   */
  lives?: number;
  /** Líneas eliminadas. Solo lo publican los juegos que llevan la cuenta (Caída). */
  lines?: number;
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
