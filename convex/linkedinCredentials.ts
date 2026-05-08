import type { LinkedInSessionCredentials } from "../lib/linkedin/linkedinClient";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

export async function linkedInSessionForAction(
  ctx: Pick<ActionCtx, "runQuery">,
): Promise<LinkedInSessionCredentials> {
  const row = await ctx.runQuery(
    internal.database.sessions.getCurrentInternal,
    {},
  );
  if (!row?.liAt?.trim() || !row?.jsessionId?.trim()) {
    throw new Error(
      "No hay sesión LinkedIn activa. Guarda li_at y JSESSIONID con la mutación database.sessions.setCurrentSession (Dashboard Convex o UI).",
    );
  }
  return { liAt: row.liAt, jsessionId: row.jsessionId };
}
