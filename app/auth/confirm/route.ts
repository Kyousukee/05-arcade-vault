import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isValidNickname, normalizeNickname } from "@/lib/auth";
/**
 * Verifica el enlace del correo de confirmación y crea el perfil con el nick
 * elegido en el registro. Si el perfil no se puede crear, manda al onboarding
 * de nick, que es el mismo camino que recorre OAuth.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // El correo llega de dos formas según la plantilla del proyecto: con
  // `token_hash` + `type`, o ya canjeado por Supabase en un `code` (PKCE).
  const code = searchParams.get("code");
  if (!code && (!tokenHash || !type)) {
    return NextResponse.redirect(`${origin}/login?error=confirm`);
  }
  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type: type!, token_hash: tokenHash! });
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=confirm`);
  }
  // La recuperación de contraseña usa este mismo handler: sigue a /auth/reset.
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/auth/reset`);
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=confirm`);
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile) {
    return NextResponse.redirect(`${origin}/`);
  }
  const nickname = normalizeNickname(String(user.user_metadata?.nickname ?? ""));
  if (!isValidNickname(nickname)) {
    return NextResponse.redirect(`${origin}/auth/nickname`);
  }
  const { error: insertError } = await supabase.from("profiles").insert({ id: user.id, nickname });
  if (insertError) {
    return NextResponse.redirect(`${origin}/auth/nickname`);
  }
  return NextResponse.redirect(`${origin}/`);
}
