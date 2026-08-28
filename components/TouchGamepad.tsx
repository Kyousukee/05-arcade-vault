"use client";
import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
// ===== TouchGamepad — mando táctil del reproductor =====
//
// Cruceta de 4 direcciones y dos botones. No conoce ningún juego: solo traduce
// cada control a un `KeyboardEvent.code`, que es lo que los juegos ya leen de
// `keydown` / `keyup` en `window`. Por eso el mando no toca `lib/games/`.
/** Un control del mando: su `code` de teclado y su rótulo visible. */
interface PadKey {
  code: string;
  label: string;
  /** Nombre para lectores de pantalla, cuando el rótulo es un símbolo. */
  name: string;
}
/** Reparto de los seis controles para un juego. `null` = ese control no se renderiza. */
interface PadMap {
  up: PadKey | null;
  down: PadKey | null;
  left: PadKey | null;
  right: PadKey | null;
  a: PadKey | null;
  b: PadKey | null;
}
/**
 * Un id sin entrada aquí no monta mando. Es la misma regla que `hasRealGame`:
 * juego desconocido, sin controles inventados.
 */
const PAD_MAPS: Record<string, PadMap> = {
  asteroides: {
    up: { code: "ArrowUp", label: "▲", name: "Propulsar" },
    down: null,
    left: { code: "ArrowLeft", label: "◀", name: "Girar a la izquierda" },
    right: { code: "ArrowRight", label: "▶", name: "Girar a la derecha" },
    a: { code: "Space", label: "FUEGO", name: "Disparar" },
    b: { code: "KeyP", label: "II", name: "Pausa" },
  },
  caida: {
    up: null,
    down: { code: "ArrowDown", label: "▼", name: "Bajar" },
    left: { code: "ArrowLeft", label: "◀", name: "Mover a la izquierda" },
    right: { code: "ArrowRight", label: "▶", name: "Mover a la derecha" },
    a: { code: "ArrowUp", label: "GIRO", name: "Rotar la pieza" },
    b: { code: "Space", label: "CAÍDA", name: "Caída rápida" },
  },
  "bloque-buster": {
    up: null,
    down: null,
    left: { code: "ArrowLeft", label: "◀", name: "Mover a la izquierda" },
    right: { code: "ArrowRight", label: "▶", name: "Mover a la derecha" },
    a: null,
    b: { code: "KeyP", label: "II", name: "Pausa" },
  },
  serpentina: {
    up: { code: "ArrowUp", label: "▲", name: "Arriba" },
    down: { code: "ArrowDown", label: "▼", name: "Abajo" },
    left: { code: "ArrowLeft", label: "◀", name: "Izquierda" },
    right: { code: "ArrowRight", label: "▶", name: "Derecha" },
    a: null,
    b: { code: "KeyP", label: "II", name: "Pausa" },
  },
};
/** Direcciones en el orden de la rejilla 3×3, con la celda que ocupa cada una. */
const DIRS = [
  { slot: "up", area: "u" },
  { slot: "left", area: "l" },
  { slot: "right", area: "r" },
  { slot: "down", area: "d" },
] as const;
/**
 * El evento que ven los juegos. Llevará `isTrusted: false`, pero ninguno lo
 * comprueba: todos leen `e.code` y ya está.
 */
function emit(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
}
export default function TouchGamepad({ gameId }: { gameId: string }) {
  // pointerId → `code` que ese dedo mantiene pulsado. En una ref, no en estado:
  // el mando repinta por CSS (`[data-held]`), no por render de React.
  const held = useRef<Map<number, string>>(new Map());
  const press = useCallback((e: ReactPointerEvent<HTMLButtonElement>, code: string) => {
    // Evita el clic emulado, el foco y el scroll por arrastre sobre el botón.
    e.preventDefault();
    const el = e.currentTarget;
    // Con captura, arrastrar el dedo fuera del botón sigue entregando aquí el
    // `pointerup`: sin esto la tecla se quedaría pegada.
    el.setPointerCapture(e.pointerId);
    el.dataset.held = "1";
    held.current.set(e.pointerId, code);
    emit("keydown", code);
  }, []);
  const release = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const code = held.current.get(e.pointerId);
    if (code === undefined) return;
    held.current.delete(e.pointerId);
    delete e.currentTarget.dataset.held;
    emit("keyup", code);
  }, []);
  // `pointerleave` solo cuenta cuando el botón NO tiene la captura (ratón en
  // escritorio). Con captura, soltar dentro o fuera lo resuelve `pointerup`, y
  // liberar aquí cortaría el movimiento antes de tiempo.
  const leave = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) return;
      release(e);
    },
    [release],
  );
  // Al desmontar, soltar lo que quede pulsado. Sin esto, salir con una dirección
  // apretada dejaría al juego girando para siempre.
  useEffect(() => {
    const pending = held.current;
    return () => {
      for (const code of pending.values()) emit("keyup", code);
      pending.clear();
    };
  }, []);
  const map = PAD_MAPS[gameId];
  if (!map) return null;
  const handlers = (code: string) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => press(e, code),
    onPointerUp: release,
    onPointerCancel: release,
    onPointerLeave: leave,
    onContextMenu: (e: ReactPointerEvent<HTMLButtonElement>) => e.preventDefault(),
  });
  return (
    <div className="touch-pad" role="group" aria-label="Mando táctil">
      <div className="pad-dir">
        {DIRS.map(({ slot, area }) => {
          const key = map[slot];
          // Sin control: el hueco de la rejilla se queda vacío. Un botón inerte
          // se pulsa, no responde y se lee como un fallo; un hueco no se pulsa.
          if (!key) return null;
          return (
            <button
              key={slot}
              type="button"
              className="pad-key"
              data-dir={area}
              aria-label={key.name}
              {...handlers(key.code)}
            >
              {key.label}
            </button>
          );
        })}
      </div>
      <div className="pad-btns">
        {(["a", "b"] as const).map((slot) => {
          const key = map[slot];
          if (!key) return null;
          return (
            <button
              key={slot}
              type="button"
              className="pad-key"
              data-btn={slot}
              aria-label={key.name}
              {...handlers(key.code)}
            >
              {key.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
