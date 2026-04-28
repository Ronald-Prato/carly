import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { getUserIdForQuery, requireUserId } from "./users";

/** Persiste que el aviso «primer CV» ya fue reconocido (solo vía botón Entendido). */
async function setHasUploadedFirstCvTrue(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (existing?.hasUploadedFirstCV === true) {
    return;
  }
  if (existing) {
    await ctx.db.patch(existing._id, {
      hasUploadedFirstCV: true,
      updatedAt: now,
    });
    return;
  }
  await ctx.db.insert("profiles", {
    userId,
    hasUploadedFirstCV: true,
    hasDoneWT: false,
    createdAt: now,
    updatedAt: now,
  });
}

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
      hasDoneWT: false,
      hasUploadedFirstCV: false,
      ...fields,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Marca el walkthrough del sidebar como completado (persistente por usuario). */
export const markWalkthroughDone = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        hasDoneWT: true,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      userId,
      hasDoneWT: true,
      hasUploadedFirstCV: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Programado cuando el enriquecimiento del CV pasa a `ready` (no en la subida del archivo). */
export const markHasUploadedFirstCv = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await setHasUploadedFirstCvTrue(ctx, args.userId);
  },
});

/** El usuario pulsa «Entendido» en el aviso de búsqueda (única forma de marcar el flag). */
export const dismissFirstCvUploadedToast = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await setHasUploadedFirstCvTrue(ctx, userId);
  },
});

/**
 * Migración one-shot: marca `hasUploadedFirstCV` para usuarios que ya tenían CV.
 *
 * `npx convex run database/profiles:backfillHasUploadedFirstCvForResumeOwners`
 */
export const backfillHasUploadedFirstCvForResumeOwners = internalMutation({
  args: {},
  handler: async (ctx) => {
    const resumes = await ctx.db.query("resumes").collect();
    const userIds = [...new Set(resumes.map((r) => r.userId))];
    let patched = 0;
    for (const userId of userIds) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      if (profile?.hasUploadedFirstCV === true) {
        continue;
      }
      await setHasUploadedFirstCvTrue(ctx, userId);
      patched++;
    }
    return { resumeOwners: userIds.length, profilesUpdated: patched };
  },
});

/**
 * Migración one-shot: documentos de `profiles` anteriores al campo `hasDoneWT`
 * quedan sin el campo; aquí se escribe `false` explícitamente.
 *
 * Ejecutar una vez por entorno (tras desplegar el schema):
 * `npx convex run database/profiles:backfillHasDoneWTForProfiles`
 * En producción: `npx convex run database/profiles:backfillHasDoneWTForProfiles --prod`
 */
export const backfillHasDoneWTForProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("profiles").collect();
    const now = Date.now();
    let patched = 0;
    for (const row of rows) {
      if (row.hasDoneWT === undefined) {
        await ctx.db.patch(row._id, {
          hasDoneWT: false,
          updatedAt: now,
        });
        patched++;
      }
    }
    return { scanned: rows.length, patched };
  },
});
