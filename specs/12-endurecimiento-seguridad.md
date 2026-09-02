# SPEC 12 — Endurecimiento de seguridad

> **Estado:** implementado
> **Depende de:** SPEC 04 (integración Supabase), SPEC 11 (autenticación Supabase)
> **Fecha:** 2026-09-01
> **Objetivo:** Cerrar los tres warnings de seguridad del linter de Supabase, endurecer la política de contraseñas y el límite de registros por IP, y servir cabeceras de seguridad desde Next.js, dejando constancia en el repo de lo que se configuró fuera de él.

> **Por qué existe este spec:** el SPEC 11 trajo Auth real, y con él una superficie de ataque nueva —registro abierto, contraseñas de usuario, una función RPC pública— que se quedó con los valores por defecto. Hoy `get_advisors("security")` devuelve tres warnings, Supabase acepta contraseñas de 6 caracteres sin comprobar si están filtradas, y la app no envía ni una cabecera de seguridad. Este spec paga esa deuda de una vez. Parte se aplica en el repo y parte solo existe en el dashboard de Supabase: por eso el spec exige además un documento versionado que registre lo segundo, o el trabajo se vuelve invisible y no se puede reauditar.

**Nota sobre el alcance real:** RLS ya está habilitado en `games`, `scores` y `profiles` con políticas correctas —verificado contra la base—. Ese punto del checklist entra como verificación, no como trabajo.

## Alcance

**Incluye:**

**Base de datos (Supabase, proyecto `tfyxzdctimnkrdnqtzfi`)**

- Migración `harden_security_definer_functions`:
  - `public.nickname_available(candidate text)` pasa de `SECURITY DEFINER` a `SECURITY INVOKER`, manteniendo `stable` y `set search_path = ''`. No se rompe nada: `profiles` ya tiene `select` público para `anon` y `authenticated`.
  - `revoke execute on function public.rls_auto_enable() from anon, authenticated, public`. Es un `event trigger`; ningún cliente lo llama por RPC.
- Verificación de que RLS sigue habilitado en `public.games`, `public.scores` y `public.profiles`. **No se cambia ninguna política existente.**

**Configuración de Auth (dashboard de Supabase, fuera del repo)**

- Minimum password length: `8`.
- Password Requirements: `Lowercase, uppercase letters, digits and symbols`.
- Leaked password protection (HaveIBeenPwned): activado.
- Rate limit de signups: `30` por hora por IP.

**Repositorio**

- `lib/security-headers.ts` (nuevo): exporta `securityHeaders` como array de `{ key, value }`. Única fuente de verdad de las cinco cabeceras: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` y `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`.
- `next.config.ts`: bloque `headers()` que importa `securityHeaders` y las aplica a `source: "/(.*)"`, sin tocar `allowedDevOrigins`. Cubre toda respuesta, incluidos los assets estáticos.
- `proxy.ts` (nuevo, raíz del proyecto): export nombrado `proxy` más `export const config`, con la forma exacta del ejemplo del doc de Next 16. Devuelve `NextResponse.next()` y aplica sobre él las mismas `securityHeaders`. `matcher: "/((?!_next/static|_next/image|favicon.ico).*)"`.
- `lib/auth/password.ts` (nuevo): única fuente de verdad del formato de contraseña en cliente —mínimo 8 caracteres, y al menos una minúscula, una mayúscula, un dígito y un símbolo—. Devuelve el detalle de qué requisitos faltan, no solo un booleano.
- `components/LoginCard.tsx` y `app/auth/reset/page.tsx`: usan ese helper. Lista de requisitos visible bajo el campo de contraseña, marcando cuáles se cumplen mientras se escribe, y bloqueo del envío hasta que se cumplan todos.
- `authErrorMessage`: mensajes en castellano para los errores nuevos de Supabase (contraseña débil y contraseña filtrada).
- `references/security/dashboard-config.md` (nuevo): registro versionado de cada ajuste de dashboard, con su valor, la ruta exacta en el dashboard y la fecha en que se aplicó.
- `references/security/checklist.md`: se marcan las casillas cumplidas.

**Fuera de alcance (para specs futuros):**

- `Content-Security-Policy`. Requiere nonces vía proxy y verificación pantalla por pantalla contra los canvas, los estilos inline de Next y los redirects de OAuth. Merece su propio spec.
- Rate limiting propio en `/api/scores` y `/api/contact`. No está en el checklist y necesita decidir almacén (memoria vs tabla) para que funcione en serverless.
- Refresco de la sesión de Supabase desde `proxy.ts`.
- Validación de contraseña en servidor propio. La autoridad sigue siendo Supabase Auth; `lib/auth/password.ts` es solo UX de cliente.
- Anti-cheat en el envío de puntajes. `/api/scores` sigue confiando en el `score` que manda el navegador.
- MFA, captcha en el registro, y rotación de las claves de Supabase.
- Cambiar cualquier política RLS existente.

## Modelo de datos

Este spec **no introduce ninguna tabla, columna ni política nueva**. La base de datos solo cambia en los atributos de dos funciones ya existentes.

La única estructura nueva es de cliente, en `lib/auth/password.ts`:

```ts
// Requisitos de contraseña, en el orden en que se muestran al usuario.
type PasswordRuleId = "length" | "lowercase" | "uppercase" | "digit" | "symbol";
type PasswordRule = {
  id: PasswordRuleId;
  label: string; // p. ej. "Al menos 8 caracteres"
  test: (value: string) => boolean;
};
type PasswordCheck = {
  valid: boolean; // true solo si las 5 reglas pasan
  failed: PasswordRuleId[]; // reglas incumplidas, en orden
};
```

Convenciones:

- `symbol` = cualquier carácter que no sea `[A-Za-z0-9]` ni espacio en blanco. Es el conjunto que Supabase acepta como símbolo con `password_required_characters` activado.
- Las reglas se evalúan sobre el valor sin recortar: un espacio al principio cuenta como carácter, igual que en Supabase.
- `PASSWORD_RULES` se exporta como array para que el formulario pinte la lista sin duplicar los textos.

## Plan de implementación

1. **Verificar el estado de partida.** Confirmar con el MCP de Supabase que RLS sigue habilitado en `games`, `scores` y `profiles`, y guardar la salida de `get_advisors("security")` como línea base (hoy: 3 warnings). Sin cambios de código. Este paso existe para poder demostrar el antes y el después.
2. **Migración `harden_security_definer_functions`.** Un solo `apply_migration` con dos sentencias: `alter function public.nickname_available(text) security invoker` y `revoke execute on function public.rls_auto_enable() from public, anon, authenticated`. Prueba manual: `get_advisors("security")` baja de 3 warnings a 1 (queda solo el de leaked password protection).
3. **Comprobar que el registro de nick sigue funcionando.** Con `npm run dev`, abrir `/login`, escribir un nick ya ocupado y otro libre: la comprobación de disponibilidad debe seguir respondiendo igual que antes de la migración. Es la única regresión posible del paso 2.
4. **Crear `lib/security-headers.ts`** con la constante `securityHeaders`.
5. **Cabeceras en `next.config.ts`.** `headers()` asíncrono que aplica `securityHeaders` a `source: "/(.*)"`, importándolas del módulo del paso 4, sin tocar `allowedDevOrigins`. Prueba manual: `npm run build && npm run start`, comprobar las cinco cabeceras en la respuesta de `/`.
6. **Crear `proxy.ts` en la raíz** siguiendo la convención de `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`: export nombrado `proxy(request: NextRequest)` que devuelve `NextResponse.next()` con las cabeceras aplicadas, y `export const config` con el matcher que excluye `_next/static`, `_next/image` y `favicon.ico`. Prueba manual: `/about` sigue cargando y `/` sigue devolviendo las cinco cabeceras.
7. **Crear `lib/auth/password.ts`.** Exporta `PASSWORD_RULES`, `checkPassword(value): PasswordCheck` y `PASSWORD_MIN_LENGTH = 8`. Módulo puro, sin dependencias ni imports de React.
8. **Enganchar el helper en `components/LoginCard.tsx`.** En modo registro: lista de requisitos bajo el campo de contraseña, cada uno marcado cuando `checkPassword` lo da por bueno, y el botón de envío deshabilitado mientras `valid` sea `false`. En modo acceso no se valida nada: una cuenta antigua puede tener una contraseña que ya no cumple el formato nuevo, y bloquearle la entrada sería un bug.
9. **Enganchar el helper en `app/auth/reset/page.tsx`.** Misma lista de requisitos y mismo bloqueo del envío que en el registro.
10. **Ampliar `authErrorMessage`.** Mapear a castellano los errores de Supabase por contraseña débil y por contraseña filtrada (HaveIBeenPwned). Son los dos errores nuevos que la config del paso 11 puede devolver.
11. **Aplicar la configuración en el dashboard de Supabase.** Authentication → Sign In / Providers → Email: minimum password length `8`, password requirements `Lowercase, uppercase letters, digits and symbols`, leaked password protection activado. Authentication → Rate Limits: signups `30` por hora por IP.
12. **Escribir `references/security/dashboard-config.md`.** Una fila por ajuste: qué se cambió, valor anterior, valor nuevo, ruta en el dashboard y fecha. Encabezado que advierte de que estos ajustes no viven en el repo y que hay que reaplicarlos si el proyecto de Supabase se recrea.
13. **Verificación final.** `get_advisors("security")` debe devolver la lista vacía. Con `npm run build && npm run start`, Playwright comprueba las cinco cabeceras en la respuesta de `/`. Marcar las casillas de `references/security/checklist.md` y correr `npm run lint`.

## Criterios de aceptación

**Base de datos**

- [ ] `get_advisors("security")` devuelve una lista de lints vacía.
- [ ] `pg_proc.prosecdef` es `false` para `public.nickname_available(text)`.
- [ ] `has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')` devuelve `false`, y lo mismo para `authenticated`.
- [ ] `relrowsecurity` sigue siendo `true` en `public.games`, `public.scores` y `public.profiles`.
- [ ] `pg_policies` sobre el esquema `public` devuelve las mismas 6 políticas que antes del spec, con el mismo `qual` y `with_check`.
- [ ] En `/login`, escribir un nick ya registrado lo marca como ocupado y escribir uno libre lo marca como disponible.

**Cabeceras**

- [ ] Con `npm run start`, la respuesta de `/` incluye `X-Content-Type-Options: nosniff`.
- [ ] La respuesta de `/` incluye `X-Frame-Options: DENY`.
- [ ] La respuesta de `/` incluye `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] La respuesta de `/` incluye `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- [ ] La respuesta de `/` incluye `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`.
- [ ] Las mismas cinco cabeceras aparecen en la respuesta de `/game/asteroides/play`.
- [ ] Existe `proxy.ts` en la raíz del proyecto, con un export nombrado `proxy` y un `export const config` con `matcher`.
- [ ] `npm run build` no emite avisos de convención sobre `proxy.ts` ni sobre `middleware.ts`.
- [ ] `/about` responde 200 y renderiza el formulario de contacto — el proxy no lo redirige.
- [ ] La lista de cabeceras aparece una sola vez en el repo, en `lib/security-headers.ts`; ni `next.config.ts` ni `proxy.ts` la redeclaran.

**Contraseñas**

- [ ] En el formulario de registro, `Abc1!` deja el botón de envío deshabilitado y marca como incumplida la regla de longitud.
- [ ] `abcdefgh1!` deja el botón deshabilitado y marca como incumplida la regla de mayúscula.
- [ ] `Abcdefgh1!` marca las cinco reglas como cumplidas y habilita el botón.
- [ ] Registrarse con `Password123!` (conocida por HaveIBeenPwned) devuelve un mensaje en castellano que dice que la contraseña está filtrada.
- [ ] En el formulario de acceso, escribir una contraseña que no cumple el formato **no** deshabilita el botón.
- [ ] `app/auth/reset/page.tsx` muestra la misma lista de requisitos y bloquea el envío con la misma condición.

**Registro y limpieza**

- [ ] `references/security/dashboard-config.md` existe y lista los cuatro ajustes de Auth con su valor y su ruta en el dashboard.
- [ ] Las cinco casillas de `references/security/checklist.md` están marcadas.
- [ ] `npm run lint` pasa sin errores.
- [ ] `npm run build` pasa sin errores.

## Decisiones

- **Sí:** `nickname_available` pasa a `SECURITY INVOKER`. `profiles` ya tiene `select` público para `anon`, así que el `DEFINER` no aportaba nada y solo abría superficie.
- **No:** revocar el `EXECUTE` de `nickname_available`. Obligaría a mover la comprobación de nick a una route handler nueva por el mismo resultado en el linter.
- **Sí:** `revoke execute` sobre `rls_auto_enable`. Es un `event trigger` de la plataforma; devuelve `event_trigger` y ningún cliente lo llama por RPC.
- **No:** tocar las políticas RLS existentes. Ya son correctas y cambiarlas es riesgo puro sin ganancia.
- **Sí:** los ajustes de Auth se aplican a mano en el dashboard. El MCP de Supabase no expone la config de Auth, y la alternativa —Management API— exigiría un `SUPABASE_ACCESS_TOKEN` de cuenta en el entorno.
- **Sí:** `references/security/dashboard-config.md`. Sin él, la mitad del spec no deja rastro en el repo y no se puede reauditar ni reproducir si el proyecto de Supabase se recrea.
- **Sí:** requisitos de contraseña completos (minúscula, mayúscula, dígito, símbolo, 8 caracteres) en vez de solo la longitud del checklist. El coste es el mismo ajuste de dashboard y sube bastante el listón.
- **Sí:** la validación de contraseña solo bloquea en registro y en reset, nunca en el acceso. Una cuenta creada antes de este spec puede tener una contraseña que ya no cumple el formato, y bloquearle la entrada sería un bug.
- **Sí:** `lib/security-headers.ts` como fuente única, importada por `next.config.ts` y por `proxy.ts`. Dos listas separadas divergen en el primer cambio.
- **Sí:** mantener las cabeceras en `next.config.ts` **además** del proxy. La config las aplica también a las respuestas que el matcher excluye; el proxy usa `.set`, así que reescribe el mismo valor y no duplica nada.
- **No:** copiar el ejemplo del doc de Next literalmente (`/about/:path*` → `/home`). Este proyecto tiene `/about` y no tiene `/home`: dejaría una pantalla existente redirigiendo a un 404. Se conserva la forma del ejemplo, no su comportamiento.
- **No:** `Content-Security-Policy`. Necesita nonces vía proxy y verificación pantalla por pantalla contra canvas, estilos inline de Next y redirects de OAuth.
- **No:** rate limiting propio en `/api/scores` y `/api/contact`. Fuera del checklist y sin decidir el almacén.
- **Sí:** `30` signups/hora/IP, el valor por defecto de Supabase. Corta bots sin bloquear una IP compartida de aula u oficina.

## Riesgos

| Riesgo                                                                                                    | Mitigación                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nickname_available` como `INVOKER` deja de funcionar si algún día se restringe el `select` de `profiles` | La función pasa a depender de `profiles_select_public`. El paso 3 del plan lo verifica, y queda anotado aquí: si se restringe ese `select`, hay que revisar la función. |
| Los ajustes del dashboard no están en el repo y se pierden al recrear el proyecto                         | `references/security/dashboard-config.md` los registra con valor y ruta exacta, y su encabezado avisa de que hay que reaplicarlos.                                      |
| Usuarios existentes con contraseñas que ya no cumplen el formato nuevo                                    | La política solo aplica a contraseñas nuevas. El formulario de acceso no valida formato, así que nadie queda fuera de su cuenta.                                        |
| `HSTS` con `preload` es difícil de revertir en el dominio                                                 | `max-age` de 2 años solo afecta al dominio de producción, que ya sirve HTTPS. En local no hay efecto porque `localhost` está exento.                                    |
| `proxy.ts` corre en cada request y añade latencia                                                         | Solo hace `NextResponse.next()` y cinco `headers.set`. Sin I/O, sin `await`, y el matcher excluye `_next/static`, `_next/image` y `favicon.ico`.                        |
| El límite de 30 signups/hora bloquea una demo en un aula con IP compartida                                | El valor es ajustable en caliente desde el dashboard. Queda anotado en `dashboard-config.md` como el número a subir temporalmente si hace falta.                        |

## Lo que **no** entra en este spec

- `Content-Security-Policy` y los nonces que necesita.
- Rate limiting propio en `/api/scores` y `/api/contact`.
- Anti-cheat en el envío de puntajes.
- Refresco de la sesión de Supabase desde `proxy.ts`.
- MFA, captcha en el registro y rotación de claves.
- Cualquier cambio en las políticas RLS existentes.

Cada una de esas cosas, si llega, va en su propio spec.
