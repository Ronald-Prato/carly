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
   * Hoja de vida (CV).
   *
   * `data` (objetivo a futuro) es la fuente de verdad estructurada: un objeto
   * con `basics` + `sections[]` (cada sección con un `shape` cerrado y un
   * `payload` tipado). El render a HTML se hace bajo demanda con plantillas
   * puras (`lib/cvTemplates`), por lo que editar `data` actualiza todas las
   * plantillas y todas las variantes (por oferta) automáticamente.
   *
   * `content` se conserva como caché derivada / compatibilidad con CVs antiguos
   * cuyo enriquecimiento solo produjo HTML. Cuando `data` esté poblado, `content`
   * pasa a ser un artefacto opcional.
   */
  resumes: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    /** Título mostrado; si falta, la UI deriva del nombre del archivo. */
    title: v.optional(v.string()),
    /** HTML cacheado/legado generado a partir del PDF. */
    content: v.optional(v.string()),
    /**
     * Datos estructurados del CV. `v.any()` aquí porque la forma cerrada está
     * en `lib/cvTemplates/types.ts` (CvData) y se valida en código antes de
     * escribir. La razón: la unión discriminada por `shape` no se expresa de
     * forma limpia con validators de Convex sin verbosidad excesiva.
     */
    data: v.optional(v.any()),
    /** ID de plantilla del catálogo (`classic-sidebar`, etc.). */
    templateId: v.optional(v.string()),
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
    /** Tour inicial (sidebar «Mi CV»). `undefined` en documentos previos = pendiente. */
    hasDoneWT: v.optional(v.boolean()),
    /** Toast «primer CV» ya mostrado/cerrado; en `true` no volver a mostrar. */
    hasUploadedFirstCV: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  conversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
    /**
     * Borrador del resumen del CV asociado al chat, en **Markdown** (estilo
     * página de Notion). Lo actualiza el agente vía `update_conversation_resume_draft`.
     * Debe mantenerse coherente con `data` (misma información).
     */
    content: v.optional(v.string()),
    /**
     * Borrador estructurado del CV (CvData) asociado al chat. Es la fuente de
     * verdad para renderizar plantillas/PDFs. `v.any()` aquí porque la forma
     * cerrada (unión discriminada por `shape`) vive en `lib/cvTemplates/types.ts`
     * y se valida en código antes de escribir.
     */
    data: v.optional(v.any()),
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
  /**
   * Ofertas guardadas por el usuario (snapshot JSON compatible con `EnrichedJobCard`).
   */
  savedJobOffers: defineTable({
    userId: v.id("users"),
    /** Id numérico del anuncio en LinkedIn (`job.id`). */
    linkedInPostingId: v.string(),
    card: v.any(),
    savedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_linkedInPostingId", ["userId", "linkedInPostingId"]),
  /**
   * Cookies de sesión LinkedIn (Voyager). Una fila con `current: true` es la
   * activa; el resto es histórico.
   */
  sessions: defineTable({
    liAt: v.string(),
    jsessionId: v.string(),
    current: v.boolean(),
    /** 0–3 para la semilla fija; omitido en sesiones creadas manualmente como `current`. */
    index: v.optional(v.number()),
  }).index("by_current", ["current"]),
});
