# Spec 10 — Controles táctiles en móvil

**Estado:** aprobado
**Depende de:** 05-asteroides-jugable, 07-caida-jugable, 08-bloque-buster-jugable, 09-serpentina-jugable
**Fecha:** 2026-08-28

**Objetivo:** Añadir al reproductor un mando táctil en pantalla —cruceta de 4 direcciones y dos botones— que traduce toques a eventos de teclado sintéticos, con un layout de retrato a pantalla completa, para que los cuatro juegos del vault se puedan jugar en móvil sin tocar el código de ningún juego.

> Los specs 08 y 09 dejaron los controles táctiles explícitamente fuera de su alcance. Este spec paga esa deuda para el catálogo entero. La pieza clave es que los cuatro juegos leen `e.code` de `keydown`/`keyup` en `window`: el mando puede sintetizar esos eventos y los juegos no se enteran de que hay un dedo detrás.

## Alcance

**Incluye:**

- **Componente nuevo `components/TouchGamepad.tsx`** (client): cruceta de 4 direcciones (↑ ↓ ← →, sin diagonales) y dos botones `A` / `B`, dibujados en HTML+CSS con la estética del vault. Sin canvas, sin imágenes.
- **Traducción a teclado sintético:** cada control despacha `new KeyboardEvent("keydown" | "keyup", { code, bubbles: true })` sobre `window`. Los cuatro juegos siguen leyendo `e.code` y **no se modifica ningún `lib/games/*/game.ts`**.
- **Mapa por juego** en el propio componente (`PAD_MAPS: Record<string, PadMap>`), con el reparto ya acordado:

  | Juego           | Cruceta                              | A                  | B              |
  | --------------- | ------------------------------------ | ------------------ | -------------- |
  | `asteroides`    | `ArrowLeft` `ArrowRight` `ArrowUp`   | `Space` (disparar) | `KeyP` (pausa) |
  | `caida`         | `ArrowLeft` `ArrowRight` `ArrowDown` | `ArrowUp` (rotar)  | `Space` (drop) |
  | `bloque-buster` | `ArrowLeft` `ArrowRight`             | —                  | `KeyP` (pausa) |
  | `serpentina`    | las 4                                | —                  | `KeyP` (pausa) |

  Las direcciones y los botones sin uso se **ocultan** (hueco reservado, no botón inerte).

- **Multitouch real** con Pointer Events y seguimiento por `pointerId`: rotar y disparar a la vez en Asteroides funciona.
- **Montaje solo en móvil:** `matchMedia("(pointer: coarse)")` en un efecto de `GamePlayer`. En escritorio el mando no se renderiza y no se registra ni un listener.
- **Layout de retrato a pantalla completa** mientras el mando está montado: el reproductor ocupa `100dvh` sin scroll de página, con canvas arriba y mando abajo. `GamePlayer` marca `document.body` con la clase `av-playing` y el CSS oculta `Nav`, el `footer` y el `.crt-bottom` bajo `(pointer: coarse)`.
- **HUD compacto en móvil:** una sola fila sobre el canvas con puntuación, vidas/líneas/frutas y nivel; `SKIN`, `PAUSA`, `FIN` y `SALIR` pasan a una segunda fila de botones apretados.
- **Modal de fin de partida usable en móvil:** el modal se ancla arriba y hace scroll interno, para que el teclado virtual no tape el input de iniciales ni el botón de guardar.
- **`.keyboard-notice` sale de la rama `(pointer: coarse)`** de su media query: el aviso "requiere teclado" ya no aparece donde hay mando, solo en escritorio estrecho.
- **Verificación:** `npm run lint`, `npm run build` y prueba manual de los cuatro juegos en un móvil real (o emulación táctil de DevTools) completando una partida y guardando el puntaje.

**NO incluye (fuera de este spec):**

- Cambios en `lib/games/*/game.ts` y en el contrato `lib/games/types.ts`.
- Gestos: swipe para girar en Serpentina, arrastre del paddle sobre el canvas en Bloque Buster.
- Variante landscape con el mando partido a los lados del canvas.
- Overlay de "gira el dispositivo": el juego se juega en retrato.
- Vibración háptica (`navigator.vibrate`).
- Botón de pantalla completa (Fullscreen API).
- `viewport` con `maximumScale` / `userScalable: false`.
- Diagonales en la cruceta y repetición automática distinta de la del `keydown` mantenido.
- Mando configurable o remapeable por el jugador.
- Responsive táctil del resto de pantallas (`/`, `/biblioteca`, `/game/[id]`, `/hall-of-fame`).
- El simulador de demo de los juegos no jugables: el mando solo se monta si `hasRealGame(id)`.
- Tests automatizados (no hay test runner configurado).

**Consecuencias aceptadas de este scope:**

- Serpentina y Bloque Buster muestran un mando con un solo botón: es el precio de un mando único para los cuatro juegos en vez de cuatro mandos distintos.
- Al sintetizar `KeyboardEvent`, el juego no puede distinguir un toque de una tecla. Es deliberado: es lo que evita tocar los cuatro juegos.
- En Asteroides no hay freno ni hiperespacio en el mando: solo rotar, propulsar y disparar.
- En retrato el canvas 4:3 ocupa poco alto y el juego se ve pequeño; el mando gana ese espacio.
- Con `100dvh` y sin scroll, en móvil no se llega al pie ni a la navegación desde el reproductor; se sale con `SALIR`.

## Modelo de datos

Este spec no crea tablas ni toca el contrato compartido (`lib/games/types.ts` queda intacto). Lo que define son las estructuras internas del mando y los nombres de clase del layout móvil.

### Mapa de mando — `components/TouchGamepad.tsx`

`code` es el `KeyboardEvent.code` que los juegos ya leen. `null` = ese control no se renderiza para ese juego (queda el hueco, no un botón inerte).

```ts
/** Un control del mando: su `code` de teclado y su rótulo visible. */
interface PadKey {
  code: string;
  label: string;
}
interface PadMap {
  up: PadKey | null;
  down: PadKey | null;
  left: PadKey | null;
  right: PadKey | null;
  a: PadKey | null;
  b: PadKey | null;
}
const PAD_MAPS: Record<string, PadMap> = {
  asteroides: {
    up: { code: "ArrowUp", label: "▲" },
    down: null,
    left: { code: "ArrowLeft", label: "◀" },
    right: { code: "ArrowRight", label: "▶" },
    a: { code: "Space", label: "FUEGO" },
    b: { code: "KeyP", label: "II" },
  },
  caida: {
    up: null,
    down: { code: "ArrowDown", label: "▼" },
    left: { code: "ArrowLeft", label: "◀" },
    right: { code: "ArrowRight", label: "▶" },
    a: { code: "ArrowUp", label: "GIRO" },
    b: { code: "Space", label: "CAÍDA" },
  },
  "bloque-buster": {
    up: null,
    down: null,
    left: { code: "ArrowLeft", label: "◀" },
    right: { code: "ArrowRight", label: "▶" },
    a: null,
    b: { code: "KeyP", label: "II" },
  },
  serpentina: {
    up: { code: "ArrowUp", label: "▲" },
    down: { code: "ArrowDown", label: "▼" },
    left: { code: "ArrowLeft", label: "◀" },
    right: { code: "ArrowRight", label: "▶" },
    a: null,
    b: { code: "KeyP", label: "II" },
  },
};
```

Un `id` sin entrada en `PAD_MAPS` no monta mando. Es la misma regla que `hasRealGame`: juego desconocido, sin controles inventados.

### Estado táctil — dentro de `TouchGamepad`

Vive en un `useRef`, no en `useState`: el mando repinta por CSS (`:active` y `data-held`), no por render de React.

```ts
/** pointerId → `code` que ese dedo mantiene pulsado. */
const held = useRef<Map<number, string>>(new Map());
```

Reglas de emisión:

- `pointerdown` sobre un control → `held.set(pointerId, code)` + `keydown` sintético.
- `pointerup`, `pointercancel` y `pointerleave` → `keyup` sintético + `held.delete(pointerId)`.
- Un mismo `code` pulsado por dos dedos emite dos `keydown`; los juegos son idempotentes (`keys[e.code] = true`), así que no hace falta contar referencias.
- `setPointerCapture` en `pointerdown`: arrastrar el dedo fuera del botón no deja la tecla pegada.
- Al desmontar, se emite `keyup` de todo lo que quede en `held`. Sin esto, salir con una dirección pulsada dejaría al juego girando para siempre.

### Evento sintético

```ts
function emit(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
}
```

`isTrusted` será `false`, pero ningún juego lo comprueba. El `preventDefault` de `BLOCKED_KEYS` en `GamePlayer` tampoco estorba: sobre un evento sintético no hace nada.

### Nombres de clase del layout móvil

| Clase                  | Dónde                  | Para qué                                                                                                                                                                            |
| ---------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `av-playing`           | `document.body`        | La pone y la quita `GamePlayer` mientras el mando está montado. Bajo `(pointer: coarse)` oculta `Nav`, el `footer` y el `.crt-bottom`, y fija el reproductor a `100dvh` sin scroll. |
| `touch-pad`            | raíz de `TouchGamepad` | Contenedor del mando.                                                                                                                                                               |
| `pad-dir` / `pad-btns` | dentro de `touch-pad`  | Cruceta y bloque de botones.                                                                                                                                                        |
| `pad-key`              | cada control           | Botón individual; `data-dir` / `data-btn` lo identifican para el CSS.                                                                                                               |
| `hud-compact`          | `.player-hud`          | Solo bajo `(pointer: coarse)`: stats en una fila, acciones en otra.                                                                                                                 |

## Plan de implementación

Cada paso deja la app compilando y jugable en escritorio; el mando aparece al final del paso 3.

1. **`components/TouchGamepad.tsx` — esqueleto.** Componente client con la interfaz `PadKey` / `PadMap`, la tabla `PAD_MAPS` de los cuatro juegos y la firma `TouchGamepad({ gameId }: { gameId: string })`. Renderiza la cruceta y los dos botones según el mapa, sin listeners todavía. Devuelve `null` si `gameId` no está en `PAD_MAPS`. _Prueba:_ importado a mano en el reproductor, se ven los controles correctos por juego.
2. **Emisión de teclado sintético.** Añadir `emit()`, el `Map` `held` y los manejadores `onPointerDown` / `onPointerUp` / `onPointerCancel` con `setPointerCapture`, más el `useEffect` de limpieza que suelta todo lo pendiente al desmontar. _Prueba:_ con el mando visible en escritorio, pulsar ◀ mueve la nave de Asteroides.
3. **Montaje condicional en `GamePlayer`.** Estado `isCoarse`, sembrado con `matchMedia("(pointer: coarse)")` en un efecto y suscrito a sus cambios. Renderizar `<TouchGamepad gameId={game.id} />` solo si `isReal && isCoarse`. En ese mismo efecto, añadir y quitar la clase `av-playing` en `document.body`. _Prueba:_ en DevTools con emulación táctil aparece el mando; sin ella, no.
4. **CSS del mando** en `app/globals.css`: `.touch-pad`, `.pad-dir` (rejilla 3×3 con los huecos vacíos donde el mapa trae `null`), `.pad-btns`, `.pad-key` con su chaflán, su acento de neón y el estado `:active`. `touch-action: none` y `user-select: none` en todo el mando para que ningún toque scrollee ni seleccione texto.
5. **Layout de retrato a pantalla completa.** Bloque `@media (pointer: coarse)` sobre `body.av-playing`: ocultar `Nav`, `footer` y `.crt-bottom`; `.av-player` a `100dvh` en columna sin scroll, con el `.crt` ocupando el alto sobrante y el mando con alto fijo. Quitar el relleno y el `border-radius` grande del `.crt` en móvil.
6. **HUD compacto.** Clase `hud-compact` en `.player-hud` y su regla bajo `(pointer: coarse)`: stats en una fila con tipografía y separaciones reducidas, y `SKIN` / `PAUSA` / `FIN` / `SALIR` en una segunda fila de botones apretados.
7. **Modal de fin de partida en móvil.** Bajo `(pointer: coarse)`, `.modal-bd` alinea arriba, `.modal` limita el alto a `90dvh` con `overflow-y: auto`, y `.input-row` pasa a columna.
8. **Retirar el aviso de teclado del móvil.** En la media query de `.keyboard-notice`, dejar solo `(max-width: 720px)` y quitar `(pointer: coarse)`.
9. **Verificación final.** `npm run lint` y `npm run build`. Prueba manual de los cuatro juegos en un móvil real: jugar, pausar desde el mando, terminar y guardar el puntaje.

## Criterios de aceptación

**Mando y controles**

- [ ] En un dispositivo táctil, `/game/asteroides/play` muestra bajo el canvas una cruceta y dos botones; en escritorio con ratón no se renderiza ningún mando.
- [ ] En Asteroides, mantener ◀ con un dedo y pulsar `FUEGO` con otro rota y dispara a la vez.
- [ ] En Caída, `GIRO` rota la pieza y `CAÍDA` la suelta de golpe.
- [ ] En Bloque Buster se ven solo ◀ ▶ y el botón `II`; los huecos de ▲ ▼ y `A` no muestran botones pulsables.
- [ ] En Serpentina se ven las cuatro direcciones y el botón `II`.
- [ ] El botón `II` pausa y despausa: el overlay `EN PAUSA` aparece y desaparece.
- [ ] Mantener pulsada una dirección mueve de forma continua; al soltar, el movimiento para.
- [ ] Arrastrar el dedo desde un botón hacia fuera del mando no deja la tecla pegada: el movimiento se detiene al soltar.
- [ ] Pulsar `SALIR` con una dirección aún pulsada no deja ningún estado colgado (al volver a entrar, la nave no gira sola).
- [ ] Ningún archivo bajo `lib/games/` cambia en este spec.

**Layout móvil**

- [ ] En móvil, el reproductor ocupa exactamente el alto de la pantalla: la página no scrollea con el dedo ni al arrastrar sobre el mando.
- [ ] En móvil no se ven la barra de navegación, el pie de página ni la franja `.crt-bottom`.
- [ ] El canvas queda íntegro arriba y el mando íntegro abajo, sin solaparse ni recortarse en una pantalla de 360×640 px.
- [ ] El HUD móvil muestra puntuación, nivel y los stats del juego en una fila, y `SKIN` / `PAUSA` / `FIN` / `SALIR` en otra, sin desbordar el ancho.
- [ ] Al salir del reproductor, la navegación y el pie vuelven a aparecer y la página vuelve a scrollear con normalidad.

**Fin de partida**

- [ ] Con el teclado virtual abierto, el input de iniciales y el botón `GUARDAR PUNTUACIÓN` siguen siendo visibles y pulsables.
- [ ] Un puntaje guardado desde móvil aparece en el Hall of Fame del juego.

**Aviso de teclado**

- [ ] El texto "ESTE JUEGO REQUIERE TECLADO" no aparece en móvil.
- [ ] Sigue apareciendo en un escritorio con ratón y ventana de menos de 720 px de ancho.

**Regresión en escritorio**

- [ ] Con ratón y teclado, los cuatro juegos se comportan exactamente igual que antes: mismos controles, mismo HUD, mismo CRT con su franja inferior.
- [ ] `npm run lint` y `npm run build` pasan sin errores ni avisos nuevos.

## Decisiones

- **Sí:** traducir toques a `KeyboardEvent` sintéticos sobre `window`. Los cuatro juegos ya leen `e.code`, así que el mando entero cabe en un componente y `lib/games/` no se toca.
- **No:** extender `GameInstance` con `press(action)` / `release(action)`. Es el diseño más limpio, pero obliga a abrir los cuatro `game.ts` y a versionar el contrato para ganar cero funcionalidad. Si algún día un juego necesita un input que no sea una tecla, se reabre.
- **Sí:** un mando único de cruceta + dos botones para todo el catálogo. Es lo que basta en un arcade clásico y hace que el jugador aprenda una sola disposición.
- **No:** un mando distinto por juego. Solo cambia el mapa de teclas, no la forma.
- **Sí:** ocultar los controles sin uso dejando su hueco. Un botón inerte se pulsa, no responde y se lee como un fallo; un hueco no se pulsa.
- **Sí:** montar con `matchMedia("(pointer: coarse)")` en JS. En escritorio no hay markup ni listeners, solo la comprobación.
- **No:** renderizar siempre y ocultar por CSS. Dejaría manejadores táctiles vivos en escritorio y markup muerto en el DOM.
- **Sí:** Pointer Events con `Map` de `pointerId`. Sin multitouch, Asteroides sería injugable: no se podría rotar y disparar a la vez.
- **Sí:** `setPointerCapture` en cada `pointerdown` y `keyup` de todo lo pendiente al desmontar. Son las dos formas conocidas de dejar una tecla pegada.
- **Sí:** retrato, con canvas arriba y mando abajo. Es la postura natural con el móvil en la mano y evita la pelea con la orientación del navegador.
- **No:** overlay de "gira el dispositivo" y variante landscape. Landscape daría más alto de canvas, pero son dos layouts que mantener; si se pide, va en su propio spec.
- **Sí:** `100dvh` sin scroll y clase `av-playing` en `body`. `dvh` es la única unidad que respeta la barra del navegador móvil al aparecer y desaparecer.
- **No:** gestos (swipe en Serpentina, arrastre del paddle en Bloque Buster). Se descartan ahora por consistencia: un solo lenguaje de entrada. Son la extensión natural de este spec.
- **No:** vibración háptica, pantalla completa y `userScalable: false`. Cada uno es una decisión de plataforma con su propio coste; ninguno hace falta para poder jugar.
- **Sí:** retirar `.keyboard-notice` de la rama `(pointer: coarse)`. Con mando en pantalla, el aviso pasa de informar a mentir.

## Riesgos

| Riesgo                                                                                                       | Mitigación                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tecla pegada: el dedo sale del botón, el navegador cancela el toque o se desmonta con una dirección activa.  | `setPointerCapture` en `pointerdown`, manejo de `pointercancel`, y `keyup` de todo lo que quede en `held` al desmontar. Hay criterios de aceptación para los tres casos. |
| `100dvh` con la barra del navegador móvil apareciendo y desapareciendo recorta el mando.                     | `dvh` (no `vh`) mide el viewport dinámico. Se verifica en móvil real, no solo en DevTools.                                                                               |
| El teclado virtual al escribir iniciales redimensiona el viewport y descoloca el modal.                      | El modal se ancla arriba con `max-height: 90dvh` y `overflow-y: auto`, en vez de centrarse verticalmente.                                                                |
| `(pointer: coarse)` también acierta en portátiles táctiles: sale mando donde hay teclado.                    | Se acepta. El mando no estorba al teclado —los dos emiten los mismos `code`— y el juego sigue respondiendo a ambos.                                                      |
| Un `KeyboardEvent` sintético lleva `isTrusted: false`.                                                       | Ningún juego lo comprueba. Queda anotado aquí: si algún juego futuro filtra por `isTrusted`, el mando deja de funcionar en él sin error visible.                         |
| En retrato, un canvas 4:3 sobre un mando deja el juego muy pequeño en pantallas cortas.                      | Consecuencia aceptada del scope. El mando tiene alto fijo y el CRT se queda el resto; landscape es otro spec.                                                            |
| `document.body.classList` desde `GamePlayer` es estado global: dos reproductores montados a la vez se pisan. | Solo hay un reproductor por ruta (`/game/[id]/play`) y el efecto quita la clase al desmontar.                                                                            |

## Lo que **no** está en este spec

- Gestos: swipe en Serpentina, arrastre del paddle sobre el canvas en Bloque Buster.
- Variante landscape y overlay de "gira el dispositivo".
- Vibración háptica, pantalla completa y bloqueo del zoom por doble toque.
- Cambios en `lib/games/` y en el contrato `GameFactory` / `GameInstance`.
- Mando remapeable por el jugador.
- Responsive táctil del resto de pantallas del vault.

Cada uno, si entra, va en su propio spec.
