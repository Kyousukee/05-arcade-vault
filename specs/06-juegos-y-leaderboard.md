# Spec 06 — Juegos y leaderboard en Supabase

**Estado:** aprobado
**Depende de:** 04-integracion-supabase, 05-asteroides-jugable
**Fecha:** 2026-08-23

**Objetivo:** Crear las tablas `games` y `scores` en Supabase con RLS y datos sembrados, convertirlas en la única fuente de verdad de Home, Biblioteca, `/game/[id]` y `/hall-of-fame`, y persistir los puntajes reales de Asteroides vía `POST /api/scores`.

> Reemplaza los mocks `GAMES` y `seededScores()` de `lib/data.ts` (spec 02) y sustituye `localStorage.av_scores` (spec 05) como almacén de puntajes. La identidad sigue siendo el login fake de `localStorage.av_user` — Supabase Auth queda para un spec posterior, pero `scores.user_id` se deja preparado.

## Scope

**Incluye:**

**Base de datos (Supabase, proyecto `tfyxzdctimnkrdnqtzfi`)**

- Migración `create_games_and_scores`: tablas `public.games` y `public.scores`, con RLS habilitado en ambas.
- Políticas: `select` público (rol `anon`) en `games` y `scores`; `insert` público en `scores` restringido por CHECKs; `games` sin `insert/update/delete` para `anon`.
- Migración de seed: los **9 juegos actuales** de `GAMES` tal cual (mismos `id`, `cover`, `color`, `cat`, textos) + ~12 puntajes de ejemplo por cada uno de los **8 mocks**, generados con los nombres de `PLAYERS`. `asteroides` arranca **sin puntajes** — solo recibe partidas reales.
- `lib/supabase/database.types.ts` generado del schema; `lib/supabase/client.ts` y `server.ts` pasan a `createBrowserClient<Database>` / `createServerClient<Database>`.

**Acceso a datos**

- `lib/queries.ts` (server-only): `getGames()`, `getGameById(id)`, `getTopScores(gameId, limit)`, `getAllTopScores(limit)` — cada juego con `best` = `max(score)` y `plays` = `count(scores)` derivados en la consulta.
- `POST /api/scores` (route handler): valida `game_id` existente, `score` entero `>= 0`, `player_name` 3–10 chars mayúsculas; inserta con el cliente server. Devuelve `201` con la fila, `400` en validación, `500` en fallo de Supabase.

**UI**

- `app/page.tsx` pasa a server component: carga juegos + top jugadores y los pasa como props a `components/Home.tsx`, que deja de importar `GAMES`/`seededScores` (ticker y `TOP_PLAYERS` dejan de ser constantes de módulo).
- `app/biblioteca/page.tsx` se parte en server page (fetch) + client component con los filtros actuales.
- `app/game/[id]/page.tsx` (server) lee juego y top 10 desde Supabase; `notFound()` si el id no existe en la tabla.
- `app/hall-of-fame/page.tsx` pasa a server page con `revalidate = 60` que carga los 9 juegos y su top 12 de una sola vez, y delega las pestañas + resaltado del usuario a un client component.
- Modal FIN de `/game/[id]/play`: input de nombre 3–10 chars (precargado con `av_user.name` si existe), botón GUARDAR que hace `POST /api/scores`, con estados _enviando_ / _guardado_ / _error con reintento_.

**Limpieza y verificación**

- `lib/data.ts` queda solo con `GameCategory`, `Game`, `ScoreRow`, `CATS`. Se eliminan `GAMES`, `PLAYERS` y `seededScores()`.
- Se elimina la escritura y lectura de `localStorage.av_scores`.
- README documenta las tablas y el endpoint.
- `npm run lint`, `npm run build` y prueba manual: jugar Asteroides, guardar puntaje, verlo en `/hall-of-fame` y en `/game/asteroides`.

**NO incluye (fuera de este spec):**

- **Supabase Auth.** El login sigue fake sobre `localStorage.av_user`; no hay `middleware.ts`, providers ni sesión real. `scores.user_id` se crea pero queda siempre `null`.
- **Antifraude.** Con `insert` público y sin auth, cualquiera puede postear un puntaje arbitrario con la publishable key. Se acepta conscientemente en esta etapa.
- **Panel de administración** para crear/editar juegos — la tabla `games` solo se modifica por migración.
- **Realtime** en el leaderboard: no hay actualización en vivo, solo `revalidate` de 60 s.
- **Paginación / histórico completo**: solo top N por juego; no hay vista "todos mis puntajes" ni perfil de jugador.
- **Un puntaje por jugador**: `scores` guarda cada partida como fila nueva; si un jugador aparece dos veces en el top, aparece dos veces (no se deduplica por nombre).
- **Migrar puntajes existentes de `localStorage.av_scores`** a Supabase — se descartan.
- **Retirar el mock `rocas`** ni consolidar juegos duplicados; los 9 se siembran tal cual.
- **Que los 8 juegos mock se vuelvan jugables** — siguen cayendo al simulador fake del spec 05.
- Tests automatizados (no hay test runner).

**Consecuencias aceptadas:**

- La app deja de funcionar sin Supabase: sin env vars o con el proyecto caído, Home, Biblioteca, detalle y Hall of Fame fallan al renderizar.
- Al inicio `asteroides` muestra una tabla vacía hasta que alguien juegue.

## Modelo de datos

### `public.games`

```sql
create table public.games (
  id          text primary key,               -- 'asteroides', 'bloque-buster', ...
  title       text not null,
  short       text not null,
  long        text not null,
  cat         text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover       text not null,                  -- clase CSS de portada: 'cover-rocas'
  color       text not null check (color in ('cyan','magenta','green','yellow')),
  playable    boolean not null default false, -- true solo para 'asteroides' (registry del spec 05)
  sort_order  int     not null default 0,     -- orden de las grillas; hoy el orden de GAMES
  created_at  timestamptz not null default now()
);
```

Se eliminan `best` y `plays` como columnas: ambos se derivan de `scores`. `plays` pasa de string decorativo (`"12.4K"`) a número real de partidas guardadas — la UI lo formatea.

### `public.scores`

```sql
create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id) on delete cascade,
  player_name text not null check (char_length(player_name) between 3 and 10),
  score       int  not null check (score >= 0),
  user_id     uuid references auth.users(id) on delete set null,  -- siempre null hasta el spec de auth
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at asc);
```

Desempate: a igual `score`, gana el más antiguo (`created_at asc`).

### RLS

```sql
alter table public.games  enable row level security;
alter table public.scores enable row level security;

create policy games_select_public  on public.games  for select to anon, authenticated using (true);
create policy scores_select_public on public.scores for select to anon, authenticated using (true);
create policy scores_insert_public on public.scores for insert to anon, authenticated with check (user_id is null);
```

Los límites de `score`, `player_name` y `game_id` los imponen los CHECKs y la FK, no la policy. `games` no lleva policies de escritura: sin policy, `anon` no puede insertar ni actualizar.

### Tipos de la aplicación — `lib/data.ts`

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: "cyan" | "magenta" | "green" | "yellow";
  playable: boolean;
  best: number; // derivado: max(score); 0 si no hay partidas
  plays: number; // derivado: count(scores)
}

export interface ScoreRow {
  rank: number; // calculado en la capa de consultas, no está en la tabla
  name: string;
  score: number;
  date: string; // dd/mm/yyyy, formateado desde created_at
}

export const CATS: ("TODOS" | GameCategory)[] = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
```

`Game.best`/`plays` cambian de tipo respecto de hoy (`plays` era `string`) y se suma `playable`. `ScoreRow` conserva su forma exacta para no tocar el JSX de las tablas.

### Contrato de `POST /api/scores`

```ts
// Request
{ "gameId": "asteroides", "playerName": "PX_KAI", "score": 12400 }

// 201
{ "id": "uuid", "rank": 3 }   // rank del puntaje recién insertado dentro de ese juego

// 400 → { "error": "playerName debe tener entre 3 y 10 caracteres" }
// 500 → { "error": "No se pudo guardar el puntaje" }
```

`playerName` se normaliza en el servidor: `trim()`, mayúsculas, recorte a 10.

### Seed

- `games`: los 9 registros actuales de `GAMES`, con `sort_order` 0–8 en el orden actual y `playable = true` solo en `asteroides`.
- `scores`: 12 filas por cada uno de los 8 juegos mock, con nombres tomados de la lista `PLAYERS` de hoy, puntajes en el rango que ya se veía en pantalla y `created_at` repartido en 2026. Valores literales en la migración (no aleatorios), para que el seed sea reproducible.

## Plan de implementación

1. **Consultar la doc vendored.** Antes de escribir código, revisar en `node_modules/next/dist/docs/`: `03-api-reference/03-file-conventions/route.md` (firma del route handler en Next 16.2.10), `03-api-reference/04-functions/` (`revalidate`, `notFound`) y la guía de fetching/caching para server components. No asumir la API de memoria.

2. **Migración de schema.** Aplicar `create_games_and_scores` con `mcp__supabase__apply_migration`: las dos tablas, el índice, RLS y las tres policies del modelo de datos. Verificar con `list_tables` y `get_advisors` (security) que no queda ninguna tabla sin RLS.

3. **Migración de seed.** Aplicar `seed_games_and_scores`: 9 filas en `games` (valores copiados literalmente del `GAMES` actual) y 96 filas en `scores` (12 × 8 mocks, `asteroides` vacío). Verificar con `execute_sql` que los counts son 9 y 96.

4. **Tipos generados.** Correr `mcp__supabase__generate_typescript_types` y guardar en `lib/supabase/database.types.ts`. Añadir el genérico `Database` en `lib/supabase/client.ts` y `lib/supabase/server.ts`. _Sistema funcional: build pasa, UI intacta sobre mocks._

5. **Capa de consultas.** Crear `lib/queries.ts` con `getGames()`, `getGameById(id)`, `getTopScores(gameId, limit)` y `getAllTopScores(limit)`, devolviendo los tipos `Game` / `ScoreRow` del modelo de datos (rank calculado, `created_at` formateado a `dd/mm/yyyy`). Sin consumidores todavía.

6. **`/game/[id]` (detalle) sobre Supabase.** Es el consumidor más simple y ya es server component: reemplazar `GAMES.find` por `getGameById` y `seededScores` por `getTopScores(id, 10)`; `notFound()` si el juego no existe. Verificar las 9 rutas en el navegador. _Primer corte real contra la base._

7. **Hall of Fame.** Convertir `app/hall-of-fame/page.tsx` en server component con `export const revalidate = 60`, cargando juegos + top 12 por juego con `getAllTopScores(12)`, y mover pestañas, podio, tabla y lectura de `av_user` a `components/HallOfFame.tsx` (client) que recibe todo por props. Estado vacío para `asteroides`: podio y tabla muestran un mensaje "SIN PARTIDAS REGISTRADAS" en vez de romper por `rows[0]` indefinido.

8. **Biblioteca.** Partir `app/biblioteca/page.tsx` en server page (`getGames()`) + `components/Biblioteca.tsx` client con los filtros, búsqueda y `GameCard` actuales, recibiendo `games: Game[]` por props.

9. **Home.** Convertir `app/page.tsx` en server component que llama `getGames()` y `getAllTopScores(5)`, y pasar los datos a `components/Home.tsx`. Dentro de `Home.tsx`, `TICKER`, `TOP_PLAYERS` y el contador de juegos dejan de ser constantes de módulo y pasan a derivarse de las props. Formatear `plays` numérico al estilo `12.4K`.

10. **Route handler `POST /api/scores`.** Crear `app/api/scores/route.ts`: parseo y validación del body (`gameId`, `playerName`, `score`), normalización del nombre, insert con el cliente server de `lib/supabase/server.ts`, cálculo del `rank` resultante y respuestas `201` / `400` / `500` según el contrato. Probar con `curl` antes de tocar la UI.

11. **Modal FIN del reproductor.** En `app/game/[id]/play/page.tsx`, sustituir `saveScore()` (`localStorage.av_scores`) por el `fetch` a `/api/scores`, con input de nombre 3–10 chars precargado desde `av_user`, botón deshabilitado mientras el nombre es inválido, y estados _enviando_ / _guardado (con rango)_ / _error con reintento_. Eliminar toda lectura y escritura de `av_scores`.

12. **Limpieza de `lib/data.ts`.** Borrar `GAMES`, `PLAYERS` y `seededScores()`; dejar los tipos y `CATS` del modelo de datos. Verificar con grep que no queda ningún import de lo eliminado.

13. **Documentación.** README: sección con las dos tablas, sus policies, el endpoint `POST /api/scores` y la nota de que la app ya no arranca sin Supabase.

14. **Verificación final.** `npm run lint` y `npm run build` sin errores. Prueba manual: Home, Biblioteca y los 9 detalles cargan desde la base; jugar Asteroides, terminar, guardar puntaje con nombre, y comprobar que aparece en `/game/asteroides` y en la pestaña ASTEROIDES del Hall of Fame (tras el `revalidate`). `get_advisors` sin hallazgos de seguridad nuevos.

## Criterios de aceptación

**Base de datos**

- [ ] Existen `public.games` y `public.scores` con las columnas, CHECKs, FK e índice del modelo de datos.
- [ ] Ambas tablas tienen RLS habilitado; `get_advisors` (security) no reporta tablas sin RLS ni políticas permisivas nuevas.
- [ ] `anon` puede hacer `select` en ambas tablas e `insert` en `scores`; un `insert` en `games` con la publishable key falla.
- [ ] Un `insert` en `scores` con `score = -1`, con `player_name` de 2 chars o con `game_id` inexistente es rechazado por la base.
- [ ] `select count(*) from games` = 9; `select count(*) from scores` = 96, con 0 filas de `game_id = 'asteroides'`.
- [ ] Existen dos migraciones registradas (`list_migrations`): schema y seed.

**Código**

- [ ] `lib/supabase/database.types.ts` existe y ambos clientes usan el genérico `Database`.
- [ ] `lib/queries.ts` exporta `getGames`, `getGameById`, `getTopScores`, `getAllTopScores`, y `best`/`plays` salen de la consulta, no de columnas de `games`.
- [ ] `lib/data.ts` ya no exporta `GAMES`, `PLAYERS` ni `seededScores`; un grep de esos tres símbolos en `app/`, `components/` y `lib/` no devuelve resultados.
- [ ] Un grep de `av_scores` en todo el repo no devuelve resultados.
- [ ] `app/page.tsx`, `app/biblioteca/page.tsx`, `app/game/[id]/page.tsx` y `app/hall-of-fame/page.tsx` son server components; `Home.tsx`, `Biblioteca.tsx` y `HallOfFame.tsx` reciben los datos por props y no importan de `lib/queries.ts`.
- [ ] `app/hall-of-fame/page.tsx` exporta `revalidate = 60`.

**Endpoint**

- [ ] `POST /api/scores` con body válido devuelve `201` con `{ id, rank }` y la fila queda en la tabla.
- [ ] Devuelve `400` con `score` negativo o no entero, con `playerName` fuera de 3–10 chars y con `gameId` inexistente.
- [ ] `playerName` se guarda en mayúsculas y sin espacios sobrantes (`"  px_kai "` → `PX_KAI`).
- [ ] La fila insertada tiene `user_id = null`.

**UI**

- [ ] Home muestra las 9 tarjetas, el ticker y el top 5 con datos de la base; el contador de juegos dice `9+`.
- [ ] Biblioteca lista los 9 juegos y los filtros por categoría y la búsqueda siguen funcionando igual que antes.
- [ ] `/game/<id>` de los 9 juegos carga título, textos y top 10 desde la base; `/game/no-existe` devuelve 404.
- [ ] La pestaña ASTEROIDES del Hall of Fame, sin partidas, muestra "SIN PARTIDAS REGISTRADAS" sin errores de render ni podio roto.
- [ ] Terminar una partida de Asteroides, escribir un nombre y pulsar GUARDAR muestra el rango obtenido; recargar `/game/asteroides` muestra ese puntaje en la tabla.
- [ ] Con el nombre vacío o de menos de 3 chars, el botón GUARDAR está deshabilitado.
- [ ] Si el `POST` falla, el modal muestra el error y permite reintentar sin perder el puntaje.

**Build**

- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.

## Decisiones tomadas y descartadas

- **Supabase como única fuente de verdad, no convivencia con el mock.** Se descartó crear las tablas y dejar la UI sobre `GAMES` (menos riesgo inmediato): dos fuentes de verdad garantizan que se desincronicen y obligan a tocar las mismas cuatro pantallas más adelante. Coste aceptado: la app deja de renderizar si Supabase no responde.

- **`best` y `plays` derivados de `scores`, no columnas de `games`.** Se descartaron columnas materializadas con trigger: a esta escala el `max`/`count` por consulta es trivial y evita el riesgo de contadores desincronizados. Si el volumen crece, se cambia por una vista materializada sin tocar la UI.

- **`games.id` es `text` con el slug actual, no `uuid`.** Los ids (`asteroides`, `bloque-buster`) ya son la ruta pública y la clave del registry de juegos del spec 05. Un `uuid` obligaría a mantener una columna `slug` en paralelo y a mapear ids en el registry.

- **Los 9 juegos se siembran tal cual, incluidos los 8 mocks no jugables.** Se descartó sembrar solo `asteroides`: la plataforma se vería vacía y las pantallas de vitrina (Home, Biblioteca) perderían su razón de ser. Se añade `playable` para distinguirlos en datos, aunque este spec no cambie el comportamiento del reproductor.

- **Puntajes sembrados solo para los mocks; `asteroides` arranca vacío.** Los únicos puntajes reales posibles hoy son los de Asteroides: mezclarlos con datos falsos haría imposible saber si el guardado funciona de verdad. Coste: una pestaña vacía en el Hall of Fame hasta la primera partida, resuelto con un estado vacío explícito.

- **Seed con valores literales, no generados aleatoriamente en la migración.** Una migración debe ser reproducible: si el seed usa `random()`, cada entorno tiene datos distintos y los criterios de aceptación dejan de ser verificables.

- **Insert vía `POST /api/scores`, no directo desde el browser.** Se descartó el insert directo con el cliente de browser (menos código): un único punto en servidor permite normalizar el nombre, calcular el rango a devolver y —sobre todo— atar `user_id` cuando llegue Supabase Auth, sin tocar la UI del reproductor.

- **`scores.user_id` se crea ahora aunque quede siempre `null`.** Añadir la columna después obliga a una migración con backfill sobre datos ya en producción. Crearla vacía cuesta nada.

- **Se acepta que cualquiera pueda postear un puntaje arbitrario.** Con `insert` público y sin auth no hay antifraude posible: se descartó tanto un secreto compartido en el cliente (visible en el bundle, seguridad de teatro) como validar la partida en servidor (requiere replicar el juego). La mitigación real es el spec de auth.

- **Sin deduplicar por jugador.** Se descartó `distinct on (player_name)` en el top: `PX_KAI` ocupando tres puestos es el comportamiento de un arcade real y el usuario ve todas sus partidas.

- **Desempate por `created_at asc`.** A igual puntaje gana quien lo logró primero — convención arcade y determinista, a diferencia de dejar el orden al planner.

- **`revalidate = 60` en Hall of Fame, sin Realtime.** Se descartó suscribirse a cambios en vivo: añade un canal WebSocket permanente por visitante para una tabla que cambia unas pocas veces al día. Coste: hasta un minuto de retraso en ver un puntaje nuevo.

- **Pedir el nombre en el modal FIN en vez de `INVITADO` automático.** Se descartó guardar todo como `INVITADO` (leaderboard inservible) y no guardar sin sesión (castiga al único flujo jugable que existe hoy). El input precargado con `av_user.name` mantiene la fricción en cero para quien ya "inició sesión".

- **Se eliminan `localStorage.av_scores` y `seededScores()` en este spec, no después.** Dejarlos como respaldo significa dos caminos de escritura y un fallback que nadie prueba; borrarlos ahora hace que cualquier regresión salte de inmediato.

- **Server components con props hacia los componentes cliente existentes.** Se descartó hacer fetch desde el cliente con `useEffect` (spinners, cascadas de red, key expuesta en cada request) y reescribir las pantallas como server components puros (perderían filtros, tilt y pestañas). Partir en server page + client component conserva toda la interactividad actual.

- **Tipos generados del schema, cerrando la deuda del spec 04.** Ese spec dejó el genérico `Database` pendiente "para el spec que cree las primeras tablas": este.

## Riesgos identificados

- **La app deja de renderizar sin Supabase.** Home, Biblioteca, detalle y Hall of Fame pasan a depender de la red: env vars ausentes, proyecto pausado por inactividad (plan free) o caída de Supabase producen un error de servidor en la portada, no una degradación. _Mitigación:_ README documenta la dependencia dura; si en la prueba manual el fallo resulta inaceptable, se evalúa en un spec posterior un `error.tsx` por ruta. Este spec **no** añade fallback a datos mock — sería reintroducir la segunda fuente de verdad que se acaba de eliminar.

- **Puntajes falsos vía la publishable key.** Cualquiera puede insertar en `scores` con un `curl`. Es una decisión asumida, no un descuido, pero el Hall of Fame es corrompible desde el día uno. _Mitigación:_ los CHECKs acotan el daño a valores plausibles; el spec de auth es el que lo cierra de verdad.

- **Romper pantallas al pasar `plays` de `string` a `number` y quitar columnas.** `"12.4K"` se renderizaba directo; ahora hay que formatear. Un `plays` sin formatear muestra `0` donde antes había `12.4K`. _Mitigación:_ el paso 9 del plan incluye el formateo explícito, y los criterios de aceptación lo verifican en Home.

- **Estado vacío no contemplado en el podio.** El JSX actual del Hall of Fame accede a `rows[0]`, `rows[1]` y `rows[2]` sin comprobar: con `asteroides` sin partidas revienta en runtime. _Mitigación:_ paso 7 del plan y criterio de aceptación específico.

- **Partir componentes cliente en server page + props puede romper interactividad sutil.** El tilt 3D de las tarjetas, el `IntersectionObserver` de reveal y las pestañas dependen de que esos componentes sigan siendo cliente. Mover una directiva `"use client"` de más o de menos rompe el build o el efecto. _Mitigación:_ pasos 6→9 en orden de complejidad creciente (detalle, Hall of Fame, Biblioteca, Home), verificando en el navegador después de cada uno.

- **Seed y `GAMES` pueden divergir al copiarlos a mano.** Nueve registros con textos largos transcritos a SQL: una comilla mal escapada o un `long` truncado y el contenido cambia sin que nada falle. _Mitigación:_ generar el SQL a partir del array actual antes de borrarlo, y comparar título y `short` de los 9 en Biblioteca contra el mock antes de la limpieza del paso 12.

- **El `rank` devuelto por el endpoint queda obsoleto al instante.** Es un `count` en el momento del insert; si entran puntajes concurrentes, el número que vio el jugador ya no coincide con la tabla. _Mitigación:_ es informativo en el modal; la tabla del Hall of Fame es la autoridad.

- **`revalidate = 60` confunde en la prueba manual.** Guardar un puntaje y no verlo al recargar el Hall of Fame parece un bug del guardado. _Mitigación:_ el criterio de aceptación indica esperar el revalidate; el detalle `/game/[id]` (sin cache configurada) sirve de verificación inmediata.
