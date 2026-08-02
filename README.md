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

Sin estas variables, `POST /api/contact` responde `500`.

## Commands

```bash
npm run dev     # start dev server (Turbopack)
npm run build   # production build
npm run start   # run production build
npm run lint    # eslint (flat config, eslint.config.mjs)
```
