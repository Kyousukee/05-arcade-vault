# TODO de sugerencias de juegos — Arcade Vault

Memoria de `@game-planner`. Actualizado: 2026-08-27.
Estados: **Sugerido** · **Aprobado** · **Implementado** · **Descartado**.
No borrar filas: solo cambiar el estado. El detalle de cada sugerencia va abajo.

| Estado       | Juego         | id              | Cat     | Score            | Esfuerzo | Fecha      | Notas                                                     |
| ------------ | ------------- | --------------- | ------- | ---------------- | -------- | ---------- | --------------------------------------------------------- |
| Implementado | ASTEROIDES    | `asteroides`    | SHOOTER | puntos           | —        | 2026-08-26 | Portado de `02-asteroids`                                  |
| Implementado | CAÍDA         | `caida`         | PUZZLE  | puntos + líneas  | —        | 2026-08-26 | Portado de `03-tetris`                                     |
| Implementado | BLOQUE BUSTER | `bloque-buster` | ARCADE  | puntos           | —        | 2026-08-26 | Portado de `04-arkanoid`                                   |
| Implementado | SERPENTINA    | `serpentina`    | ARCADE  | puntos + frutas  | —        | 2026-08-26 | Desde cero                                                 |
| Sugerido     | INVASORES     | `invasores`     | SHOOTER | puntos           | M        | 2026-08-27 | Fila ya existe en `games` (playable=false); solo flip + módulo |
| Descartado   | GLOTÓN        | `gloton`        | ARCADE  | puntos           | L        | 2026-08-27 | Esfuerzo L: laberinto + 4 IAs de fantasma; aplazado, no muerto |
| Descartado   | RANARIA       | `ranaria`       | ARCADE  | puntos + tiempo  | M        | 2026-08-27 | Exige campo opcional nuevo en `GameState` (temporizador) + HUD |
| Descartado   | DUELO PIXEL   | `duelo-pixel`   | VERSUS  | rallies          | M        | 2026-08-27 | 2 jugadores locales rompen "un score = un jugador"          |

## Detalle

### INVASORES — Sugerido

- **id / cat / color:** `invasores` / SHOOTER / green (portada `cover-invaders`, ya existe en `globals.css`).
- **Mecánica:** cañón que se mueve en horizontal por la base y dispara hacia arriba; una formación
  de alienígenas desciende en zigzag, acelera al morir sus miembros y suelta bombas sobre búnkeres destructibles.
- **Por qué encaja:** SHOOTER solo tiene Asteroides (vuelo libre vectorial), así que el shooter fijo de
  formación es un hueco real de mecánica y no un duplicado. Cabe tal cual en el contrato: `score`, `lives`,
  `level` (= oleada) y `phase` bastan, sin campos nuevos ni tocar `GamePlayer.tsx`. Score entero, monótono,
  acumulativo por alien derribado + OVNI bonus, partida de 2–5 min y muy rejugable.
- **Riesgos:** balance calibrado en píxeles que se rompe con el canvas responsive (usar coordenadas
  normalizadas al alto del canvas); estado de la formación por instancia, nada de globals de módulo
  (Strict Mode duplicaría el loop); `destroy()` idempotente que quite listeners de teclado y el
  ResizeObserver; búnkeres destructibles por celdas (no por píxel) para no pagar un canvas offscreen.
- **Decisión:** **recomendado**. Máximo valor de catálogo por unidad de esfuerzo; la fila ya está sembrada
  en Supabase, así que el alta se reduce a `playable = true`.

### GLOTÓN — Descartado (aplazado)

- **id / cat / color:** `gloton` / ARCADE / yellow (portada `cover-glot`).
- **Mecánica:** laberinto con puntos coleccionables, cuatro fantasmas con personalidad propia y
  píldoras que invierten la persecución durante unos segundos.
- **Por qué encaja:** cubre el hueco de maze-chase y es el título más reconocible del catálogo pendiente.
  Score entero y monótono, encaje perfecto con el leaderboard.
- **Riesgos:** esfuerzo L — mapa de tiles, pathfinding/scatter-chase de cuatro IAs distintas, estados
  de píldora y túneles laterales. El laberinto clásico es 28×31 (casi 1:1) y hay que recomponerlo para 4:3.
- **Decisión:** descartado **por ahora** por esfuerzo; reabrir cuando haya presupuesto para un juego grande.

### RANARIA — Descartado

- **id / cat / color:** `ranaria` / ARCADE / green (portada `cover-rana`).
- **Mecánica:** cruzar carriles de coches y un río de troncos a la deriva hasta los nenúfares,
  contra reloj.
- **Por qué encaja:** mecánica de carriles inédita en el catálogo y esfuerzo medio.
- **Riesgos:** el tiempo restante es parte del HUD y **no existe en `GameState`**: exigiría un campo
  opcional nuevo (`timeLeft`) más su render en `GamePlayer.tsx`, es decir tocar el contrato en el mismo
  PR que el juego. Además el score es de saltos/llegadas y es el menos "acumulativo" de los tres.
- **Decisión:** descartado frente a Invasores por coste de contrato; buen candidato cuando toque
  ampliar `GameState`.

### DUELO PIXEL — Descartado

- **id / cat / color:** `duelo-pixel` / VERSUS / cyan (portada `cover-duelo`).
- **Mecánica:** dos paletas verticales, una pelota; CPU o dos jugadores locales.
- **Por qué encaja:** VERSUS es la única categoría sin ningún juego jugable.
- **Riesgos:** el modo a dos locales rompe la premisa del leaderboard ("un score = un jugador") y el
  score natural (partida a N tantos) no es monótono ni comparable entre partidas; habría que inventar
  una métrica (rallies sobrevividos vs CPU) que desvirtúa el juego prometido en su descripción.
- **Decisión:** descartado por encaje con el leaderboard, no por dificultad técnica.

### PLANTILLA — estado

- **id / cat / color:** `slug` / CAT / color
- **Mecánica:** dos líneas como mucho.
- **Por qué encaja:** hueco de catálogo · viabilidad en el contrato · encaje con el leaderboard.
- **Riesgos:** técnicos y de diseño.
- **Decisión:** recomendado / descartado por X.

## Lote 2026-08-27 — 20 candidatos (barrido por categoría)

Generado por `@game-planner` en 4 pasadas paralelas (una por `cat`). Todos son ids **nuevos**:
requieren `insert` propio en `games` + clase `cover-*` nueva en `globals.css`. Ninguno colisiona
con el registry ni con las filas ya sembradas. Estado inicial: **Sugerido** (cola, por detrás de
`invasores`). Orden dentro de cada categoría = ranking del análisis.

| # | Estado | Juego | id | Cat | Color | Score | Viabilidad | Esf. | Riesgo principal |
| -- | -------- | ------------- | -------------- | ------- | ------- | -------------------------------------- | ------------------------------ | ---- | ---------------------------------------------------- |
| 1 | Sugerido | SALTATORRE | `saltatorre` | ARCADE | green | altura máx. en metros | encaja tal cual | S | resize deja al jugador fuera de plataformas |
| 2 | Sugerido | ALUNIZAJE | `alunizaje` | ARCADE | cyan | pts/aterrizaje + bonus combustible | opcional `fuel?` si va al HUD | M | tuning gravedad/empuje en px vs canvas responsive |
| 3 | Sugerido | ESCALADOR | `escalador` | ARCADE | yellow | barriles + bonus de tiempo | encaja tal cual | L | colisión plataforma/escalera, tunneling con `dt` |
| 4 | Sugerido | APILADOR | `apilador` | ARCADE | magenta | pisos × multiplicador de precisión | encaja tal cual | S | mecánica delgada, se agota rápido |
| 5 | Sugerido | EXCAVADOR | `excavador` | ARCADE | yellow | enemigos × profundidad de capa | encaja tal cual | L | terreno destructible + pathfinding (perfil GLOTÓN) |
| 6 | Sugerido | BURBUJAS | `burbujas` | PUZZLE | magenta | clúster + desprendimientos, ×combo | encaja tal cual | M | rejilla hexagonal y snap tras redimensionar |
| 7 | Sugerido | DUPLICA | `duplica` | PUZZLE | yellow | suma de todas las fusiones | encaja tal cual | S | sin loop de acción; input durante animación |
| 8 | Sugerido | TUBERÍAS | `tuberias` | PUZZLE | cyan | celdas recorridas × nivel | opcional `distance?` deseable | M | motor de flujo (BFS de conectores) + input de ratón |
| 9 | Sugerido | MINADO | `minado` | PUZZLE | green | celdas despejadas + tablero limpio | encaja tal cual | M | solo ratón: `contextmenu` y `pointer: coarse` |
| 10 | Sugerido | SECUENCIA | `secuencia` | PUZZLE | magenta | ronda máxima alcanzada | encaja tal cual | S | score de rango 5–25 → empates en el leaderboard |
| 11 | Sugerido | CIEMPIÉS | `ciempies` | SHOOTER | green | segmentos + hongos + arañas | encaja tal cual | M | rejilla de hongos vs canvas responsive/DPR |
| 12 | Sugerido | ESCUADRÓN | `escuadron` | SHOOTER | cyan | pts acumulados por oleada | encaja tal cual (usa `tripleShot`) | M | volumen de contenido: patrones de oleada y jefe |
| 13 | Sugerido | MISIL CERO | `misil-cero` | SHOOTER | yellow | interceptaciones + ciudades salvadas | encaja tal cual (`lives`=ciudades) | M | primer input de puntero de la plataforma (DPR/rect) |
| 14 | Sugerido | TÚNEL NEÓN | `tunel-neon` | SHOOTER | magenta | enemigos + bonus de nivel | encaja tal cual | M/L | proyección radial del tubo: estimación incierta |
| 15 | Sugerido | ARENA NEÓN | `arena-neon` | SHOOTER | yellow | robots + humanos rescatados | opcional `saved?` para el HUD | M | twin-stick WASD+flechas choca con `BLOCKED_KEYS` |
| 16 | Sugerido | TANQUES | `tanques` | VERSUS | green | 100/tanque + bonus de oleada | encaja tal cual | M | balas con rebote: colisión por barrido, no por frame |
| 17 | Sugerido | EMPUJE | `empuje` | VERSUS | magenta | 250/expulsión + segundos restantes | encaja tal cual | M | curva de IA: torpe se autoexpulsa, perfecta invencible |
| 18 | Sugerido | PISTOLERO | `pistolero` | VERSUS | yellow | pts/duelo × bonus de reacción | encaja tal cual | S | poca profundidad; latencia de input falsea la reacción |
| 19 | Sugerido | CUATRO EN RAYA | `cuatro-raya` | VERSUS | cyan | 1000 × racha, IA de profundidad creciente | encaja tal cual | M | minimax bloquea el hilo: trocear entre frames |
| 20 | Sugerido | DERRAPE | `derrape` | VERSUS | yellow | metros + 500/adelantamiento | opcional `distance?` | L | coche + IA de trazada + pista procedural (3 subsistemas) |

### Regla VERSUS (aplica a 16–20)

Ninguno es "partida a N tantos". Los cinco son **gauntlet de un jugador contra CPU**: el rival no
puntúa, solo mata; el score es un acumulador entero que nunca se resetea entre rivales y la partida
acaba cuando el humano agota `lives`. Así se cumple "un score = un jugador" por construcción — que
es exactamente lo que hundió a `duelo-pixel` con su 2P local.

### Cabezas de cola por categoría

- **ARCADE:** SALTATORRE (S, sin tocar contrato, score monótono; el equivalente a lo que fue `serpentina`).
- **PUZZLE:** BURBUJAS (mejor valor/esfuerzo; PUZZLE solo tiene `caida`).
- **SHOOTER:** CIEMPIÉS (entra detrás de `invasores`, ya `Sugerido`).
- **VERSUS:** TANQUES (abre la categoría vacía reutilizando el patrón de `asteroides`).

### Aplazados por esfuerzo L (reabrir con presupuesto de juego grande)

ESCALADOR, EXCAVADOR, DERRAPE — junto al ya aplazado GLOTÓN.

### Tocan el contrato (`GameState` + `GamePlayer.tsx`)

ALUNIZAJE (`fuel?`), TUBERÍAS (`distance?`), ARENA NEÓN (`saved?`), DERRAPE (`distance?`) — mismo
coste que descartó a `ranaria`. Todos son evitables dibujando el stat dentro del canvas.
