---
name: spec-impl-game
description: Implementa un spec de juego aprobado igual que /spec-impl y, al terminar, encadena @skin-designer y después @mobile-porter sobre el id recién registrado. Úsalo en lugar de /spec-impl cuando el spec añade un juego jugable nuevo al registry.
disable-model-invocation: true
argument-hint: "<NN-nombre-del-spec> (p. ej. 11-nave-nodriza-jugable, o solo 11)"
allowed-tools: Skill, Task, Read, Grep, Glob, Bash(git status:*), Bash(git branch:*), Bash(git diff:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementador de specs de juego, con los dos agentes encadenados

Implementa un spec **de juego** aprobado y no lo da por terminado hasta que el juego tiene sus
3 skins y su mando táctil. La implementación no la reescribes tú: **la delegas en `/spec-impl`**.
Lo que añade este comando es lo de después — `@skin-designer` primero y `@mobile-porter` después,
**uno detrás de otro, nunca en paralelo**.

Responde en el idioma del prompt inicial (por defecto, español).

## Por qué existe

Un juego nuevo en Arcade Vault necesita cuatro piezas (módulo en `lib/games/<juego>/`, entrada en
el registry, fila en la tabla `games` y su aparición en el leaderboard), pero **no está terminado**
ahí: sin sus 3 skins queda fuera del invariante de `@skin-designer`, y sin su entrada en
`PAD_MAPS` sale en móvil **sin mando, injugable y sin error visible**.

Hoy eso son tres invocaciones manuales seguidas y las dos últimas se olvidan. Este comando las
encadena.

## Contexto de sesión

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Registry **antes** de implementar (foto previa — la Fase 2 detecta el id nuevo contra esto):
!`cat lib/games/registry.ts 2>/dev/null || echo "lib/games/registry.ts no encontrado"`

---

## Flujo del comando

Cinco fases en orden estricto. **No avances si la anterior no terminó bien.**

---

### Fase 1 — Delegar la implementación en `/spec-impl`

El argumento recibido es: `$ARGUMENTS`

Invoca la herramienta `Skill` con `skill: "spec-impl"` y `args: $ARGUMENTS`, y **sigue sus
instrucciones al pie de la letra**. Sus cuatro fases son las que mandan: identificar el spec en
`specs/`, validar que el estado significa "Aprobado", crear y conmutar la rama `spec-NN-slug`
según `AutoCreateBranch`, e implementar paso a paso con pausas para revisar el diff.

- **No reimplementas nada de eso.** Ni la tabla de estados, ni el naming de la rama, ni las pausas.
  Si algún día `/spec-impl` cambia, este comando hereda el cambio; por eso lo invoca en vez de
  copiarlo.
- Si `/spec-impl` **para** — estado distinto de Aprobado, spec no encontrado, ambigüedad sin
  resolver, el usuario dice que no —, **`/spec-impl-game` para también**. No se lanza ningún agente.
  El bloqueo es intencional, no lo rodees.
- Las pausas de confirmación por paso **se respetan**. No las saltes por tener prisa en llegar a
  los agentes.

El encadenamiento arranca **solo** cuando `/spec-impl` llega a su mensaje de cierre
("Todos los pasos del plan están implementados" / "All steps of the plan are implemented").

---

### Fase 2 — Resolver el `gameId` (la guarda)

Los dos agentes trabajan sobre **un id del registry**, así que antes de tocarlos hay que tenerlo.

1. Mira qué entró en `lib/games/registry.ts`: compáralo con la foto previa del Contexto de sesión,
   o con `git diff master --unified=0 -- lib/games/registry.ts`.
2. El `gameId` es la **clave** del mapa, **no** el nombre del directorio. Hoy:
   `asteroides` → `asteroids/`, `caida` → `tetris/`, `bloque-buster` → `arkanoid/`,
   `serpentina` → `snake/`. Confundirlos hace que los dos agentes paren en su Fase 1.
3. Según lo que encuentres:

   | Claves nuevas | Acción                                                                      |
   | ------------- | --------------------------------------------------------------------------- |
   | Exactamente 1 | Ese es el `gameId`. Continúa a la Fase 3.                                   |
   | Varias        | Pregunta al usuario cuál portar — los dos agentes son un juego por corrida. |
   | Ninguna       | **Para.** Muestra el aviso de abajo y no encadenes.                         |

**Aviso cuando no hay id nuevo:**

```
⚠️ El spec se implementó, pero no añadió ningún id nuevo a lib/games/registry.ts.

@skin-designer y @mobile-porter trabajan sobre un id del registry, así que no hay
nada que encadenar. Revisa el spec, o dame el id manualmente si ya existía.
```

**No inventes un id** ni lo deduzcas del nombre del spec. Que el spec se llame
`NN-<slug>-jugable.md` es una señal útil, no un criterio: la guarda real es el registry.

---

### Fase 3 — `@skin-designer` (primero, y solo él)

Lanza `Task` con `subagent_type: "skin-designer"` en **un mensaje con una única llamada**, pasándole
el `gameId` de la Fase 2. En el prompt recuérdale su entregable: `clasico`, `neon` y `retro`
seleccionables en caliente, con `clasico` idéntico al look actual y `npm run lint` + `npm run build`
en verde.

**Espera a que termine antes de seguir.** Lanzar a `@mobile-porter` en el mismo mensaje está
prohibido: los dos escriben en `components/GamePlayer.tsx` (el selector de skin frente a los stats
del HUD) y en `app/globals.css` (`.skin-select` vive dentro del mismo `@media (pointer: coarse)`
que toca el porter). En paralelo se pisan y el resultado es un merge silenciosamente roto.

Si cierra en rojo o parcial: **anótalo y continúa** a la Fase 4 igualmente. El fallo se reporta en
la Fase 5, no se esconde.

---

### Fase 4 — `@mobile-porter` (después, y solo él)

**Solo tras la notificación de cierre de la Fase 3.** Lanza `Task` con
`subagent_type: "mobile-porter"` y el **mismo** `gameId`.

En el prompt recuérdale dos cosas que se le atragantan:

- Verifica con un **contexto táctil real de Playwright** (`hasTouch: true`, `isMobile: true`), no
  con `browser_resize`: `(pointer: coarse)` no se activa redimensionando y la verificación daría un
  falso negativo.
- Necesita `npm run dev` levantado y `.env.local` con las variables de Supabase; sin base de datos
  no hay `/game/<id>/play`.

---

### Fase 5 — Reporte final consolidado

```
✅ /spec-impl-game — <NN-slug>

Spec:    specs/<NN-slug>.md   (recuerda cambiar su estado a "Implementado")
Rama:    spec-<NN-slug>
Juego:   <gameId>  →  lib/games/<dir>/

  [✓/✗] Implementación   — <resumen de /spec-impl>
  [✓/✗] @skin-designer   — clasico, neon, retro · references/skins-status.md
  [✓/✗] @mobile-porter   — cruceta <…> · A <…> · B <…> · references/mobile-status.md

Pendiente: <lo que quedó en rojo, o "nada">
```

Cierra recordando lo que sigue siendo del humano: verificar los criterios de aceptación del spec
uno a uno, cambiar su estado a "Implementado" y hacer el commit final antes de mergear la rama.

---

## Reglas duras

- **Nunca en paralelo.** Un agente por mensaje. `@mobile-porter` no arranca hasta que
  `@skin-designer` haya notificado su cierre. Es la razón de ser de este comando; romperlo es un
  fallo.
- **No reimplementas `/spec-impl`.** Toda la lógica de spec —estado, rama, pasos, pausas— es del
  skill delegado. No la duplicas ni la contradices.
- **No inventas ids:** si no está en `lib/games/registry.ts`, no existe.
- **No escribes código de juego, ni skins, ni entradas de `PAD_MAPS` por tu cuenta.** Eso es
  trabajo de los agentes; tú orquestas.
- **Un juego por corrida.** Si el spec metió varios ids, preguntas cuál; no encadenas los dos
  agentes cuatro veces por iniciativa propia.
- **No escribes specs en `specs/`** — eso es de `/spec`, `/add-game` y `@game-jam`.

## Resumen del comportamiento esperado

```
/spec-impl-game 11-nave-nodriza-jugable   (estado: Aprobado)

  Fase 1  →  Skill(spec-impl, "11-nave-nodriza-jugable")
             rama spec-11-nave-nodriza-jugable, implementación paso a paso
  Fase 2  →  registry.ts gana la clave "nave-nodriza" → gameId = nave-nodriza
  Fase 3  →  Task(skin-designer, "nave-nodriza")   ← espera su cierre
  Fase 4  →  Task(mobile-porter, "nave-nodriza")   ← solo después
  Fase 5  →  Reporte consolidado de las tres etapas

/spec-impl-game 12-powerups   (estado: Borrador)

  Fase 1  →  /spec-impl lee el estado → "Borrador" → ❌ para
             Sin rama, sin código, sin agentes. Fin.

/spec-impl-game 13-tuning-hud   (Aprobado, pero no toca el registry)

  Fase 1  →  implementa el spec completo
  Fase 2  →  ninguna clave nueva → ⚠️ avisa y para sin encadenar
```

## Argumentos

`$ARGUMENTS` es el nombre del spec, y se pasa **tal cual** a `/spec-impl`, que ya sabe resolver el
nombre completo (`11-nave-nodriza-jugable`), solo el número (`11`) o solo el slug
(`nave-nodriza-jugable`). Si viene vacío, `/spec-impl` pedirá el nombre: no te adelantes a él.
