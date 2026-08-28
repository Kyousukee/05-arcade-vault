// ===== types.ts — contrato que todo juego real debe cumplir para montarse =====
export type GamePhase = "playing" | "paused" | "dead" | "gameover";
/**
 * Skins disponibles para cualquier juego. `clasico` reproduce exactamente el
 * aspecto original del juego y es el fallback de todo resolver.
 */
export type SkinId = "clasico" | "neon" | "retro";
/** Orden de presentación en el selector del HUD. `clasico` siempre primero. */
export const SKIN_IDS: readonly SkinId[] = ["clasico", "neon", "retro"];
/**
 * Forma común de una skin. Cada juego la extiende con SU record de colores: los
 * tokens de un tetris (piezas, rejilla, panel NEXT) no son los de un asteroids.
 */
export interface GameSkin {
  id: SkinId;
  label: string;
}
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
  /** Frutas comidas en la partida. Solo lo publican los juegos que las cuentan (Serpentina). */
  fruits?: number;
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
  /**
   * Cambia la skin en caliente, sin remontar ni reiniciar la partida: el
   * siguiente frame ya pinta con la nueva. Opcional mientras no la implementen
   * los cuatro juegos; su ausencia es la señal de que el HUD oculta el selector.
   */
  setSkin?(id: SkinId): void;
}
export interface GameMountOptions {
  canvas: HTMLCanvasElement;
  /** Se invoca a ~10 Hz, no en cada frame, para no re-renderizar React a 60 fps. */
  onState: (state: GameState) => void;
  /** Se invoca una vez, tras el overlay GAME OVER del canvas. */
  onGameOver: (finalScore: number) => void;
  /** Skin inicial. Ausente = `clasico`, el aspecto original del juego. */
  skin?: SkinId;
}
export type GameFactory = (opts: GameMountOptions) => GameInstance;
