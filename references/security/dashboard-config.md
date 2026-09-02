# Configuración de seguridad en el dashboard de Supabase

> **Estos ajustes NO viven en el repo.** No hay migración ni fichero que los reproduzca: se
> aplican a mano en el dashboard del proyecto `tfyxzdctimnkrdnqtzfi`. Si el proyecto de Supabase
> se recrea, se clona a una organización nueva o se restaura desde un backup, **hay que volver a
> aplicarlos uno por uno con esta tabla delante**, o la plataforma vuelve en silencio a los
> valores por defecto (contraseñas de 6 caracteres, sin comprobación de filtraciones).
>
> Origen: SPEC 12 — Endurecimiento de seguridad. El MCP de Supabase no expone la configuración de
> Auth, y la Management API exigiría un `SUPABASE_ACCESS_TOKEN` de cuenta en el entorno; por eso
> el paso es manual y por eso existe este registro.

## Ajustes de Auth

| Ajuste                        | Valor anterior (por defecto)              | Valor nuevo                                       | Ruta en el dashboard                                    | Aplicado el |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- | ----------- |
| Minimum password length       | `6`                                       | `8`                                               | Authentication → Sign In / Providers → Email            | _pendiente_ |
| Password Requirements         | `No required characters`                  | `Lowercase, uppercase letters, digits and symbols` | Authentication → Sign In / Providers → Email            | _pendiente_ |
| Leaked password protection    | Desactivado                               | Activado (HaveIBeenPwned)                          | Authentication → Sign In / Providers → Email            | _pendiente_ |
| Rate limit de signups         | `30` por hora por IP (por defecto)        | `30` por hora por IP (confirmado explícitamente)   | Authentication → Rate Limits → Sign ups / sign ins       | _pendiente_ |

Sustituir `_pendiente_` por la fecha (`YYYY-MM-DD`) al aplicar cada fila.

## Cómo verificar que siguen aplicados

- `get_advisors("security")` debe devolver una lista de lints **vacía**. Mientras el ajuste de
  leaked password protection esté desactivado, el lint `auth_leaked_password_protection` sigue ahí
  y es el único que queda tras la migración `harden_security_definer_functions`.
- En `/login`, intentar registrarse con `Password123!` (conocida por HaveIBeenPwned) debe devolver
  el mensaje en castellano de contraseña filtrada. Si la deja pasar, la protección está apagada.
- Una contraseña de 7 caracteres debe ser rechazada por Supabase, no solo por el formulario:
  `lib/auth/password.ts` es UX de cliente, la autoridad es Auth.

## Notas de operación

- **El límite de 30 signups/hora/IP es lo que puede romper una demo en un aula o una oficina con
  IP compartida.** Es el número a subir temporalmente desde `Authentication → Rate Limits`, y a
  devolver a `30` al terminar.
- Los requisitos de carácter del dashboard y las reglas de `lib/auth/password.ts` tienen que
  coincidir. Si aquí se cambia uno, hay que cambiar el otro: si no, el formulario deja enviar
  contraseñas que Auth rechaza (o al revés, bloquea contraseñas que Auth aceptaría).
