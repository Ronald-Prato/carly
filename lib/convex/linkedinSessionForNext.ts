import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import type { LinkedInSessionCredentials } from "@/lib/linkedin/linkedinClient";

export async function convexJwtFromClerk(): Promise<string | null> {
  const { getToken } = await auth();
  try {
    return (await getToken({ template: "convex" })) ?? null;
  } catch {
    return null;
  }
}

/**
 * Credenciales LinkedIn guardadas en Convex (`sessions` con `current: true`).
 * Requiere usuario autenticado en Clerk con JWT template `convex`.
 */
export async function linkedInSessionForNextHandler(
  convexJwt: string,
): Promise<LinkedInSessionCredentials> {
  const row = await fetchQuery(
    api.database.sessions.getCurrentForViewer,
    {},
    { token: convexJwt },
  );
  if (!row?.liAt?.trim() || !row?.jsessionId?.trim()) {
    throw new Error(
      "No hay sesión LinkedIn activa. Ejecuta la mutación `database.sessions.setCurrentSession` con li_at y JSESSIONID.",
    );
  }
  return { liAt: row.liAt, jsessionId: row.jsessionId };
}
