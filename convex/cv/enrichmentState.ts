import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/**
 * Transiciones de estado y resultado del enriquecimiento HTML (solo llamadas
 * internas, p. ej. desde la acción de OpenAI).
 */
export const setProcessing = internalMutation({
  args: {
    resumeId: v.id("resumes"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get("resumes", args.resumeId);
    if (!row || row.userId !== args.userId) {
      throw new Error("CV no encontrada.");
    }
    await ctx.db.patch(args.resumeId, {
      enrichmentStatus: "processing",
      enrichmentError: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const applySuccess = internalMutation({
  args: {
    resumeId: v.id("resumes"),
    userId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get("resumes", args.resumeId);
    if (!row || row.userId !== args.userId) {
      throw new Error("CV no encontrada.");
    }
    const now = Date.now();
    await ctx.db.patch(args.resumeId, {
      content: args.content,
      enrichmentStatus: "ready",
      enrichmentError: undefined,
      updatedAt: now,
    });
  },
});

export const applyError = internalMutation({
  args: {
    resumeId: v.id("resumes"),
    userId: v.id("users"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get("resumes", args.resumeId);
    if (!row || row.userId !== args.userId) {
      throw new Error("CV no encontrada.");
    }
    await ctx.db.patch(args.resumeId, {
      enrichmentStatus: "error",
      enrichmentError: args.errorMessage,
      updatedAt: Date.now(),
    });
  },
});
