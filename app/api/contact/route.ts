import { Resend } from "resend";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactPayload = {
  name: string;
  email: string;
  msg: string;
};

// requires RESEND_API_KEY and CONTACT_EMAIL in .env.local — without them every POST returns 500
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ContactPayload>;
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const msg = body.msg?.trim() ?? "";

  if (!name || !email || !msg || !EMAIL_RE.test(email)) {
    return Response.json(
      { ok: false, error: "Datos inválidos. Revisa nombre, correo y mensaje." },
      { status: 400 }
    );
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Arcade Vault <onboarding@resend.dev>",
      to: process.env.CONTACT_EMAIL as string,
      subject: `Nuevo mensaje de contacto — ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\n${msg}`,
    });

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { ok: false, error: "No se pudo enviar el correo." },
      { status: 500 }
    );
  }
}
