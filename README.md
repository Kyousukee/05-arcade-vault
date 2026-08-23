## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

## Variables de entorno

Copiar `.env.template` a `.env.local` y completar:

- `RESEND_API_KEY` — API key de [Resend](https://resend.com), usada para enviar el correo del formulario de contacto (`/about`).
- `CONTACT_EMAIL` — correo destinatario de los mensajes de contacto.
- `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto Supabase (`https://<project-ref>.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key del proyecto Supabase.

Sin estas variables, `POST /api/contact` responde `500`.

Las dos variables de Supabase las consumen los clientes de `lib/supabase/` (`client.ts` y
`server.ts`): sin ellas, `createClient()` falla al instanciarse. Ambas llevan prefijo
`NEXT_PUBLIC_`, así que quedan expuestas en el bundle del browser — es el comportamiento
esperado de la publishable key, siempre que toda tabla tenga RLS activo.

> **La app no arranca sin Supabase.** Home, `/biblioteca`, `/game/[id]`, `/game/[id]/play` y
> `/hall-of-fame` leen sus datos de la base en cada render: sin las variables, o con el proyecto
> caído o pausado, esas rutas devuelven error de servidor. No hay fallback a datos locales.

## Base de datos

Dos tablas en el esquema `public`, creadas por las migraciones `create_games_and_scores` y
`seed_games_and_scores`:

| Tabla    | Contenido                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------- |
| `games`  | Catálogo de juegos: `id` (slug de la ruta), textos, `cat`, `cover`, `color`, `playable`, `sort_order`.  |
| `scores` | Una fila por partida guardada: `game_id`, `player_name` (3–10 chars), `score`, `user_id`, `created_at`. |

- `best` (mejor puntaje) y `plays` (partidas) **no son columnas**: se derivan de `scores` en
  `lib/queries.ts` (`max(score)` y `count`).
- Orden del ranking: `score desc, created_at asc` — a igual puntaje gana el más antiguo.
- **RLS activo en ambas.** `select` público en las dos; `insert` público en `scores` (solo con
  `user_id is null`); `games` no acepta escrituras desde el cliente, solo migraciones.
- `scores.user_id` referencia a `auth.users` y hoy siempre vale `null`: queda preparado para el
  spec de autenticación. Mientras tanto, cualquiera con la publishable key puede insertar un
  puntaje — es una limitación conocida, no un descuido.
- Tipos generados del schema en `lib/supabase/database.types.ts`; ambos clientes los usan como
  genérico `Database`.

## API

### `POST /api/scores`

Guarda el puntaje de una partida. Único punto de escritura de `scores`.

```jsonc
// petición
{ "gameId": "asteroides", "playerName": "PX_KAI", "score": 12400 }

// 201
{ "id": "<uuid>", "rank": 3 }
```

`playerName` se normaliza en el servidor (trim, mayúsculas, recorte a 10). Responde `400` si el
juego no existe, si el nombre queda con menos de 3 caracteres o si `score` no es un entero `>= 0`;
`500` si falla la escritura en Supabase. El `rank` devuelto es informativo: refleja la posición en
el momento del insert.

## Commands

## Hola Mundo
