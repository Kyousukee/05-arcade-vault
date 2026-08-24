# Plantilla del spec de un juego jugable

Referencia que el skill `/add-game` consulta al redactar. Cada sección lleva su propósito, un
ejemplo mínimo y sus anti-patrones. **No es texto para copiar literalmente** — es la forma que
el spec debe respetar. Los specs `05-asteroides-jugable.md` y `06-juegos-y-leaderboard.md` son
los ejemplares de referencia del repo.

**Esta plantilla es una especialización de `.claude/skills/spec/template.md`, no un
reemplazo.** Léela después de aquella: la genérica manda en la forma del documento (estados,
regla del objetivo en una frase, alcance con su "fuera de scope", criterios booleanos, sección
de decisiones obligatoria); esta solo rellena esas secciones con lo propio de un juego. Ante
cualquier discrepancia, gana la plantilla de `/spec`.

---

## Cabecera

```markdown
# Spec NN — <Juego> jugable

**Estado:** borrador
**Depende de:** 05-asteroides-jugable, 06-juegos-y-leaderboard
**Fecha:** YYYY-MM-DD

**Objetivo:** Portar <juego> de `references/started-games/<carpeta>` a TypeScript bajo el
contrato `GameFactory`, registrarlo como `<id>` y darlo de alta en `games` para que compita en
el leaderboard.
```

Estados válidos: `borrador`, `en revisión`, `aprobado`, `implementado`, `obsoleto`. El spec se
escribe siempre en `borrador`.

**Regla del objetivo:** una sola frase. Si necesitas dos, el spec es demasiado grande — parte
el juego del resto.

---

## Sección 1 — Alcance

Tres bloques. Los tres son obligatorios.

```markdown
## Scope

**Incluye:**

- Portado a TypeScript de `<fuente>` a `lib/games/<carpeta>/` (`constants.ts`, `entities.ts`,
  `game.ts`), sin globals de módulo.
- Entrada `<id>` en `GAME_REGISTRY` con `import()` dinámico.
- Migración `add_game_<id>`: fila en `public.games` con `playable = true`, sin puntajes.
- <cambios en HUD / GameState / globals.css, si los hay>
- Verificación: `npm run lint`, `npm run build` y prueba manual en navegador.

**NO incluye (fuera de este spec):**

- Controles táctiles para móvil — solo teclado, con aviso en viewports pequeños.
- <lo que se difirió durante las preguntas>

**Consecuencias aceptadas de este scope:**

- <lo que queda peor a propósito, y por qué se acepta>
```

**Por qué importa el "NO incluye":** recoge lo que salió en la fase de preguntas y se decidió
aplazar. Sin ese registro, durante la implementación aparece la tentación de colarlo «ya que
estamos».

---

## Sección 2 — Modelo de datos

Estructuras reales con nombres reales, no pseudocódigo. Para un juego siempre son estas tres,
más las que el juego añada:

1. **Estado interno del juego** — la interfaz `runtime` que sustituye a los globals del
   original. Lista los campos con su tipo, incluidas las dimensiones lógicas `w`/`h`.
2. **Mapeo al `GameState`** — qué campo del juego alimenta `score`, `lives`, `level`, `phase`.
   Si hace falta extender el contrato, muestra el `types.ts` resultante con los campos nuevos
   **opcionales**, y di qué `hud-stat` se añade en `components/GamePlayer.tsx`.
3. **Entrada en el registry y fila en `games`** — la línea del `GAME_REGISTRY` y el `insert`
   completo con los valores literales (nada de `<placeholder>` en el spec final).

Ejemplo del bloque de la migración dentro del spec:

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order)
values ('tetris', 'TETRIS', '...', '...', 'PUZZLE', 'cover-tetro', 'magenta', true, 9);
```

Acompáñalo de una línea explícita: sin filas en `scores`, el juego arranca vacío y solo acumula
partidas reales.

Si el juego se diseña desde cero, esta sección incluye además **la mecánica**: entidades,
reglas de puntuación, condición de fin y progresión de nivel.

---

## Sección 3 — Plan de implementación

Pasos numerados. **Cada paso deja el sistema compilando** — nada de «paso 4: que todo funcione».
Orden canónico de un juego (ajústalo, no lo inventes de nuevo):

1. Consultar la doc vendored en `node_modules/next/dist/docs/` antes de escribir código.
2. Constantes y utilidades en `lib/games/<carpeta>/constants.ts`.
3. Entidades tipadas con `update(dt, w, h)` y `draw(ctx)`, sin globals.
4. La factory `create<Nombre>Game` con el estado en el objeto `runtime` y el loop `rAF`.
5. Pausa (`P` / `Escape`) reseteando `lastTime` al reanudar.
6. Fin de partida: overlay en canvas y un único `onGameOver`.
7. Canvas responsive con `ResizeObserver` + `devicePixelRatio` y reescalado de entidades.
8. Publicación de `onState` a ~10 Hz más emisión inmediata en cambios de fase/vidas/nivel.
9. Entrada en `GAME_REGISTRY`.
10. Migración `add_game_<id>` con `mcp__supabase__apply_migration` y verificación con
    `mcp__supabase__execute_sql`.
11. Ajustes de HUD (`GamePlayer.tsx`) y estilos (`app/globals.css`) si el juego los necesita.
12. Verificación: lint, build y prueba manual del recorrido completo.

**Errores a evitar:** meter en el plan cosas que no están en el alcance; asumir nombres de
archivo que el usuario no confirmó; dejar un paso que rompe el build hasta el siguiente.

---

## Sección 4 — Criterios de aceptación

Checklist booleana, verificable a mano. Nada aspiracional.

❌ «Que el juego se sienta bien» → no verificable.
✅ «`/game/tetris/play` monta un `<canvas>` dentro del CRT y las flechas mueven la pieza» →
booleano.

Bloques obligatorios en todo spec de juego:

```markdown
- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] `lib/games/<carpeta>/` no tiene variables de módulo mutables: dos instancias coexisten.
- [ ] `/game/<id>/play` monta un `<canvas>` en el CRT y responde a <controles>.
- [ ] El HUD muestra los valores del juego (no del simulador falso) y se actualizan al <evento>.
- [ ] `PAUSA` congela la partida y `REANUDAR` continúa sin salto de posición (sin `dt` acumulado);
      `P` y `Escape` alternan igual que el botón.
- [ ] `FIN` termina la partida y abre el modal con el puntaje actual.
- [ ] Al perder, el canvas muestra el overlay GAME OVER y después aparece el modal.
- [ ] Guardar en el modal hace `POST /api/scores` y devuelve el puesto obtenido.
- [ ] `select count(*) from games` = <n> y la fila `<id>` tiene `playable = true`.
- [ ] El juego aparece en Home, Biblioteca, `/game/<id>` y en su pestaña del Hall of Fame;
      antes de la primera partida esa pestaña muestra el estado vacío sin romper.
- [ ] Redimensionar durante la partida mantiene la relación y no expulsa entidades del área.
- [ ] El canvas se ve nítido con `devicePixelRatio > 1`.
- [ ] Las teclas de juego no scrollean la página, y vuelven a hacerlo al salir de la ruta.
- [ ] `SALIR` o navegar fuera detiene el loop y quita listeners; volver a entrar no lo duplica
      (verificado en dev con React Strict Mode).
- [ ] Los demás juegos siguen mostrando el simulador falso sin cambios.
```

---

## Sección 5 — Decisiones tomadas y descartadas

Una viñeta por decisión, en negrita la decisión y a continuación **qué se descartó y por qué**.
Es la sección de más valor a largo plazo: explica por qué el código es como es.

```markdown
- **Rediseño proporcional del tablero en vez de letterbox.** Se descarta el letterbox porque
  dejaría dos franjas negras del 25 % del CRT; el coste es recalibrar las constantes de caída.
```

Marca explícitamente las decisiones que vinieron del usuario («decisión explícita del
usuario»), para que nadie las reabra en la implementación.

---

## Sección 6 — Riesgos identificados

Solo riesgos reales, cada uno con su mitigación (o con «riesgo residual aceptado»). Estos
cuatro se repiten en todo portado y conviene revisarlos siempre:

- **El canvas responsive altera el balance.** La física original está calibrada en píxeles para
  un tamaño fijo. Mitigación: relación de aspecto fija y constantes proporcionales al área.
- **El reescalado al redimensionar deja entidades en estado inválido** (solapamientos, muertes
  por un resize). Mitigación: verificar el redimensionado en la prueba manual.
- **React Strict Mode monta dos veces en dev.** Si `destroy()` no cancela el `rAF`, los
  listeners y el `ResizeObserver`, quedan dos loops. Mitigación: criterio de aceptación propio.
- **`preventDefault` global secuestra el teclado.** Si el listener sobrevive a la ruta o captura
  el input del modal, el usuario no puede escribir. Mitigación: listener atado a la instancia y
  bypass en campos de formulario.

---

## Reglas globales del documento

- Todo el spec en el idioma del proyecto (aquí, español).
- Nombres de archivo, símbolos y rutas reales — nada de `<placeholder>` en el spec final.
- Un spec = un juego. Si aparecen dos, son dos specs.
- La sección de decisiones nunca se omite, aunque sea corta.
- El spec se guarda en `borrador`: aprobarlo es acto humano.
