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

## Commands

## Hola Mundo