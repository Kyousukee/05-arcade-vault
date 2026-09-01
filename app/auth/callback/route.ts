import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
/**
 * Cierre del flujo OAuth: cambia el `code` por sesión. Sin perfil, el usuario
 * pasa por el onboarding de nick antes de volver a la app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.redirect(`${origin}/auth/nickname`);
  }
  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
}
