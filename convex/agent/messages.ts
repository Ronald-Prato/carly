import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getUserIdForQuery, requireUserId } from "../database/users";

async function requireOwnedConversation(
  ctx: Pick<MutationCtx, "db">,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
) {
  const doc = await ctx.db.get(conversationId);
  if (!doc || doc.userId !== userId) {
    throw new Error("Conversación no encontrada.");
  }
  if (doc.status === "archived") {
    throw new Error("La conversación está archivada.");
  }
}

type ContextItem = { role: "user" | "assistant"; content: string };

/**
 * Los marcadores CARLY_TOOL en el contenido del asistente se muestran en la UI pero no
 * deben formar parte del contexto que recibe el modelo (`conversations.messages`).
 */
const STX = "\u0002";
const CARLY_TOOL_MARKER_RE = new RegExp(
  `${STX}CARLY_TOOL${STX}([^${STX}]*)${STX}`,
  "g",
);

function stripCarlyToolMarkers(content: string): string {
  return content.replace(CARLY_TOOL_MARKER_RE, "");
}

function normalizeContextFromDoc(raw: unknown): ContextItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: ContextItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") {
      continue;
    }
    const o = it as { role?: unknown; content?: unknown };
    if (
      (o.role === "user" || o.role === "assistant") &&
      typeof o.content === "string"
    ) {
      out.push({ role: o.role, content: o.content });
    }
  }
  return out;
}

/**
 * Vuelca el log de la tabla `messages` a `conversations.messages` solo cuando el
 * contexto del documento está vacío y ya hay filas (reparación / migración).
 * En uso normal se hace push incremental para no machacar un contexto compactado.
 */
async function backfillContextFromLogIfEmpty(
  ctx: Pick<MutationCtx, "db">,
  conversationId: Id<"conversations">,
) {
  const doc = await ctx.db.get(conversationId);
  if (!doc) {
    return;
  }
  if (normalizeContextFromDoc(doc.messages).length > 0) {
    return;
  }
  const rows = await ctx.db
    .query("messages")
    .withIndex("by_conversationId_createdAt", (q) =>
      q.eq("conversationId", conversationId),
    )
    .order("asc")
    .collect();
  if (rows.length === 0) {
    return;
  }
  const items: ContextItem[] = rows.map((m) => ({
    role: m.type === "user" ? "user" : "assistant",
    content: m.content,
  }));
  const now = Date.now();
  await ctx.db.patch(conversationId, { messages: items, updatedAt: now });
}

/** Contexto de agente: un turno más en `conversations.messages` (no copia toda la tabla, para permitir compactación). */
async function appendConversationContext(
  ctx: Pick<MutationCtx, "db">,
  conversationId: Id<"conversations">,
  item: ContextItem,
) {
  const doc = await ctx.db.get(conversationId);
  if (!doc) {
    throw new Error("Conversación no encontrada.");
  }
  const prev = normalizeContextFromDoc(doc.messages);
  const next: ContextItem[] = [...prev, item];
  const now = Date.now();
  await ctx.db.patch(conversationId, { messages: next, updatedAt: now });
}

export const listByConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getUserIdForQuery(ctx);
    if (!userId) {
      return [];
    }
    const doc = await ctx.db.get(args.conversationId);
    if (!doc || doc.userId !== userId) {
      return [];
    }
    if (doc.status === "archived") {
      return [];
    }
    return await ctx.db
      .query("messages")
      .withIndex("by_conversationId_createdAt", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .collect();
  },
});

export const addUserMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    inTokens: v.number(),
    outTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedConversation(ctx, args.conversationId, userId);
    await backfillContextFromLogIfEmpty(ctx, args.conversationId);
    const now = Date.now();
    const id = await ctx.db.insert("messages", {
      userId,
      conversationId: args.conversationId,
      type: "user",
      content: args.content,
      inTokens: args.inTokens,
      outTokens: args.outTokens,
      createdAt: now,
      updatedAt: now,
    });
    await appendConversationContext(ctx, args.conversationId, {
      role: "user",
      content: args.content,
    });
    return id;
  },
});

export const addSystemMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    model: v.string(),
    inTokens: v.number(),
    outTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedConversation(ctx, args.conversationId, userId);
    const raw = args.content;
    const cleaned = stripCarlyToolMarkers(raw);
    if (cleaned.trim().length === 0) {
      return null;
    }
    await backfillContextFromLogIfEmpty(ctx, args.conversationId);
    const now = Date.now();
    const id = await ctx.db.insert("messages", {
      userId,
      conversationId: args.conversationId,
      type: "system",
      content: cleaned,
      model: args.model,
      inTokens: args.inTokens,
      outTokens: args.outTokens,
      createdAt: now,
      updatedAt: now,
    });
    if (cleaned.length > 0) {
      await appendConversationContext(ctx, args.conversationId, {
        role: "assistant",
        content: cleaned,
      });
    }
    return id;
  },
});
