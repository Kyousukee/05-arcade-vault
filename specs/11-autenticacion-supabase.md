# SPEC 11 — Autenticación real con Supabase Auth

> **Estado:** aprobado
> **Depende de:** SPEC 04 (integración Supabase), SPEC 06 (juegos y leaderboard)
> **Fecha:** 2026-09-01
> **Objetivo:** Sustituir el login falso de `localStorage.av_user` por Supabase Auth real —registro con email y contraseña, confirmación por correo, acceso con Google y GitHub, recuperación de contraseña y perfiles con nick único— de modo que los puntajes guardados queden atados a la cuenta del jugador.

> **Por qué existe este spec:** el SPEC 06 dejó `scores.user_id` creado pero siempre `null` y aplazó Supabase Auth de forma explícita. Hasta hoy la identidad es una cadena en `localStorage` que cualquiera puede editar, y el leaderboard acepta cualquier nombre. Este spec paga esa deuda: la sesión pasa a ser real y verificada en servidor, y un puntaje de un usuario registrado ya no se puede firmar con el nick de otro.

## Alcance

**Incluye:**

**Base de datos (Supabase, proyecto `tfyxzdctimnkrdnqtzfi`)**

- Migración `create_profiles`: tabla `public.profiles` con `id uuid primary key references auth.users(id) on delete cascade`, `nickname text not null`, `created_at timestamptz default now()`.
- Índice `unique` case-insensitive sobre el nick: `create unique index profiles_nickname_key on public.profiles (upper(nickname))`. CHECK de formato: 3–10 caracteres, `[A-Z0-9]` en mayúsculas (mismo formato que `scores.player_name`).
- RLS en `profiles`: `select` público (rol `anon`), `update` solo `auth.uid() = id`, `insert` solo `auth.uid() = id`, sin `delete`.
- Función `public.nickname_available(candidate text)` (`security definer`, `stable`) para que el formulario consulte disponibilidad sin exponer la tabla entera.
- Ajuste de la política de `insert` en `scores`: sigue permitiendo insert anónimo con `user_id is null`, y añade que si `user_id` no es null debe ser `auth.uid()`.
- `lib/supabase/database.types.ts` regenerado.

**Sesión (SSR)**

- `middleware.ts` nuevo en la raíz, con `lib/supabase/middleware.ts` (`updateSession`) según la guía de `@supabase/ssr`: refresca el token en cada request y reescribe las cookies. `matcher` excluye `_next/static`, `_next/image`, `favicon.ico`, `public/games/**` y assets de imagen.
- **Ninguna ruta se protege.** El middleware solo refresca sesión; `/game/[id]/play` y el resto siguen siendo públicas.
- `components/AuthProvider.tsx` (client) montado en `app/layout.tsx`: expone `useAuth()` con `{ user, profile, loading, signOut }`, se suscribe a `onAuthStateChange` y recarga el perfil al cambiar la sesión.

**Rutas nuevas**

- `app/auth/callback/route.ts` — intercambia el `code` de OAuth por sesión (`exchangeCodeForSession`) y redirige a `/auth/nickname` si el perfil no existe, o a `next` / `/` si existe.
- `app/auth/confirm/route.ts` — verifica el `token_hash` + `type` del correo de confirmación (`verifyOtp`) y redirige a `/`; si falla, a `/login?error=confirm`.
- `app/auth/nickname/page.tsx` — onboarding de nick para cuentas OAuth sin perfil: input 3–10 mayúsculas, comprobación de disponibilidad en vivo, crea la fila en `profiles`. Redirige a `/` si el perfil ya existe.
- `app/auth/reset/page.tsx` — pantalla de nueva contraseña, alcanzable solo con la sesión de recuperación abierta por el enlace del correo.

**UI de `/login` (se conserva el diseño actual)**

- Las pestañas INICIAR SESIÓN / CREAR CUENTA se mantienen; el formulario de registro añade el campo **Nick** (3–10, mayúsculas, con aviso de disponibilidad) junto a correo y contraseña. El campo "Usuario" del login pasa a ser **Correo electrónico**.
- Estados nuevos y visibles: _enviando_, _error_ (mensajes de Supabase traducidos al español), y tras registrarse la tarjeta cambia a **"revisa tu correo"** con la dirección usada.
- Los botones ◆ GOOGLE y ▣ GITHUB dejan de ser decorativos: llaman a `signInWithOAuth` con `redirectTo` a `/auth/callback`.
- Enlace "¿Olvidaste tu contraseña?" bajo el formulario de acceso: pide el correo y llama a `resetPasswordForEmail`, con confirmación en la misma tarjeta.
- JUGAR COMO INVITADO se queda y no crea sesión.

**Integración con lo existente**

- `POST /api/scores`: si hay sesión, ignora el `playerName` del cuerpo y usa el `nickname` del perfil, insertando `user_id`; si no la hay, mantiene el comportamiento actual (nombre libre, `user_id` null).
- `components/GamePlayer.tsx`: el modal de FIN, con sesión, muestra el nick fijo (no editable) y guarda directamente; sin sesión sigue pidiendo iniciales.
- `components/Nav.tsx`: consume `useAuth()`; muestra el nick real y SALIR llama a `supabase.auth.signOut()`.
- `components/HallOfFame.tsx`: resalta las filas cuyo `user_id` coincide con el usuario de la sesión, en vez de comparar nombres.
- **Se elimina `localStorage.av_user`** de las cuatro lecturas/escrituras actuales. El invitado no persiste identidad.

**Configuración y verificación**

- Proveedores Google y GitHub dados de alta en el dashboard de Supabase; URLs de redirección para desarrollo (`http://localhost:3000/**`) y producción documentadas en el README.
- Correos de confirmación y reset por el **SMTP integrado de Supabase**, sin configurar proveedor externo.
- `.env.template` y README actualizados con los pasos de auth.
- `npm run lint`, `npm run build`, `get_advisors` de Supabase sin avisos nuevos de seguridad, y prueba manual del recorrido completo: registro → correo → confirmar → jugar → guardar puntaje → verlo resaltado en `/hall-of-fame` → salir → entrar con Google → poner nick → jugar.

**NO incluye (fuera de este spec):**

- Página de perfil `/perfil`, avatar, cambio de nick después del registro y borrado de cuenta.
- Vista "mis puntajes" o histórico por usuario.
- Rutas protegidas o roles (admin, moderador).
- Vinculación de varias identidades a una misma cuenta (mismo correo en Google y en email+contraseña se tratan como cuentas distintas según el ajuste por defecto del proyecto).
- Cambio de correo electrónico, 2FA, sesiones múltiples o cierre remoto de sesión.
- Antifraude en los puntajes: sigue siendo posible postear puntajes arbitrarios como invitado.
- Migrar los puntajes ya existentes (`user_id` null) a cuentas nuevas: se quedan como están.
- SMTP propio con Resend para los correos de auth.
- Magic links y proveedores OAuth distintos de Google y GitHub.
- Rate limiting propio en `/api/scores` o en los formularios de auth.
- Tests automatizados (no hay test runner configurado).

**Consecuencias aceptadas de este scope:**

- El SMTP integrado de Supabase limita a ~2 correos por hora y solo a direcciones autorizadas del proyecto: sirve para desarrollo, no para abrir el registro al público.
- Un jugador registrado no puede cambiar su nick hasta que exista el spec de perfil.
- Los nicks ya sembrados en `scores` (spec 06) no reservan nada: alguien puede registrarse con un nick que ya aparece en el leaderboard histórico.

## Modelo de datos

**Tabla nueva `public.profiles`**

```sql
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null,
  created_at timestamptz not null default now(),
  constraint profiles_nickname_format check (nickname ~ '^[A-Z0-9]{3,10}$')
);
create unique index profiles_nickname_key on public.profiles (upper(nickname));
```

Un perfil por usuario. `nickname` se guarda ya normalizado en mayúsculas; la unicidad es case-insensitive por el índice sobre `upper(nickname)`. El formato es el mismo CHECK que `scores.player_name` (3–10, `[A-Z0-9]`), para que el nick se pueda copiar tal cual al guardar un puntaje.

**Sin trigger de creación automática.** La fila de `profiles` la crea la aplicación, no un trigger `on auth.users`:

- Registro con email: el nick va en `options.data.nickname` del `signUp` y la fila se inserta tras confirmar el correo, en `app/auth/confirm/route.ts`.
- Registro con OAuth: no hay nick disponible, la fila la inserta `app/auth/nickname/page.tsx`.

Razón: con un trigger, el usuario de Google entraría sin nick y habría que inventar uno o dejar la columna nullable.

**Función de disponibilidad**

```sql
create function public.nickname_available(candidate text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.profiles where upper(nickname) = upper(candidate)
  );
$$;
```

Se llama desde el cliente con `supabase.rpc("nickname_available", { candidate })`.

**Tipos de aplicación** (`lib/auth.ts`, nuevo):

```ts
export type Profile = {
  id: string;
  nickname: string;
};

export type AuthState = {
  user: User | null; // User de @supabase/supabase-js
  profile: Profile | null; // null si aún no eligió nick (OAuth recién entrado)
  loading: boolean;
};
```

Convenciones:

- `profile === null` con `user !== null` significa **cuenta sin nick**: solo pasa entre el callback de OAuth y `/auth/nickname`.
- El nick se normaliza con `trim().toUpperCase().slice(0, 10)` en cliente y se vuelve a validar en servidor y en el CHECK. Tres capas, la de la base manda.

**Cambios en tablas existentes**

`scores` no cambia de forma: `user_id uuid null` ya existe desde el spec 06 y a partir de ahora se rellena. Solo cambia su política de `insert`:

```sql
-- antes: insert público sin condición sobre user_id
-- ahora:
with check (user_id is null or user_id = auth.uid())
```

**Nada se guarda en `localStorage`.** Las cookies de sesión de Supabase (`sb-<ref>-auth-token`) las gestiona `@supabase/ssr` y el middleware; la clave `av_user` se elimina.

## Plan de implementación

Cada paso deja la app arrancando (`npm run dev`) y es commitable por separado.

1. **Leer la documentación vendorizada antes de escribir nada:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.mdx` y la página de Route Handlers de esa misma versión (16.2.10). El middleware y los handlers de `app/auth/*` se escriben contra esa API, no contra la de memoria.

2. **Migración `create_profiles`** vía MCP de Supabase: tabla, CHECK de formato, índice único case-insensitive, RLS habilitado y las tres políticas (`select` público, `insert`/`update` solo del dueño). Verificación: `list_tables` muestra la tabla con RLS activo.

3. **Migración `add_nickname_available_fn`**: la función `security definer` con `search_path = ''`. Verificación: `execute_sql` con `select public.nickname_available('KAI')` devuelve `true`.

4. **Migración `tighten_scores_insert_policy`**: recrear la política de `insert` de `scores` con `with check (user_id is null or user_id = auth.uid())`. Verificación: insertar como anónimo sigue funcionando; insertar con un `user_id` ajeno falla.

5. **Regenerar `lib/supabase/database.types.ts`** con `generate_typescript_types`. Verificación: `npm run build` sigue pasando.

6. **`lib/supabase/middleware.ts` + `middleware.ts` en la raíz**: `updateSession` que crea el cliente server con `getAll`/`setAll` sobre la request y la response, llama a `getUser()` y devuelve la response con las cookies reescritas. Sin ninguna redirección: solo refresco. `matcher` excluyendo estáticos y `public/games`. Verificación manual: la app carga igual que antes en todas las rutas.

7. **`lib/auth.ts`**: tipos `Profile` y `AuthState`, y los helpers puros `normalizeNickname(raw)` y `isValidNickname(value)` que aplican el mismo formato que el CHECK.

8. **`components/AuthProvider.tsx` + montaje en `app/layout.tsx`**: context con `{ user, profile, loading, signOut }`, carga inicial con `getUser()` + lectura de `profiles`, suscripción a `onAuthStateChange` y limpieza en el `unmount`. Exporta `useAuth()`. Verificación: un `console.log` temporal muestra `user: null, loading: false` en una sesión limpia.

9. **`components/Nav.tsx` pasa a `useAuth()`**: nick real desde `profile.nickname`, SALIR llama a `signOut()` y refresca la ruta. Se borra la lectura de `localStorage.av_user`. Verificación: sin sesión el Nav muestra el estado de invitado, sin errores en consola.

10. **`/login` — acceso con email y contraseña**: el campo "Usuario" pasa a "Correo electrónico", el submit llama a `signInWithPassword` y en éxito hace `router.push("/")` + `router.refresh()`. Estados de _enviando_ y _error_ con mensajes en español. Verificación: crear un usuario a mano en el dashboard y entrar con él.

11. **`/login` — registro con nick**: campo Nick en la pestaña CREAR CUENTA con comprobación de disponibilidad (RPC `nickname_available`, con retardo de 400 ms), `signUp` con `emailRedirectTo` a `/auth/confirm` y `options.data.nickname`. Al enviar, la tarjeta pasa al estado "revisa tu correo". Verificación: se recibe el correo y el usuario aparece en `auth.users` sin confirmar.

12. **`app/auth/confirm/route.ts`**: `verifyOtp` con `token_hash` y `type`; si la verificación pasa y no existe fila en `profiles`, la inserta con el nick de `user_metadata`; redirige a `/`. En error, a `/login?error=confirm`. Verificación: pulsar el enlace del correo deja al usuario dentro y con perfil.

13. **`POST /api/scores` con sesión**: leer `getUser()`; si hay usuario, cargar su `nickname` e insertar con ese nombre y `user_id`; si no, dejar la ruta actual intacta. Verificación: jugar logueado y comprobar en la tabla que la fila lleva `user_id`.

14. **`components/GamePlayer.tsx`**: con sesión, el modal de FIN muestra el nick fijo y sin input; sin sesión, se mantiene el input de iniciales. Se borra la lectura de `localStorage.av_user`. Verificación: los dos recorridos guardan puntaje.

15. **`components/HallOfFame.tsx`**: el resaltado pasa a comparar `score.user_id` con el usuario de `useAuth()`. Se borra la última lectura de `localStorage.av_user`. Verificación: los puntajes propios salen marcados; los de invitado, no.

16. **Proveedores OAuth en el dashboard** (Google y GitHub) y URLs de redirección de desarrollo. Sin código. Verificación: los proveedores aparecen habilitados.

17. **`app/auth/callback/route.ts` + botones sociales**: los botones llaman a `signInWithOAuth` con `redirectTo` al callback; el handler hace `exchangeCodeForSession` y redirige a `/auth/nickname` si no hay perfil, o a `/` si lo hay. Verificación: entrar con Google deja sesión abierta.

18. **`app/auth/nickname/page.tsx`**: onboarding con la misma validación de nick del registro, inserta en `profiles` y redirige a `/`. Si ya hay perfil, redirige a `/` sin mostrar nada. Verificación: el usuario de Google del paso anterior completa su nick y el Nav lo muestra.

19. **Recuperación de contraseña**: enlace y formulario de correo en `/login` (`resetPasswordForEmail` con `redirectTo` a `/auth/reset`), y `app/auth/reset/page.tsx` con el formulario de nueva contraseña (`updateUser`). Verificación: recorrido completo desde el correo hasta entrar con la contraseña nueva.

20. **Limpieza y documentación**: confirmar con `grep` que no queda ninguna referencia a `av_user`, actualizar README (tabla `profiles`, rutas de auth, alta de proveedores, límite del SMTP integrado) y `.env.template` si aplica. Correr `npm run lint`, `npm run build` y `get_advisors` de Supabase.

## Criterios de aceptación

**Base de datos**

- [ ] `public.profiles` existe con RLS habilitado y las políticas `select` público, `insert` y `update` restringidas a `auth.uid() = id`.
- [ ] Insertar dos perfiles con nick `KAI` y `kai` falla por el índice único.
- [ ] Un nick de 2 caracteres, de 11, o con minúsculas o símbolos, es rechazado por el CHECK.
- [ ] `select public.nickname_available('KAI')` devuelve `false` si existe ese perfil y `true` si no.
- [ ] Un insert anónimo en `scores` con `user_id` de otro usuario es rechazado por RLS; con `user_id` null se acepta.
- [ ] `get_advisors` (security y performance) no reporta avisos nuevos respecto a antes del spec.

**Registro y acceso con email**

- [ ] Registrarse con correo, contraseña y nick deja la tarjeta de `/login` en el estado "revisa tu correo" mostrando la dirección usada.
- [ ] El formulario de registro muestra "ese nick ya existe" antes de enviar cuando el nick está tomado, y no permite enviar.
- [ ] Un usuario recién registrado y **sin confirmar** no tiene sesión: recargar `/` lo muestra como invitado.
- [ ] Pulsar el enlace del correo de confirmación deja al usuario con sesión iniciada, redirigido a `/`, y con su fila en `profiles` creada con el nick elegido.
- [ ] Entrar con correo y contraseña correctos redirige a `/` y el Nav muestra el nick del perfil.
- [ ] Entrar con contraseña incorrecta muestra un mensaje de error en español en la tarjeta y no navega.

**OAuth**

- [ ] Pulsar GOOGLE o GITHUB abre el consentimiento del proveedor y vuelve a la app con sesión iniciada.
- [ ] Un usuario OAuth sin perfil aterriza en `/auth/nickname` y no puede seguir sin elegir un nick disponible.
- [ ] Tras elegir el nick, se crea la fila en `profiles` y el Nav lo muestra.
- [ ] Un usuario OAuth que ya tiene perfil entra directo a `/` y visitar `/auth/nickname` a mano lo redirige a `/`.

**Recuperación de contraseña**

- [ ] Pedir el reset con un correo registrado muestra confirmación en la tarjeta y envía el correo.
- [ ] El enlace del correo abre `/auth/reset` con la sesión de recuperación activa.
- [ ] Guardar la contraseña nueva permite entrar con ella y la anterior deja de funcionar.
- [ ] Visitar `/auth/reset` sin sesión de recuperación no permite cambiar la contraseña.

**Sesión e integración**

- [ ] `middleware.ts` refresca la sesión: tras más de una hora de inactividad, recargar `/` mantiene al usuario dentro sin volver a entrar.
- [ ] Ninguna ruta redirige a `/login` por falta de sesión: `/`, `/biblioteca`, `/game/[id]`, `/game/[id]/play`, `/hall-of-fame` y `/about` cargan como invitado.
- [ ] JUGAR COMO INVITADO lleva a `/` sin crear sesión.
- [ ] Con sesión, el modal de FIN muestra el nick fijo, sin input editable, y guarda el puntaje.
- [ ] La fila de `scores` de una partida con sesión tiene `user_id` igual al usuario y `player_name` igual al nick del perfil, aunque el cliente envíe otro `playerName` en el cuerpo.
- [ ] Sin sesión, el modal de FIN sigue pidiendo iniciales y la fila se guarda con `user_id` null.
- [ ] En `/hall-of-fame`, los puntajes propios aparecen resaltados y los de otros no.
- [ ] SALIR cierra la sesión, el Nav vuelve al estado de invitado y recargar `/` no la restaura.

**Limpieza**

- [ ] `grep -rn "av_user"` sobre el repo (sin `node_modules`) no devuelve ninguna coincidencia.
- [ ] `npm run lint` y `npm run build` pasan sin errores ni avisos nuevos.
- [ ] El README documenta la tabla `profiles`, las rutas de `app/auth/*`, el alta de los proveedores OAuth y el límite del SMTP integrado.

## Decisiones tomadas y descartadas

- **Sí:** Supabase Auth con `@supabase/ssr` y cookies. Es el camino soportado para App Router y el proyecto ya usa `createServerClient`/`createBrowserClient` desde el spec 04.
- **No:** un `middleware.ts` que proteja rutas. El arcade se juega sin cuenta; el middleware solo refresca la sesión. Proteger rutas es un cambio de producto, no de infraestructura.
- **Sí:** tabla `profiles` propia. Es la única forma de tener un nick **único** en el arcade, y deja preparado el "mis puntajes" del futuro.
- **No:** guardar el nick solo en `user_metadata`. Es editable por el propio usuario desde el cliente y no se puede indexar como único.
- **Sí:** unicidad case-insensitive vía `unique index` sobre `upper(nickname)`. Evita que `Kai` y `KAI` sean dos jugadores distintos en el leaderboard.
- **No:** trigger `on auth.users` que cree el perfil automáticamente. Con OAuth no hay nick que poner, y obligaría a dejar la columna nullable o a inventar nombres. Crear el perfil desde la app mantiene el invariante "perfil ⇒ nick válido".
- **No:** autogenerar el nick del email o del handle de Google. Es el nombre visible en el leaderboard: se elige, no se hereda.
- **Sí:** el servidor pisa el `playerName` del cliente cuando hay sesión. Sin esto, cualquiera podría firmar un puntaje con el nick de un usuario registrado, que es justo lo que este spec viene a cerrar.
- **Sí:** el modo invitado se queda con inserción anónima. Quitarlo rompería el flujo actual del arcade y el catálogo de puntajes existente.
- **No:** exigir sesión para guardar puntaje. Se descarta por lo anterior; el antifraude tiene su propio spec cuando llegue.
- **Sí:** confirmación de email activada. Sin ella, cualquiera reserva nicks con correos que no existen.
- **Sí:** SMTP integrado de Supabase. Cero configuración para desarrollo. Se acepta el límite de ~2 correos/hora y de destinatarios autorizados; migrar a Resend es un cambio de dashboard, no de código.
- **No:** SMTP propio con Resend en este spec. La clave ya existe por `/api/contact`, pero configurarlo no bloquea nada de lo que aquí se construye.
- **Sí:** recuperación de contraseña dentro del spec, pese a ampliar el alcance. Un registro con contraseña sin recuperación es una cuenta que se pierde para siempre.
- **Sí:** `AuthProvider` con context en el root layout. Hoy tres componentes leen la identidad por su cuenta; con `onAuthStateChange` distribuido habría tres suscripciones y tres verdades.
- **Sí:** eliminar `localStorage.av_user` por completo. Mantenerlo en paralelo a la sesión real es la vía rápida a estados incoherentes entre Nav y modal de FIN.
- **No:** conservar unas iniciales de invitado en `localStorage.av_guest`. Ahorra tres pulsaciones y añade una fuente de identidad más.
- **Sí:** un único spec con todo (email+pass, OAuth, reset, perfiles). Se valoró partirlo en 11 y 12; se descartó para no dejar la app dos semanas con media autenticación y un `Nav` que cambia dos veces.
- **No:** vincular identidades del mismo correo entre Google y email+contraseña. Se queda el comportamiento por defecto del proyecto; unificar cuentas es un problema con casos límite propios.

## Riesgos identificados

| Riesgo                                                                                                                    | Mitigación                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| El SMTP integrado limita a ~2 correos/hora y solo a direcciones del equipo: el registro público no funciona en producción | Documentado en el README como bloqueante conocido. Se resuelve configurando Resend como SMTP en el dashboard, sin tocar código.             |
| Registro con email confirmado pero fallo al insertar en `profiles`: usuario con sesión y sin nick                         | `/auth/confirm` redirige a `/auth/nickname` si el insert falla, que es el mismo camino que ya recorre OAuth. Ningún usuario queda atrapado. |
| Carrera entre dos registros con el mismo nick disponible                                                                  | La RPC solo informa; la verdad es el índice único. El error `23505` se traduce a "ese nick ya existe" y el formulario vuelve a pedirlo.     |
| El middleware rompe rutas de assets o los juegos (`public/games/**`)                                                      | El `matcher` excluye estáticos e imágenes de forma explícita, y el paso 6 se verifica cargando una partida real antes de seguir.            |
| Callbacks de OAuth fallando en producción por URLs de redirección no dadas de alta                                        | El README lista las URLs de desarrollo y de producción; el criterio de aceptación exige el recorrido completo con los dos proveedores.      |
| `exchangeCodeForSession` con `code` ausente o ya usado (usuario recarga el callback)                                      | El handler redirige a `/login?error=oauth` en vez de lanzar una excepción sin manejar.                                                      |

## Lo que **no** está en este spec

- Página de perfil, avatar, cambio de nick y borrado de cuenta.
- Vista "mis puntajes" e histórico por usuario.
- Rutas protegidas y roles.
- Antifraude y rate limiting de puntajes.
- SMTP propio con Resend para los correos de auth.
- Magic links y proveedores OAuth más allá de Google y GitHub.
- Vinculación de identidades, cambio de correo y 2FA.
- Migración de los puntajes históricos a cuentas.

Cada uno de ellos, si llega, va en su propio spec.
