import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { linkedInSessionForAction } from "../linkedinCredentials";
import type { JobSearchCountryCode } from "../../lib/linkedin/jobSearchOptions";
import { resolveCountry } from "../../lib/linkedin/jobSearchOptions";
import { fetchJobsV2Search } from "../../lib/linkedin/jobsV2Search";

export const searchJobsV2 = action({
  args: {
    keywords: v.string(),
    country: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.runQuery(api.database.users.getCurrent, {});
    if (!me) {
      return { ok: false as const, error: "Debes iniciar sesión." };
    }

    try {
      const session = await linkedInSessionForAction(ctx);
      const resolved = resolveCountry(args.country.trim() || null).id;
      const jobs = await fetchJobsV2Search(
        {
          keywords: args.keywords.trim(),
          country: resolved as JobSearchCountryCode,
          limit: args.limit ?? 50,
        },
        session,
      );
      return { ok: true as const, jobs };
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Error al buscar ofertas.";
      return { ok: false as const, error: msg };
    }
  },
});
