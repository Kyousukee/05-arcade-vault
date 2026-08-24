// ===== audio.ts — los dos efectos de sonido, por instancia =====
//
// El original creaba dos Audio en el scope del módulo y hacía cloneNode().play()
// en cada colisión, sin liberar nunca los clones: en una partida larga son
// cientos de elementos vivos. Aquí cada efecto tiene un pool fijo de voces que
// rota, así que dos rebotes seguidos se solapan pero el número de nodos está
// acotado, y dispose() los suelta todos al destruir la instancia.
const BOUNCE_SRC = "/games/bloque-buster/sounds/ball-bounce.mp3";
const BREAK_SRC = "/games/bloque-buster/sounds/break-sound.mp3";
/** Voces simultáneas por efecto. Suficiente para solapar rebotes encadenados. */
const VOICES = 4;
export interface GameAudio {
  /** Rebote en muro o paddle. */
  playBounce(): void;
  /** Bloque roto. */
  playBreak(): void;
  /** Corta lo que esté sonando y silencia hasta el próximo setMuted(false). */
  setMuted(muted: boolean): void;
  /** Para todo y suelta las referencias. Idempotente. */
  dispose(): void;
}
/** Un efecto con su pool de voces en rotación. */
class Effect {
  private voices: HTMLAudioElement[] = [];
  private next = 0;
  constructor(src: string) {
    for (let i = 0; i < VOICES; i++) {
      const audio = new Audio(src);
      audio.preload = "auto";
      this.voices.push(audio);
    }
  }
  play() {
    const audio = this.voices[this.next];
    if (!audio) return;
    this.next = (this.next + 1) % this.voices.length;
    audio.currentTime = 0;
    // El autoplay del navegador puede rechazar el play() si aún no hubo gesto
    // del usuario. El juego nunca debe romperse por audio.
    void audio.play().catch(() => {});
  }
  stop() {
    for (const audio of this.voices) {
      audio.pause();
      audio.currentTime = 0;
    }
  }
  dispose() {
    for (const audio of this.voices) {
      audio.pause();
      audio.src = "";
    }
    this.voices = [];
  }
}
/** Crea el audio de una partida. Nada se comparte entre instancias. */
export function createGameAudio(): GameAudio {
  const bounce = new Effect(BOUNCE_SRC);
  const brk = new Effect(BREAK_SRC);
  let muted = false;
  let disposed = false;
  return {
    playBounce() {
      if (muted || disposed) return;
      bounce.play();
    },
    playBreak() {
      if (muted || disposed) return;
      brk.play();
    },
    setMuted(value: boolean) {
      muted = value;
      if (value) {
        bounce.stop();
        brk.stop();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      bounce.dispose();
      brk.dispose();
    },
  };
}
