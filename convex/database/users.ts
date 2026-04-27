import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";

type ReadCtx = QueryCtx | MutationCtx;

/**
 * Resolves the current Convex user document id for a query, or null if
 * unauthenticated or the user row has not been created yet.
 */
export async function getUserIdForQuery(
  ctx: ReadCtx,
): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  return user?._id ?? null;
}

/**
 * Returns the current user's id, upserting the `users` row from the JWT
 * (same data as `storeCurrent`).
 */
export async function requireUserId(ctx: MutationCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Debes iniciar sesión para continuar.");
  }

  const existing = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  const now = Date.now();
  const patch = {
    clerkUserId: identity.subject,
    email: identity.email ?? undefined,
    name: identity.name ?? undefined,
    pictureUrl: identity.pictureUrl ?? undefined,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }

  return await ctx.db.insert("users", {
    tokenIdentifier: identity.tokenIdentifier,
    ...patch,
    createdAt: now,
  });
}

export const storeCurrent = mutation({
  args: {},
  handler: async (ctx) => {
    return await requireUserId(ctx);
  },
});

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});
