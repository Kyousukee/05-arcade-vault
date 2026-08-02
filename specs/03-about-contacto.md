# Spec 03 — About + envío de correo

**Estado:** Approved
**Depende de:** 02-home-y-biblioteca
**Fecha:** 2026-07-23

**Objetivo:** Portar la pantalla "Acerca de" (`about.jsx`) a `/about` con su formulario de contacto, conectado a un endpoint real que envía el mensaje por correo usando Resend.

## Scope

**Incluye:**
- Ruta `/about` — contenido de `references/resources/home-about/about.jsx` portado a TSX: hero (kicker, título, misión, 3 highlights con iconos SVG), divider decorativo con animación reveal, sección contacto (intro + tips) y formulario (nombre, correo, mensaje).
- Componente `components/About.tsx` (client component) con el hook `useReveal`/`IntersectionObserver` igual al patrón ya usado en `Home.tsx`.
- `app/api/contact/route.ts` — API route que recibe `{ name, email, msg }`, valida server-side (campos no vacíos, email con formato válido), y envía el correo vía Resend SDK.
- Envío de correo: `from: "Arcade Vault <onboarding@resend.dev>"`, `subject: "Nuevo mensaje de contacto — {name}"`, cuerpo texto plano con name/email/msg. Destinatario tomado de env var `CONTACT_EMAIL`.
- Manejo de estados en el form: idle → enviando → éxito (pantalla terminal existente en `about.jsx`) → error (banner inline, form se mantiene con los datos ingresados, permite reintentar).
- `components/Nav.tsx` — agregar link "Acerca de" → `/about` (desktop y mobile), con `isActive` correspondiente.
- Dependencia nueva: paquete `resend` en `package.json`.
- Documentar en el spec (no crear ahora) las env vars requeridas: `RESEND_API_KEY`, `CONTACT_EMAIL` — se agregan a `.env.local` (no versionado) cuando el usuario entregue la API key real.
- Estilos: portar bloque `.about*` (~35 líneas) de `references/resources/home-about/styles.css` a `app/globals.css`.

**NO incluye (fuera de este spec):**
- Dominio propio verificado en Resend — se usa `onboarding@resend.dev` (dominio de pruebas).
- Persistencia del mensaje de contacto (DB, archivo, log) — solo viaja por correo.
- Rate limiting / anti-spam (captcha, throttling) del endpoint.
- Envío de correo de confirmación al remitente (solo se notifica al equipo vía `CONTACT_EMAIL`).
- Tests automatizados (no hay test runner configurado).
- Cambios a Home, Biblioteca u otras rutas existentes más allá del link de Nav.

## Modelo de datos

No se agregan tipos a `lib/data.ts` (sin persistencia, sin mock data nuevo). Se define el contrato del endpoint:

**Request** — `POST /api/contact`, body JSON:
```ts
type ContactPayload = {
  name: string;
  email: string;
  msg: string;
};
```

**Response:**
- `200 { ok: true }` — correo enviado.
- `400 { ok: false, error: string }` — validación falló (campo vacío o email con formato inválido).
- `500 { ok: false, error: string }` — falló el envío vía Resend (API key inválida, red, etc.).

Estado local del form en `components/About.tsx` (no exportado, interno al componente):
```ts
type FormState = { name: string; email: string; msg: string };
type SubmitStatus = "idle" | "sending" | "sent" | "error";
```

## Plan de implementación

1. **Instalar dependencia.** Agregar `resend` a `package.json` (`npm install resend`).

2. **Estilos About.** Portar el bloque `.about`, `.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`, `.about-divider`, `.div-bar`, `.div-pixels`, `.about-contact`, `.contact-grid` (y selectores relacionados, ~35 líneas) de `references/resources/home-about/styles.css` a `app/globals.css`.

3. **API route.** Crear `app/api/contact/route.ts`: handler `POST` que parsea el body, valida `name`/`email`/`msg` no vacíos y formato de `email`, y si pasa, llama a Resend (`new Resend(process.env.RESEND_API_KEY)`) enviando a `process.env.CONTACT_EMAIL` con el `from`/`subject`/body definidos en el modelo de datos. Devuelve `200`/`400`/`500` según corresponda.

4. **Componente About.** Crear `components/About.tsx` (client component) portando `about.jsx`: hero, highlights (`HighlightIcon` con los 3 SVG), divider, sección contacto con form. Reemplazar el `onSubmit` mock (que solo hacía `setSent`) por un `fetch("/api/contact", { method: "POST", body: JSON.stringify(form) })` real, manejando estados `idle`/`sending`/`sent`/`error`. Mantener la validación client-side existente (shake si hay campos vacíos) antes de llamar al fetch.

5. **Estado de error en UI.** Agregar bloque de error inline en el form (banner) que se muestra cuando `status === "error"`, sin perder los datos ya ingresados, permitiendo reintentar el envío.

6. **Ruta `/about`.** Crear `app/about/page.tsx` que renderiza `<About />`.

7. **Actualizar Nav.** En `components/Nav.tsx`: agregar link "Acerca de" → `/about` (desktop y mobile), actualizar `isActive` para que resalte solo en `/about`.

8. **Documentar env vars.** Dejar constancia (README o comentario en `route.ts`) de que se requieren `RESEND_API_KEY` y `CONTACT_EMAIL` en `.env.local` para que el envío funcione; sin ellas el endpoint responde `500`.

9. **Verificación.** Levantar `npm run dev`, recorrer `/about` comparando aspecto contra `about.jsx`/`arcade-vault-standalone.html`, probar el form: campos vacíos → shake, submit válido sin env vars configuradas → error inline, y (una vez el usuario entregue `RESEND_API_KEY` real) submit válido → pantalla de éxito y correo recibido en `CONTACT_EMAIL`.

## Criterios de aceptación

- [ ] `npm run build` compila sin errores.
- [ ] `/about` muestra hero, misión, 3 highlights, divider animado y sección de contacto, con aspecto visual equivalente a `about.jsx`/`arcade-vault-standalone.html`.
- [ ] Nav muestra link "Acerca de" (desktop y mobile) que navega a `/about` y resalta como activo solo en `/about`.
- [ ] Form: si `name`, `email` o `msg` están vacíos, no se envía y se dispara la animación shake (igual que hoy).
- [ ] Form: submit válido con env vars (`RESEND_API_KEY`, `CONTACT_EMAIL`) configuradas envía el correo real vía Resend y muestra la pantalla de éxito (terminal) con el nombre ingresado.
- [ ] Form: submit válido sin `RESEND_API_KEY` configurada (o inválida) muestra banner de error inline, sin perder los datos ingresados, y permite reintentar.
- [ ] `POST /api/contact` responde `400` si el body trae campos vacíos o email con formato inválido, sin llamar a Resend.
- [ ] `POST /api/contact` responde `200 { ok: true }` en envío exitoso y `500` si Resend falla.
- [ ] Botón "ENVIAR OTRO MENSAJE" en pantalla de éxito resetea el form a estado vacío/idle.

## Decisiones tomadas y descartadas

- **API Route en vez de Server Action.** Se descarta usar `action={serverAction}` en el `<form>` porque el form ya maneja estados custom (`sent`/`shake`) con `fetch` explícito da más control sobre loading/error inline sin pelear con la semántica de Server Actions + `useFormState`.

- **Dominio de pruebas `onboarding@resend.dev`.** Se descarta configurar dominio propio verificado porque el proyecto no tiene uno todavía; migrar el `from` a un dominio propio queda como cambio de una línea a futuro, no amerita spec propio.

- **`CONTACT_EMAIL` como env var, no hardcodeado.** Se descarta un correo fijo en código para no requerir un deploy si el destinatario cambia.

- **Validación server-side además de client-side.** Se descarta confiar solo en la validación del form porque el endpoint queda expuesto públicamente (`POST /api/contact`); revalidar evita requests malformados o maliciosos directos al endpoint.

- **Error inline en vez de éxito falso.** Se descarta mostrar la pantalla de éxito aunque el envío real falle porque engañaría al usuario haciéndole creer que el mensaje llegó cuando no.

- **Sin persistencia del mensaje.** Se descarta guardar el mensaje en DB/archivo porque el proyecto no tiene capa de persistencia (solo mock data en `lib/data.ts`); agregar una ahora ampliaría el scope fuera de lo pedido.

- **Nav "Acerca de" se agrega en este spec** (a diferencia de spec 02, que lo dejó fuera explícitamente). Ahora que `/about` existe como ruta real, tiene sentido exponerla en la navegación en el mismo spec que la crea.

## Riesgos identificados

- **`RESEND_API_KEY` ausente o inválida en producción.** Sin la key configurada, todo submit real falla con `500` y banner de error — el form nunca completa su función. Mitigación: paso 8 del plan documenta explícitamente la env var requerida; criterio de aceptación cubre el caso sin key.

- **Dominio de pruebas `onboarding@resend.dev` con límites de entrega.** Resend restringe este dominio (rate limits bajos, posible bloqueo por spam filters del destinatario). Mitigación: aceptado como riesgo conocido de esta fase; migrar a dominio propio queda fuera de scope y documentado como decisión.

- **Endpoint público sin rate limiting.** `POST /api/contact` puede recibir spam o abuso de envíos repetidos al no tener captcha/throttling. Mitigación: fuera de scope explícito de este spec; validación server-side mitiga solo payloads malformados, no volumen.

- **CSS `.about*` puede chocar con utilidades Tailwind ya presentes en `app/globals.css`.** Mismo riesgo que specs anteriores. Mitigación: revisión visual en paso 9 del plan.
