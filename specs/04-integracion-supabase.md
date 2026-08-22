# Spec 04 — Integración de Supabase

**Estado:** Implementado
**Depende de:** 03-about-contacto
**Fecha:** 2026-08-22

**Objetivo:** Cablear Supabase en el proyecto Next.js (SDK, variables de entorno y clientes browser/server) sin crear tablas, autenticación ni consumo desde la UI.

## Scope

**Incluye:**

- Dependencias nuevas: `@supabase/supabase-js` y `@supabase/ssr` en `package.json`.
- `lib/supabase/client.ts` — cliente para browser (client components), creado con `createBrowserClient` de `@supabase/ssr`.
- `lib/supabase/server.ts` — cliente para server components y route handlers, creado con `createServerClient` de `@supabase/ssr`, leyendo/escribiendo cookies vía `cookies()` de `next/headers`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, agregadas a `.env.template` (con placeholders) y a `.env.local` (con los valores reales del proyecto `tfyxzdctimnkrdnqtzfi`).
- Documentar en README las env vars requeridas para Supabase.
- Verificación: `npm run build` compila sin errores.

**NO incluye (fuera de este spec):**

- Crear tablas, migraciones, políticas RLS o cualquier objeto en el proyecto Supabase remoto — el schema `public` queda vacío tal como está hoy.
- Configurar Supabase Auth (providers, confirmación de email) y conectar `/login` — sigue con el login fake sobre `localStorage.av_user`.
- `middleware.ts` de refresco de sesión — entra en el spec de auth.
- Migrar `GAMES`, `PLAYERS` o `seededScores` de `lib/data.ts` a base de datos; Hall of Fame y `/game/[id]/play` siguen con datos mock.
- Realtime y Edge Functions — mencionados como uso futuro, no se preparan en este spec.
- Tipos TypeScript generados del schema (`generate_typescript_types`) — no hay tablas todavía; los clientes quedan sin genérico `Database`.
- Cualquier consulta a Supabase desde componentes, rutas o API routes existentes.
- Tests automatizados (no hay test runner configurado).

## Modelo de datos

Este spec **no introduce estructuras de datos nuevas**: no hay tablas en Supabase, no se tocan los tipos de `lib/data.ts` (`Game`, `ScoreRow`, etc.).

Lo único que se define es el contrato de los dos clientes:

```ts
// lib/supabase/client.ts — uso en client components
export function createClient(): SupabaseClient;

// lib/supabase/server.ts — uso en server components / route handlers
export async function createClient(): Promise<SupabaseClient>;
```

Notas:

- El cliente server es `async` porque `cookies()` de `next/headers` es asíncrono en Next 16.
- Ninguno lleva el genérico `Database` todavía (no hay schema del cual generar tipos); se agrega en el spec que cree las primeras tablas.
- Ambos leen las mismas env vars:

```
NEXT_PUBLIC_SUPABASE_URL=https://tfyxzdctimnkrdnqtzfi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key del proyecto>
```

## Plan de implementación

1. **Consultar la doc vendored.** Antes de escribir código, revisar `node_modules/next/dist/docs/` (file conventions y `04-functions/cookies`) para confirmar la firma de `cookies()` en Next 16.2.10 y el uso correcto en server components vs. route handlers.

2. **Instalar dependencias.** `npm install @supabase/supabase-js @supabase/ssr`.

3. **Variables de entorno.** Agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `.env.template` con placeholders, y a `.env.local` con los valores reales del proyecto `tfyxzdctimnkrdnqtzfi` (URL y publishable key obtenidas del dashboard/MCP). No versionar `.env.local`.

4. **Cliente browser.** Crear `lib/supabase/client.ts` exportando `createClient()` construido con `createBrowserClient` de `@supabase/ssr` y las dos env vars.

5. **Cliente server.** Crear `lib/supabase/server.ts` exportando `async function createClient()` construido con `createServerClient`, pasando el adaptador de cookies (`getAll` / `setAll`) sobre `await cookies()`, con el `try/catch` en `setAll` para el caso de server components (donde escribir cookies lanza).

6. **Documentar env vars.** Agregar en README la sección de variables de entorno de Supabase, indicando que sin ellas los clientes fallan al instanciarse.

7. **Verificación.** Correr `npm run lint` y `npm run build`: deben pasar sin errores. No se agrega ninguna llamada de prueba ni ruta de health-check; la integración queda lista para el spec de auth.

## Criterios de aceptación

- [ ] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr` como dependencias.
- [ ] Existe `lib/supabase/client.ts` que exporta `createClient()` usando `createBrowserClient`.
- [ ] Existe `lib/supabase/server.ts` que exporta `async createClient()` usando `createServerClient` con adaptador de cookies (`getAll`/`setAll`) sobre `await cookies()`.
- [ ] Ambos clientes leen `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, sin URLs ni keys hardcodeadas.
- [ ] `.env.template` lista las dos variables con placeholders; `.env.local` tiene los valores reales y no está versionado.
- [ ] README documenta las dos variables de entorno de Supabase.
- [ ] `npm run lint` pasa sin errores ni warnings nuevos.
- [ ] `npm run build` compila sin errores.
- [ ] El schema `public` del proyecto Supabase sigue vacío: cero tablas, cero migraciones, cero cambios de configuración de Auth.
- [ ] Ninguna pantalla existente (`/`, `/biblioteca`, `/game/*`, `/hall-of-fame`, `/login`, `/about`) cambia de comportamiento: no hay imports de los clientes Supabase fuera de `lib/supabase/`.

## Decisiones tomadas y descartadas

- **`@supabase/ssr` además de `@supabase/supabase-js`.** Se descarta instalar solo `supabase-js` porque el patrón oficial para App Router requiere `createBrowserClient`/`createServerClient`; dejarlo para después obligaría a reescribir los clientes cuando llegue auth.

- **Dos clientes separados (`client.ts` / `server.ts`) en vez de uno solo.** Se descarta un `lib/supabase.ts` único porque browser y server tienen manejo de cookies distinto; separarlos ahora evita que un cliente de browser termine importado en un server component.

- **Sin `middleware.ts`.** Se descarta incluir el middleware de refresco de sesión porque sin auth configurada no hace nada útil y agregaría un hop en cada request; entra en el spec de auth.

- **Sin tablas ni configuración de Auth en el proyecto remoto.** Decisión explícita del usuario: la integración es solo cableado local. El schema `public` queda vacío hasta el spec que defina el modelo de datos real.

- **Sin tipos generados del schema.** Se descarta correr la generación de tipos porque no hay tablas; los clientes quedan sin genérico `Database` y se agrega cuando exista schema.

- **Verificación solo por compilación.** Se descarta un health-check permanente (`/api/health/supabase`) o una prueba de conexión temporal: sin tablas ni sesión no hay nada significativo que consultar, y una ruta extra sería código muerto a mantener.

- **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en vez de `ANON_KEY`.** Se adopta la nomenclatura nueva de Supabase para no arrastrar el nombre legacy desde el primer commit.

- **Realtime y Edge Functions fuera de scope.** Se mencionaron como uso futuro; no se instala ni configura nada anticipadamente para evitar dependencias sin uso.

## Riesgos identificados

- **Env vars ausentes rompen el build o el runtime.** `createBrowserClient`/`createServerClient` lanzan si la URL o la key son `undefined`. Como todavía nadie los invoca, el riesgo es latente: aparecerá en el primer spec que los use. Mitigación: paso 3 del plan las deja configuradas en `.env.local` y documentadas en `.env.template` y README desde ya.

- **La publishable key queda expuesta en el bundle** (prefijo `NEXT_PUBLIC_`). Es el comportamiento esperado de esa key, pero solo es seguro si toda tabla futura tiene RLS activo. Mitigación: el spec que cree las primeras tablas debe habilitar RLS obligatoriamente; se deja registrado aquí.

- **Código sin consumidores puede quedar desactualizado.** Los dos clientes no se usan en ninguna pantalla, así que un cambio de API en `@supabase/ssr` no se detectaría hasta el spec de auth. Mitigación: el spec de auth revalida los clientes contra la doc vigente antes de construir sobre ellos.

- **La firma de `cookies()` en Next 16 puede diferir de lo asumido.** Mitigación: paso 1 del plan obliga a consultar `node_modules/next/dist/docs/` antes de escribir el cliente server.
