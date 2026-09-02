## Checklist de seguridad básico

  - [x] RLS: Row Level Security habilitado en `games`, `scores` y `profiles` (verificado: `relrowsecurity = true`, 6 políticas intactas)
  - [ ] Minimum password length — mínimo 8 caracteres
  - [ ] Leaked password protection — (el warning 4)
  - [ ] Max signup rate — limitar signups por IP (anti-bot)
  - [x] Headers de seguridad en Next.js — 5 cabeceras en `lib/security-headers.ts`, aplicadas desde `next.config.ts` y `proxy.ts`
  
  Ej:

```ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// En la config de Next.js:
headers: async () => [
  { source: '/(.*)', headers: securityHeaders }
]
```

## Por el ladod e Supabase:

| name                                               | title                                                 | level | facing   | categories   | description                                                                                                                                                                                                              | detail                                                                                                                                                                                                                                                   | remediation                                                                                                            | metadata                                                                                                              | cache_key                                                                                   | observed_at              |
| -------------------------------------------------- | ----------------------------------------------------- | ----- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| anon_security_definer_function_executable          | Public Can Execute SECURITY DEFINER Function          | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.       | Function `public.nickname_available(candidate text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nickname_available`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.          | https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable          | {"name":"nickname_available","schema":"public","language":"sql","arguments":"candidate text","security_definer":true} | anon_security_definer_function_executable_public_nickname_available_candidate text          | 2026-09-02T01:33:16.680Z |
| anon_security_definer_function_executable          | Public Can Execute SECURITY DEFINER Function          | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.       | Function `public.rls_auto_enable()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/rls_auto_enable`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.                              | https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable          | {"name":"rls_auto_enable","schema":"public","language":"plpgsql","arguments":"","security_definer":true}              | anon_security_definer_function_executable_public_rls_auto_enable_                           | 2026-09-02T01:33:16.680Z |
| authenticated_security_definer_function_executable | Signed-In Users Can Execute SECURITY DEFINER Function | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it. | Function `public.nickname_available(candidate text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/nickname_available`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. | https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable | {"name":"nickname_available","schema":"public","language":"sql","arguments":"candidate text","security_definer":true} | authenticated_security_definer_function_executable_public_nickname_available_candidate text | 2026-09-02T01:33:16.680Z |
| authenticated_security_definer_function_executable | Signed-In Users Can Execute SECURITY DEFINER Function | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it. | Function `public.rls_auto_enable()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/rls_auto_enable`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.                     | https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable | {"name":"rls_auto_enable","schema":"public","language":"plpgsql","arguments":"","security_definer":true}              | authenticated_security_definer_function_executable_public_rls_auto_enable_                  | 2026-09-02T01:33:16.680Z |
| auth_leaked_password_protection                    | Leaked Password Protection Disabled                   | WARN  | EXTERNAL | ["SECURITY"] | Leaked password protection is currently disabled.                                                                                                                                                                        | Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security.                                                                                                                 | https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection               | {"type":"auth","entity":"Auth"}                                                                                       | auth_leaked_password_protection                                                             |                          |

## Estado tras el SPEC 12 (2026-09-01)

Las tres casillas sin marcar dependen de la configuración manual del dashboard de Supabase
(paso 11 del spec), que no vive en el repo. Los valores a aplicar y su ruta exacta están en
`references/security/dashboard-config.md`. Al aplicarlos, marcar aquí y poner la fecha allí.

La tabla de lints de más abajo es la **línea base anterior** a la migración
`harden_security_definer_functions`. Estado actual: de esos 5 lints queda solo
`auth_leaked_password_protection`, que se cierra con el ajuste del dashboard.
