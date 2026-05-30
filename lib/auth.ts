export const AUTH_COOKIE = "jasmin_auth";

/**
 * Gera o token de sessão a partir da senha (SHA-256).
 * Usado tanto no middleware (edge) quanto na rota de login (node) —
 * `crypto.subtle` existe nos dois runtimes.
 */
export async function authToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`jasmin:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
