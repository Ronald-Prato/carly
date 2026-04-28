import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserIdForQuery, requireUserId } from "./database/users";

function postingIdFromCard(card: unknown): string | null {
  if (!card || typeof card !== "object") {
    return null;
  }
  const id = (card as Record<string, unknown>).id;
  if (typeof id !== "string") {
    return null;
  }
  const t = id.trim();
  return t.length > 0 ? t : null;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return [];
    }
    const rows = await ctx.db
      .query("savedJobOffers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    rows.sort((a, b) => b.savedAt - a.savedAt);
    return rows.map((r) => ({
      _id: r._id,
      savedAt: r.savedAt,
      card: r.card,
    }));
  },
});

/** Ids de vacantes guardadas (para estado del botón guardar en `/jobs`). */
export const postingIds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return [];
    }
    const rows = await ctx.db
      .query("savedJobOffers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((r) => r.linkedInPostingId);
  },
});

export const save = mutation({
  args: { card: v.any() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const postingId = postingIdFromCard(args.card);
    if (!postingId) {
      throw new Error("La oferta no tiene identificador válido.");
    }

    const existing = await ctx.db
      .query("savedJobOffers")
      .withIndex("by_userId_and_linkedInPostingId", (q) =>
        q.eq("userId", userId).eq("linkedInPostingId", postingId),
      )
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { card: args.card, savedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("savedJobOffers", {
      userId,
      linkedInPostingId: postingId,
      card: args.card,
      savedAt: now,
    });
  },
});

export const remove = mutation({
  args: { linkedInPostingId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const pid = args.linkedInPostingId.trim();
    if (!pid) {
      throw new Error("Identificador de oferta inválido.");
    }

    const existing = await ctx.db
      .query("savedJobOffers")
      .withIndex("by_userId_and_linkedInPostingId", (q) =>
        q.eq("userId", userId).eq("linkedInPostingId", pid),
      )
      .unique();

    if (!existing) {
      return false;
    }
    await ctx.db.delete(existing._id);
    return true;
  },
});
