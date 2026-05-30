import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

/**
 * Portão de senha: protege /consulta e /api/process.
 * A landing (/) e a página de login ficam públicas.
 */
export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = password ? await authToken(password) : null;
  const authorized = !!expected && cookie === expected;

  if (authorized) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // API → 401 em JSON (pra não quebrar o fetch do front)
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autorizado. Faça login novamente." }, { status: 401 });
  }

  // Páginas → redireciona pro login
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/consulta/:path*", "/api/process/:path*"],
};
