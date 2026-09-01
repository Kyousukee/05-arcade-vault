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

Tres tablas en el esquema `public`, creadas por las migraciones `create_games_and_scores`,
`seed_games_and_scores` y `create_profiles`:

| Tabla      | Contenido                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `games`    | Catálogo de juegos: `id` (slug de la ruta), textos, `cat`, `cover`, `color`, `playable`, `sort_order`.  |
| `scores`   | Una fila por partida guardada: `game_id`, `player_name` (3–10 chars), `score`, `user_id`, `created_at`. |
| `profiles` | Un perfil por cuenta: `id` (= `auth.users.id`), `nickname` (3–10, `[A-Z0-9]`), `created_at`.            |

- `best` (mejor puntaje) y `plays` (partidas) **no son columnas**: se derivan de `scores` en
  `lib/queries.ts` (`max(score)` y `count`).
- Orden del ranking: `score desc, created_at asc` — a igual puntaje gana el más antiguo.
- **RLS activo en las tres.** `select` público en todas; `insert` en `scores` con
  `user_id is null or user_id = auth.uid()`; en `profiles`, `insert` y `update` solo del dueño
  (`auth.uid() = id`) y sin `delete`; `games` no acepta escrituras desde el cliente, solo
  migraciones.
- `profiles.nickname` es único **sin distinguir mayúsculas**: índice `profiles_nickname_key` sobre
  `upper(nickname)`. La disponibilidad se consulta con la función `public.nickname_available(candidate)`
  (`security definer`), que solo devuelve un booleano.
- `scores.user_id` referencia a `auth.users`: lo rellena `POST /api/scores` cuando hay sesión.
  Un puntaje de invitado sigue guardándose con `user_id` null y nombre libre — postear puntajes
  arbitrarios como invitado sigue siendo posible, es una limitación conocida.
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

**Con sesión iniciada el servidor ignora el `playerName` del cuerpo** y guarda el `nickname` del
perfil junto al `user_id`. Así nadie puede firmar un puntaje con el nick de otra cuenta.

## Autenticación

Supabase Auth con `@supabase/ssr` y cookies. La sesión se refresca en `proxy.ts` (la convención
que sustituye a `middleware.ts` en Next 16), que delega en `lib/supabase/middleware.ts`.
**Ninguna ruta está protegida:** el arcade se juega sin cuenta y el modo invitado se queda.

| Ruta             | Qué hace                                                                           |
| ---------------- | ---------------------------------------------------------------------------------- |
| `/login`         | Acceso y registro con correo, acceso con Google/GitHub y petición de recuperación. |
| `/auth/confirm`  | Verifica el enlace del correo (`verifyOtp`) y crea el perfil con el nick elegido.  |
| `/auth/callback` | Canjea el `code` de OAuth por sesión (`exchangeCodeForSession`).                   |
| `/auth/nickname` | Onboarding de nick para cuentas OAuth que aún no tienen perfil.                    |
| `/auth/reset`    | Formulario de contraseña nueva, solo con la sesión de recuperación abierta.        |

`components/AuthProvider.tsx` expone `useAuth()` con `{ user, profile, loading, signOut }` y es la
única fuente de identidad en el cliente (Nav, reproductor y Salón de la Fama).

### Alta de los proveedores OAuth

En el dashboard de Supabase, _Authentication → Sign In / Providers_:

- **Google:** crear un OAuth client ID (tipo _Web application_) en Google Cloud Console con
  `https://<project-ref>.supabase.co/auth/v1/callback` como _Authorized redirect URI_, y pegar
  Client ID y Secret en Supabase.
- **GitHub:** crear una OAuth App con el mismo _Authorization callback URL_, y pegar Client ID y
  Secret en Supabase.
- **URL Configuration:** Site URL `http://localhost:3000` y, en _Redirect URLs_,
  `http://localhost:3000/**` para desarrollo más la URL de producción con el mismo `/**`.
- **Email:** `Confirm email` activado; sin confirmar no hay sesión.

> **Límite conocido — SMTP integrado.** Los correos de confirmación y de recuperación salen por el
> SMTP que trae Supabase, limitado a ~2 correos por hora y solo a direcciones autorizadas del
> proyecto. Sirve para desarrollo; **el registro público no funciona así**. Se resuelve
> configurando un SMTP propio (p. ej. Resend) en el dashboard, sin tocar código.

## Commands

## Hola Mundo
