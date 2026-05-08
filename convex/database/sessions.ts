import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { getUserIdForQuery, requireUserId } from "./users";

/** Pool fijo de sesiones (`index` 0..3) que rota el cron; la semilla inserta las filas iniciales. */
const SESSION_POOL_MIN = 0;
const SESSION_POOL_MAX_EXCLUSIVE = 4;

const INACTIVE_SESSION_SEED: ReadonlyArray<{
  liAt: string;
  jsessionId: string;
  index: number;
}> = [
  {
    index: 0,
    liAt:
      "AQEDAWgpLt4CRDvlAAABngU7dj8AAAGeKUf6P00AXd9sKidwxvpMI9NZZvCGFqh19S9fZmAahhJGi1tO0kWO-aWn_KdCS6ID3ISkIj3Bq3SfTW6TUsYhD9o71VEDnhdyDR9LGKQSJ11m5SdPk0UxKWYi",
    jsessionId: "ajax:3370261471465156511",
  },
  {
    index: 1,
    liAt:
      "AQEDAWgpMsoD7bAlAAABngU-rDIAAAGeKUswMk0AhoXXj0V8ICyMRlI6lIxzXcsp4B8P9AVFiPt74P2krn16D-Z-lHtzG52E2N2dlyh0pSSKmAs8jKDeQm08ECpBVy36iq9IQg71yVyRKQvLwL2DeYDN",
    jsessionId: "ajax:1809921106163722809",
  },
  {
    index: 2,
    liAt:
      "AQEDAWgSPd8F2rGuAAABngUjJHgAAAGeKS-oeE4AQXWZlZ9oqoX2ATP6mR1XM6jJcC90do7cpFwwTz2ZssmEjHmm0d_ZM97Mnq_U_VI3lEWs2BxGkBSkFGA0WiT_JiVp8AWIiEZSwJs9ah4Vw8jBVP2k",
    jsessionId: "ajax:8983510416229248706",
  },
  {
    index: 3,
    liAt:
      "AQEDAWgSQf0DDrRSAAABngUm_HwAAAGeKTOAfE4AEGErRPRK3ZMcQR6Kq5PxXMKz74oglCvBlXwpDCoKWaORWbYRrAQypp4uAuoAiKrwZR2PfusWCQ-QzaOKA-bPR4zTulUnDSkJYyCifHB07oRwtcPZ",
    jsessionId: "ajax:3358240095149689267",
  },
];

export const getCurrentForViewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return null;
    }
    const row = await ctx.db
      .query("sessions")
      .withIndex("by_current", (q) => q.eq("current", true))
      .first();
    if (!row) {
      return null;
    }
    return { liAt: row.liAt, jsessionId: row.jsessionId };
  },
});

export const getCurrentInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("sessions")
      .withIndex("by_current", (q) => q.eq("current", true))
      .first();
    if (!row) {
      return null;
    }
    return { liAt: row.liAt, jsessionId: row.jsessionId };
  },
});

/**
 * Cron (cada 30 min): deja una sola sesión `current: true` en el pool index 0..3,
 * rotando 0 → 1 → 2 → 3 → 0. Todas las demás filas pasan a `current: false`.
 */
export const rotateLinkedInSessionPool = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("sessions").collect();
    const pool = all.filter(
      (d) =>
        d.index !== undefined &&
        d.index >= SESSION_POOL_MIN &&
        d.index < SESSION_POOL_MAX_EXCLUSIVE,
    );
    if (pool.length === 0) {
      return { ok: false as const, reason: "no_pool_rows" as const };
    }

    pool.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    const currentInPool = pool.find((d) => d.current);
    let nextIndex =
      currentInPool?.index !== undefined
        ? (currentInPool.index + 1) % SESSION_POOL_MAX_EXCLUSIVE
        : SESSION_POOL_MIN;

    const nextDoc = pool.find((d) => d.index === nextIndex);
    if (!nextDoc) {
      return {
        ok: false as const,
        reason: "missing_pool_index" as const,
        nextIndex,
      };
    }

    for (const d of all) {
      if (d.current) {
        await ctx.db.patch(d._id, { current: false });
      }
    }

    await ctx.db.patch(nextDoc._id, { current: true });
    return {
      ok: true as const,
      activeIndex: nextIndex,
    };
  },
});

/**
 * Inserta las sesiones semilla con `current: false` si no existen ya (misma `jsessionId`).
 * Invocable desde CLI (deployment dev): `pnpm exec convex run database/sessions:seedInactiveLinkedInSessions '{}'`
 * con `CONVEX_DEPLOYMENT` apuntando al dev deployment, o desde el dashboard de Convex.
 */
export const seedInactiveLinkedInSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("sessions").collect();
    const byJsession = new Map(
      existing.map((d) => [d.jsessionId.trim(), d]),
    );
    let inserted = 0;
    let indexPatched = 0;
    let unchanged = 0;
    for (const row of INACTIVE_SESSION_SEED) {
      const jsessionId = row.jsessionId.trim();
      const liAt = row.liAt.trim();
      const index = row.index;
      const doc = byJsession.get(jsessionId);
      if (doc) {
        if (doc.index !== index) {
          await ctx.db.patch(doc._id, { index });
          indexPatched += 1;
        } else {
          unchanged += 1;
        }
        continue;
      }
      await ctx.db.insert("sessions", {
        liAt,
        jsessionId,
        current: false,
        index,
      });
      inserted += 1;
    }
    return { inserted, indexPatched, unchanged };
  },
});

/**
 * Desactiva sesiones anteriores e inserta la nueva como `current: true`.
 */
export const setCurrentSession = mutation({
  args: {
    liAt: v.string(),
    jsessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const liAt = args.liAt.trim();
    const jsessionId = args.jsessionId.trim();
    if (!liAt || !jsessionId) {
      throw new Error("li_at y JSESSIONID no pueden estar vacíos.");
    }
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_current", (q) => q.eq("current", true))
      .collect();
    for (const doc of existing) {
      await ctx.db.patch(doc._id, { current: false });
    }
    await ctx.db.insert("sessions", {
      liAt,
      jsessionId,
      current: true,
    });
  },
});
