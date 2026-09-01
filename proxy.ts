import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
/**
 * Convención `proxy` de Next 16 (antes `middleware`). Solo refresca la sesión
 * de Supabase; ninguna ruta se protege aquí.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}
export const config = {
  matcher: [
    /*
     * Todas las rutas menos:
     * - _next/static, _next/image, favicon.ico
     * - /games/** (assets de los juegos servidos desde public/games)
     * - archivos de imagen y audio
     */
    "/((?!_next/static|_next/image|favicon.ico|games/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp3|ogg|wav)$).*)",
  ],
};
