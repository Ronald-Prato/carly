import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { htmlToPlainText, searchResumePlainText } from "./resumeSearchHelpers";
import { getUserIdForQuery, requireUserId } from "../database/users";

type StorageMeta = {
  _id: Id<"_storage">;
  contentType?: string;
  size: number;
};

export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, "").trim();
  return base.length > 0 ? base : "Hoja de vida";
}

function assertPdf(metadata: StorageMeta): void {
  const contentType = (metadata.contentType ?? "").toLowerCase();
  const okType =
    contentType === "application/pdf" || contentType === "application/x-pdf";
  if (!okType || !metadata.size) {
    throw new Error("El archivo no es un PDF válido o está vacío.");
  }
}

/**
 * Última hoja de vida subida: es la que usa el chat (Carly lee el PDF más reciente).
 */
/**
 * Latest `resumes` row for the current user with every persisted field plus a PDF URL.
 * For agent tools that need the full DB record (not the conversation draft).
 */
const MAX_SEARCH_TERMS = 12;

/**
 * Latest resume for the user: keyword windows over extracted plain text (grep-style, no vectors).
 */
export const searchLatestResumeContent = query({
  args: {
    terms: v.array(v.string()),
    matchMode: v.union(v.literal("any"), v.literal("all")),
    contextChars: v.optional(v.number()),
    maxSnippets: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return { ok: false as const, reason: "no_resume" as const };
    }
    const rows = await ctx.db
      .query("resumes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    if (rows.length === 0) {
      return { ok: false as const, reason: "no_resume" as const };
    }
    const row = rows.reduce((a, b) => (a.uploadedAt >= b.uploadedAt ? a : b));
    const downloadUrl = (await ctx.storage.getUrl(row.storageId)) ?? null;
    const resumeTitle = row.title ?? titleFromFileName(row.fileName);
    const enrichmentStatus = row.enrichmentStatus ?? null;

    const content = row.content?.trim() ?? "";
    if (!content) {
      return {
        ok: false as const,
        reason: "content_not_ready" as const,
        resumeTitle,
        enrichmentStatus,
        downloadUrl,
      };
    }

    const terms = args.terms.slice(0, MAX_SEARCH_TERMS);
    const plain = htmlToPlainText(content);
    const contextChars =
      args.contextChars === undefined
        ? undefined
        : Math.min(400, Math.max(50, Math.floor(args.contextChars)));
    const maxSnippets =
      args.maxSnippets === undefined
        ? undefined
        : Math.min(30, Math.max(1, Math.floor(args.maxSnippets)));
    const inner = searchResumePlainText(plain, terms, {
      matchMode: args.matchMode,
      contextChars,
      maxSnippets,
    });

    if (!inner.ok) {
      return { ok: false as const, reason: "empty_terms" as const };
    }

    return {
      ok: true as const,
      resumeTitle,
      enrichmentStatus,
      downloadUrl,
      plainTextLength: plain.length,
      snippets: inner.snippets,
      matchedTerms: inner.matchedTerms,
      missingTerms: inner.missingTerms,
      truncated: inner.truncated,
      matchMode: inner.matchMode,
    };
  },
});

export const getLatestFullRecord = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return null;
    }
    const rows = await ctx.db
      .query("resumes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    if (rows.length === 0) {
      return null;
    }
    const row = rows.reduce((a, b) => (a.uploadedAt >= b.uploadedAt ? a : b));
    const downloadUrl = await ctx.storage.getUrl(row.storageId);
    return {
      _id: row._id,
      userId: row.userId,
      storageId: row.storageId,
      fileName: row.fileName,
      title: row.title ?? titleFromFileName(row.fileName),
      content: row.content,
      uploadedAt: row.uploadedAt,
      updatedAt: row.updatedAt ?? null,
      enrichmentStatus: row.enrichmentStatus ?? null,
      enrichmentError: row.enrichmentError ?? null,
      downloadUrl: downloadUrl ?? null,
    };
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return null;
    }
    const rows = await ctx.db
      .query("resumes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    if (rows.length === 0) {
      return null;
    }
    const row = rows.reduce((a, b) => (a.uploadedAt >= b.uploadedAt ? a : b));
    const downloadUrl = await ctx.storage.getUrl(row.storageId);
    return {
      _id: row._id,
      fileName: row.fileName,
      title: row.title ?? titleFromFileName(row.fileName),
      content: row.content,
      uploadedAt: row.uploadedAt,
      updatedAt: row.updatedAt ?? row.uploadedAt,
      enrichmentStatus: row.enrichmentStatus,
      downloadUrl,
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return [];
    }
    const rows = await ctx.db
      .query("resumes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    rows.sort((a, b) => b.uploadedAt - a.uploadedAt);
    /** Política de producto: como mucho una fila por usuario; la más reciente gana. */
    const rowsAtMostOne = rows.slice(0, 1);
    const withUrls = await Promise.all(
      rowsAtMostOne.map(async (row) => {
        const downloadUrl = await ctx.storage.getUrl(row.storageId);
        return {
          _id: row._id,
          fileName: row.fileName,
          title: row.title ?? titleFromFileName(row.fileName),
          content: row.content,
          uploadedAt: row.uploadedAt,
          updatedAt: row.updatedAt ?? row.uploadedAt,
          enrichmentStatus: row.enrichmentStatus,
          enrichmentError: row.enrichmentError,
          downloadUrl,
        };
      }),
    );
    return withUrls;
  },
});

export const getById = query({
  args: { resumeId: v.id("resumes") },
  handler: async (ctx, args) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return null;
    }
    const row = await ctx.db.get("resumes", args.resumeId);
    if (!row || row.userId !== userId) {
      return null;
    }
    const downloadUrl = await ctx.storage.getUrl(row.storageId);
    return {
      _id: row._id,
      fileName: row.fileName,
      title: row.title ?? titleFromFileName(row.fileName),
      content: row.content,
      uploadedAt: row.uploadedAt,
      updatedAt: row.updatedAt ?? row.uploadedAt,
      enrichmentStatus: row.enrichmentStatus,
      enrichmentError: row.enrichmentError,
      downloadUrl,
    };
  },
});

/**
 * Fila + URL de descarga para la acción de enriquecimiento (misma comprobación de
 * propiedad que `getById`). Solo expone datos al dueño.
 */
export const getByIdForEnrichment = query({
  args: { resumeId: v.id("resumes") },
  handler: async (ctx, args) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return null;
    }
    const row = await ctx.db.get("resumes", args.resumeId);
    if (!row || row.userId !== userId) {
      return null;
    }
    const downloadUrl = await ctx.storage.getUrl(row.storageId);
    if (!downloadUrl) {
      return null;
    }
    return {
      _id: row._id,
      fileName: row.fileName,
      title: row.title ?? titleFromFileName(row.fileName),
      storageId: row.storageId,
      downloadUrl,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveAfterUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trimmed = args.fileName.trim();
    if (!trimmed.toLowerCase().endsWith(".pdf")) {
      await ctx.storage.delete(args.storageId);
      throw new Error("El nombre del archivo debe terminar en .pdf");
    }
    const meta: StorageMeta | null = await ctx.db.system.get(
      "_storage",
      args.storageId,
    );
    if (!meta) {
      throw new Error("No se encontró el archivo subido.");
    }
    try {
      assertPdf(meta);
    } catch (err) {
      await ctx.storage.delete(args.storageId);
      throw err;
    }

    const userId = await requireUserId(ctx);
    const now = Date.now();
    const title =
      args.title?.trim() && args.title.trim().length > 0
        ? args.title.trim()
        : titleFromFileName(trimmed);

    /** Una sola hoja por usuario: al subir otra, se sustituye la anterior. */
    const existing = await ctx.db
      .query("resumes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const row of existing) {
      await ctx.storage.delete(row.storageId);
      await ctx.db.delete(row._id);
    }

    return await ctx.db.insert("resumes", {
      userId,
      storageId: args.storageId,
      fileName: trimmed,
      title,
      uploadedAt: now,
      updatedAt: now,
      enrichmentStatus: "pending",
    });
  },
});

export const remove = mutation({
  args: { resumeId: v.id("resumes") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get("resumes", args.resumeId);
    if (!row || row.userId !== userId) {
      throw new Error("No se encontró la hoja de vida.");
    }
    await ctx.storage.delete(row.storageId);
    await ctx.db.delete(row._id);
  },
});
