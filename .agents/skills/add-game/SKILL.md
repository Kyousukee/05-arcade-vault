---
name: add-game
description: Diseña el spec de un juego nuevo para Arcade Vault — portado a TypeScript sobre el contrato GameFactory, alta en el registry, fila en la tabla games de Supabase y verificación del leaderboard. Úsalo antes de añadir cualquier juego jugable a la plataforma.
disable-model-invocation: true
argument-hint: "<nombre del juego> (p. ej. tetris, o una carpeta de references/started-games)"
allowed-tools: Bash(ls:*), Bash(cat:*)
---

# /add-game — Diseñador de specs de juego + leaderboard

Este skill produce el spec de **un juego jugable** de Arcade Vault: el portado o diseño del
juego bajo el contrato `GameFactory`, su entrada en el registry, su fila en la tabla `games`
de Supabase y la verificación de que aparece en el leaderboard. **Aquí no escribes código.**
Tu trabajo termina cuando el archivo `specs/NN-<slug>-jugable.md` queda escrito en estado
`Borrador`. La implementación es de `/spec-impl`.

Tus respuestas van en el mismo idioma del prompt inicial.

## Contexto de sesión

Specs existentes:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "No existe references/started-games/"`

Registry actual:
!`cat lib/games/registry.ts 2>/dev/null || echo "No existe lib/games/registry.ts"`

---

## Flujo del comando

Sigue estas cuatro fases en orden estricto. **No avances a la siguiente fase si la anterior
no se completó correctamente.**

---

### Fase 1 — Reconocer el terreno

1. Lee el archivo de memoria del proyecto. Prueba en este orden y para en el primero que
   exista: `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `README.md`.
2. **Lee el skill `/spec` antes que nada más.** Abre `.claude/skills/spec/SKILL.md` y
   `.claude/skills/spec/template.md` (si no están ahí, prueba `.agents/skills/spec/`). `/spec`
   es el método canónico de este repo para escribir specs y **manda sobre este skill** en todo
   lo que sea forma del documento: fases, ritmo de preguntas, orden de secciones, estados
   válidos, reglas duras y tono. `/add-game` no lo reemplaza — lo **especializa** para el
   dominio "juego + leaderboard", aportando el inventario de la fuente, los bloques de
   preguntas del dominio y los criterios de aceptación de la plataforma. Si algo de este
   archivo contradice a `/spec`, gana `/spec` y lo señalas al usuario.
3. Lee `platform-contract.md` (en el mismo directorio que este skill). Es el mapa de rutas y
   contratos de la plataforma. **Verifica que los archivos que nombra siguen existiendo**
   antes de citarlos en el spec — el repo cambia, el documento no se actualiza solo.
4. Lee `template.md` (mismo directorio): es la plantilla de `/spec` sesgada a un spec de juego.
5. Lee los dos specs más recientes de `specs/` para heredar las convenciones de redacción.
6. Resuelve la **fuente** del juego. El argumento recibido es: `$ARGUMENTS`

| Situación                                                               | Modo           | Qué haces                                                                      |
| ----------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| `$ARGUMENTS` coincide con una carpeta de `references/started-games/`    | **Portado**    | Inventario de la fuente (abajo) antes de preguntar nada                        |
| `$ARGUMENTS` nombra un juego que no está en `references/started-games/` | **Desde cero** | El spec describirá la mecánica completa antes del plan                         |
| `$ARGUMENTS` vacío                                                      | —              | Muestra los juegos de referencia disponibles y pregunta cuál es. Para y espera |
| Coincidencia dudosa (`tetris` vs `03-tetris`, varios candidatos)        | —              | Pregunta cuál. **No adivines**                                                 |

**Inventario obligatorio en modo portado.** Lee `game.js` y sus acompañantes (`levels.js`,
`assets/*`, `index.html`, `style.css`) y anota, porque cada punto se convierte en una
decisión del spec:

- Variables globales de módulo que hacen de estado de partida.
- Tamaño de canvas y relación de aspecto cableada.
- HUD: ¿en DOM (`textContent`) o dibujado en el canvas?
- Overlays de fin de partida y menús en HTML.
- Assets externos: imágenes, spritesheets, audio.
- Listeners de teclado/ratón y cualquier `preventDefault`.
- Constantes de geometría cableadas a píxeles absolutos.

Resume el inventario al usuario antes de pasar a la Fase 2. Es la base de todas las preguntas.

---

### Fase 2 — Preguntar en bloques

Esta es la fase que decide la calidad del spec. Tu trabajo es **detectar ambigüedades y
preguntar**, no suponer. Pregunta en bloques de 3 a 5 preguntas y espera respuesta antes de
seguir. Numera las preguntas y ofrece 2–4 opciones concretas cuando las haya, marcando tu
recomendación y por qué.

**Bloques obligatorios. No se salta ninguno:**

1. **Identidad del juego.** `id` (slug en minúsculas: es a la vez la ruta pública
   `/game/<id>`, la clave del registry y la PK de `games` — los tres deben coincidir),
   `title`, `cat` (`ARCADE` | `PUZZLE` | `SHOOTER` | `VERSUS`), `color` (`cyan` | `magenta` |
   `green` | `yellow`), textos `short` y `long`, y la portada: ¿reusar una clase `cover-*`
   existente o crear una nueva en `app/globals.css`?

2. **Mapeo al `GameState`.** El contrato publica hoy `score`, `lives`, `level`, `phase` y
   `tripleShot`. Si el juego tiene métricas que no encajan (líneas de Tetris, un juego sin
   vidas, otro tipo de power-up), decide: (a) mapear a lo más cercano, (b) extender
   `GameState` con campos **opcionales** y añadir el `hud-stat` correspondiente en
   `components/GamePlayer.tsx`, o (c) no publicar ese dato. Recomienda (b): no rompe
   Asteroides y el HUD ya es una lista de stats.

3. **Canvas y responsive.** El CRT es 4:3 fijo (`.crt-screen`). Si el juego original es de
   otra relación (Tetris 300×600) o tiene geometría cableada a 800×600 (Arkanoid), decide:
   letterbox dentro del 4:3, rediseño proporcional al área lógica, o relación propia con
   cambio en `app/globals.css`. Recuerda que el patrón de Asteroides recalcula `w`/`h` con
   `devicePixelRatio` y reescala las entidades en cada resize.

4. **Assets y sonido.** Imágenes, spritesheets y audio pasan a `public/`. Define las rutas y
   si el sonido entra en este spec o se difiere.

5. **Controles y ciclo de partida.** Teclas, qué teclas necesitan `preventDefault`, si `P` y
   `Escape` alternan pausa, si hay overlay `GAME OVER` en canvas antes del modal de la
   plataforma, qué reinicia exactamente `restart()`, y qué pasa en viewports sin teclado.

6. **Datos y leaderboard.** `sort_order` de la fila nueva en `games`, `playable = true`, y la
   confirmación de que arranca **sin puntajes sembrados** (los juegos reales solo acumulan
   partidas reales) y de que el Hall of Fame muestra su estado vacío.

7. **Fuera de scope.** Qué queda explícitamente fuera: táctil en móvil, tests, repintado con
   la paleta del vault, otros juegos de la carpeta de referencias.

**Cuándo dejar de preguntar.** Cuando puedas responder estas tres sin suponer nada:

1. ¿Qué archivos aparecen o cambian?
2. ¿Cuál es el primer paso ejecutable y cuál el último?
3. ¿Cómo verifico que el juego está terminado e integrado?

Si te falta una, sigue preguntando.

---

### Fase 3 — Redactar el spec sección por sección

Aplica aquí la Fase 3 de `/spec` — es el mismo procedimiento, con las secciones ya sesgadas al
dominio del juego. **No generes el spec completo de una vez.** Sigue `template.md` (mismo
directorio, y a su vez derivado de `.claude/skills/spec/template.md`), que define para cada
sección su propósito, su ejemplo y sus anti-patrones (`❌` / `✅`) y desarrolla **una sección
por mensaje**, en este orden:

`Cabecera` → `Alcance` → `Modelo de datos` → `Plan de implementación` →
`Criterios de aceptación` → `Decisiones tomadas y descartadas` → `Riesgos identificados`

Es el mismo orden estricto de `/spec`. Los errores que `/spec` marca como típicos siguen
valiendo aquí: criterios no verificables, pasos del plan que no están en el alcance, nombres de
archivo asumidos sin confirmar, y omitir la sección de decisiones.

Después de cada sección: muéstrala formateada, pregunta «¿Esta sección queda así o la
ajustamos?», aplica los cambios que pidan y solo entonces pasa a la siguiente.

---

### Fase 4 — Guardar y parar

1. Calcula el número secuencial mirando `specs/`.
2. Propón el nombre `specs/NN-<slug>-jugable.md` y **confírmalo antes de escribir**.
3. Escribe el archivo con las secciones aprobadas.
4. Estado `Borrador`. `Depende de:` incluye siempre `05-asteroides-jugable` y
   `06-juegos-y-leaderboard`.
5. Convención de estados y de nombre de archivo: las de `/spec`. Si `specs/.spec-config.yml`
   existe, **no lo toques**; si no existe, créalo con el contenido por defecto que indica la
   Fase 4 de `/spec` — lo usa después `/spec-impl` para decidir si crea la rama.
6. Muestra este bloque:

```
✅ Spec creado: specs/NN-<slug>-jugable.md

Estado: Borrador. Reléelo y cámbialo a "Aprobado" tú mismo.
Siguiente paso: /spec-impl NN-<slug>-jugable
```

6. **Para ahí.** No propongas implementarlo, no escribas código, no apliques migraciones.

---

## Reglas duras

- **Nunca escribes el spec sin haber leído antes `/spec`.** `.claude/skills/spec/SKILL.md` y su
  `template.md` son el método del repo; este skill solo lo especializa. Si no encuentras esos
  archivos, dilo al usuario y sigue con `template.md` local, pero avisa de que estás sin la
  referencia canónica.
- **Nunca escribes código de juego en este comando.** Solo el `.md` del spec al final.
- **Nunca tocas Supabase.** La migración `add_game_<id>` se **describe** como paso del plan;
  la aplica `/spec-impl` con `mcp__supabase__apply_migration`.
- **Nunca marcas el spec como Aprobado.** Ese cambio lo hace el humano tras releerlo.
- **Nunca omites la parte de plataforma.** Un juego sin su fila en `games` no aparece en Home,
  Biblioteca, `/game/<id>` ni Hall of Fame: el spec cubre siempre juego **y** integración.
- **Nunca aceptas copiar el `game.js` original casi intacto.** Los globals de módulo impiden
  dos instancias y duplican el loop bajo React Strict Mode. El spec exige estado por instancia,
  como `lib/games/asteroids/game.ts`.
- **Si el juego no cabe en el contrato actual**, el spec debe incluir explícitamente los
  cambios a `lib/games/types.ts` y `components/GamePlayer.tsx`. No se improvisan durante la
  implementación.
- **Si el usuario quiere saltarse la Fase 2**, recuérdale: «Las preguntas ahora ahorran horas
  después. ¿Seguro que las saltamos?». Si insiste, respétalo y déjalo anotado en la sección de
  decisiones («Definición rápida sin fase de preguntas»).
- **Si el juego es demasiado grande** (multijugador, editor de niveles, progresión guardada),
  propón partirlo: este spec deja el juego jugable con leaderboard, el resto va a otro spec.

---

## Tono al preguntar

Directo y concreto. No te disculpes por preguntar — el usuario invocó el skill precisamente
para eso. Una pregunta por línea, numeradas.

Ejemplo de bloque bien formado:

> Antes del modelo de datos necesito cerrar tres cosas del portado de Tetris:
>
> 1. **HUD.** El original escribe en `#score` / `#lines` / `#level` del DOM. `GameState` no
>    tiene `lines`. Opciones: (a) publicar `lines` como campo opcional nuevo y añadir un
>    `hud-stat`, (b) mostrar líneas en el hueco de `lives`. Recomiendo (a): explícito y no
>    rompe Asteroides.
> 2. **Relación de aspecto.** El tablero es 300×600 (1:2) y el CRT es 4:3. ¿Letterbox con el
>    tablero centrado y la pieza siguiente a un lado, o rediseño del tablero al área 4:3?
> 3. **Overlay de fin.** El original usa un `#overlay` HTML con botón REINICIAR. ¿Lo pasamos a
>    overlay dibujado en canvas (como Asteroides) y dejamos el reinicio al modal de la
>    plataforma?

---

## Argumentos

Si el usuario invoca `/add-game tetris`, usa `tetris` para resolver la fuente contra
`references/started-games/` y como sugerencia inicial de slug — pero confirma el `id`
definitivo en el bloque de identidad de la Fase 2.

Si invoca `/add-game` sin argumentos, muestra los juegos de referencia disponibles y pregunta
cuál es el juego, o si se diseña uno desde cero.

---

## Resumen del comportamiento esperado

```
/add-game tetris

  Fase 1  →  Lee /spec (SKILL.md + template.md) y platform-contract.md
             Encuentra references/started-games/03-tetris → modo portado
             Inventario: HUD en DOM, overlay HTML, canvas 300×600, globals de módulo
  Fase 2  →  Bloques de preguntas: identidad, mapeo de `lines`, aspecto, controles, scope
  Fase 3  →  Siete secciones, una por mensaje, con confirmación
  Fase 4  →  Escribe specs/07-tetris-jugable.md en estado Borrador y para

/add-game snake   (no está en references/started-games/)

  Fase 1  →  Modo desde cero
  Fase 2  →  Además de los bloques normales, pide la mecánica completa antes del plan
  Fase 3  →  Igual, con la mecánica descrita en el modelo de datos
  Fase 4  →  Escribe el spec en Borrador y para
```
