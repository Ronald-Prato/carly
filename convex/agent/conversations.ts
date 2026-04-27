import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getUserIdForQuery, requireUserId } from "../database/users";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return [];
    }
    const rows = await ctx.db
      .query("conversations")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return rows.filter((c) => (c.status ?? "active") === "active");
  },
});

export const get = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return null;
    }
    const doc = await ctx.db.get(args.conversationId);
    if (!doc || doc.userId !== userId) {
      return null;
    }
    if (doc.status === "archived") {
      return null;
    }
    return doc;
  },
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    initialMessages: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const title = (args.title ?? "").trim() || "Sin título";
    return await ctx.db.insert("conversations", {
      userId,
      title,
      messages: args.initialMessages ?? [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const archive = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.conversationId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Conversación no encontrada.");
    }
    await ctx.db.patch(args.conversationId, {
      status: "archived",
      updatedAt: Date.now(),
    });
  },
});

export const patch = mutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.optional(v.string()),
    messages: v.optional(v.array(v.any())),
    /** Resume/CV draft for this conversation (replaces the previous value). */
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.conversationId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Conversación no encontrada.");
    }
    const patch: {
      title?: string;
      messages?: unknown[];
      content?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const t = args.title.trim();
      patch.title = t || doc.title;
    }
    if (args.messages !== undefined) {
      patch.messages = args.messages;
    }
    if (args.content !== undefined) {
      patch.content = args.content;
    }
    await ctx.db.patch(args.conversationId, patch);
  },
});
