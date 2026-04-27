import { fetchMutation } from "convex/nextjs";
import OpenAI from "openai";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const NEW_CONVERSATION_PLACEHOLDER_TITLE = "New conversation";

export const CARLY_INSTRUCTIONS = `Eres **Carly**. Tu ÚNICA misión es ayudar a la persona a **encontrar trabajo** y a **mantener al día su eje de vida** (CV, trayectoria, prioridades y contexto relevante) para que refleje siempre con fidelidad su situación actual.

Regla operativa clave: cuando exista una tool para consultar el CV almacenado, úsala de forma proactiva ante preguntas que puedan depender del CV (por ejemplo experiencia, años trabajados, skills, historial, resumen, mejoras del CV). Antes de pedirle al usuario que vuelva a pegar su CV o fechas, primero consulta la información disponible con esa tool.

Sé clara, práctica y alineada con esa misión. Responde en el mismo idioma que el usuario salvo que pida otra cosa.`;

const TITLE_SYSTEM = `Eres Carly, el mismo asistente. Tu salida ahora no es un chat con el usuario: devuelve ÚNICAMENTE un título breve (máximo 80 caracteres) que capte la intención o el tema del mensaje, sin copiarlo literalmente. El mismo idioma que el primer mensaje. Sin comillas envolventes, sin frases de presentación, sin viñetas: solo el texto del título en una línea.`;

const TITLE_MAX_LEN = 80;

function normalizeGeneratedTitle(raw: string): string {
  const line = raw
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  if (!line) return "";
  const unquoted = line.replace(/^[«"']+|[»"']+$/g, "").trim();
  if (unquoted.length > TITLE_MAX_LEN) {
    return unquoted.slice(0, TITLE_MAX_LEN - 1) + "…";
  }
  return unquoted;
}

const TITLE_FALLBACK_MODEL = "gpt-4o-mini";

async function generateConversationTitle(
  firstUserText: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const openai = new OpenAI({ apiKey });
  const oneShot = (m: string) =>
    openai.chat.completions.create({
      model: m,
      max_tokens: 100,
      temperature: 0.35,
      messages: [
        { role: "system", content: TITLE_SYSTEM },
        { role: "user", content: firstUserText },
      ],
    });
  let res: Awaited<ReturnType<typeof oneShot>>;
  try {
    res = await oneShot(model);
  } catch (e) {
    if (model === TITLE_FALLBACK_MODEL) {
      throw e;
    }
    console.warn(
      "[carlyAgent] title: retrying with",
      TITLE_FALLBACK_MODEL,
      e,
    );
    res = await oneShot(TITLE_FALLBACK_MODEL);
  }
  const raw = res.choices[0]?.message?.content?.trim() ?? "";
  return normalizeGeneratedTitle(raw);
}

/**
 * First turn of a persisted chat: generate title via chat.completions and save to Convex.
 * Errors are logged and do not affect the chat response.
 */
export async function setConversationTitleIfFirstTurn(options: {
  firstUserText: string;
  /** Cheap/fast chat.completions model; the main agent may use a different one. */
  completionModel: string;
  openaiApiKey: string;
  conversationId: Id<"conversations">;
  convexToken: string;
}): Promise<void> {
  const { firstUserText, completionModel, openaiApiKey, conversationId, convexToken } =
    options;
  if (!firstUserText.trim()) return;
  let title: string;
  try {
    title = await generateConversationTitle(
      firstUserText,
      completionModel,
      openaiApiKey,
    );
  } catch (e) {
    console.error("[carlyAgent] title: generation failed", e);
    return;
  }
  if (!title) return;
  try {
    await fetchMutation(
      api.agent.conversations.patch,
      { conversationId, title },
      { token: convexToken },
    );
  } catch (e) {
    console.error("[carlyAgent] title: patch failed", e);
  }
}
