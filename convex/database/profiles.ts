import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getUserIdForQuery, requireUserId } from "./users";

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return null;
    }
    return await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const upsertCurrent = mutation({
  args: {
    profession: v.optional(v.string()),
    yearsOfExperience: v.optional(v.number()),
    expectedSalary: v.optional(v.number()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    const fields = {
      ...(args.profession !== undefined && { profession: args.profession }),
      ...(args.yearsOfExperience !== undefined && {
        yearsOfExperience: args.yearsOfExperience,
      }),
      ...(args.expectedSalary !== undefined && {
        expectedSalary: args.expectedSalary,
      }),
      ...(args.location !== undefined && { location: args.location }),
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...fields,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      userId,
      ...fields,
      createdAt: now,
      updatedAt: now,
    });
  },
});
