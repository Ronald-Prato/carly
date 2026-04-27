import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    pictureUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_clerkUserId", ["clerkUserId"]),
  tasks: defineTable({
    text: v.string(),
  }),
  /**
   * Hoja de vida (CV): metadatos + HTML generado. `storageId` es el `documentId` en
   * Convex File Storage; el binario vive allí, `content` es la transcripción/estructura.
   */
  resumes: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    /** Título mostrado; si falta, la UI deriva del nombre del archivo. */
    title: v.optional(v.string()),
    /** HTML (p. ej. estilo Europass) generado a partir del PDF. */
    content: v.optional(v.string()),
    uploadedAt: v.number(),
    updatedAt: v.optional(v.number()),
    enrichmentStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("ready"),
        v.literal("error"),
      ),
    ),
    enrichmentError: v.optional(v.string()),
  }).index("by_userId", ["userId"]),
  /**
   * Perfil laboral y objetivos de búsqueda del usuario (1:1 con `users`).
   */
  profiles: defineTable({
    userId: v.id("users"),
    profession: v.optional(v.string()),
    yearsOfExperience: v.optional(v.number()),
    expectedSalary: v.optional(v.number()),
    location: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  conversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
    /**
     * Resume draft (e.g. HTML) for this chat; updated by the agent via the dedicated tool.
     */
    content: v.optional(v.string()),
    /**
     * Ventana de contexto para el agente: `{ role: "user"|"assistant", content }[]`.
     * Puede compactarse sin afectar el log inmutable en la tabla `messages` (UI).
     */
    messages: v.array(v.any()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("archived")),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),
  /**
   * Mensajes de chat: uno por turno (usuario o modelo / “system” en el producto).
   * `inTokens` / `outTokens` reflejan uso del modelo; en mensajes de usuario suelen ser 0.
   */
  messages: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    type: v.union(v.literal("user"), v.literal("system")),
    content: v.string(),
    model: v.optional(v.string()),
    inTokens: v.number(),
    outTokens: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_conversationId", ["conversationId"])
    .index("by_conversationId_createdAt", ["conversationId", "createdAt"]),
});
