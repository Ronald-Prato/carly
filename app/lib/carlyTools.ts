import { tool } from "@openai/agents";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/** Run context: Convex JWT; conversation id when the chat is tied to a saved thread. */
export type CarlyRunContext = {
  convexToken: string;
  conversationId?: Id<"conversations">;
};

const fetchUserResumeRecordDescription = `**When to use (high priority):** call this by default whenever the user asks anything that could be answered from their CV / résumé data.

**Always call this first** before asking the user to paste their CV again when the request is about: years of experience, career summary, work history, skills, education, achievements, profile/about section, or "what do you know from my CV?".

**Trigger examples:** "cuántos años de experiencia tengo", "resúmeme mi CV", "qué dice mi hoja de vida", "qué skills tengo ahí", "qué puedo mejorar en mi CV", "según mi experiencia laboral...".

Only skip this tool if the user is explicitly talking about information that clearly is not in the stored CV.

**What it does:** loads the **full latest resume row** from the database for the signed-in user (all stored fields, optional HTML/text content, enrichment metadata, PDF download URL when available). This is **not** the conversation draft; use the update-draft tool for chat-linked edits.`;

const fetchUserResumeRecordParameters = z.object({});

export const fetchUserResumeRecordTool = tool({
  name: "fetch_user_resume_record",
  description: fetchUserResumeRecordDescription,
  parameters: fetchUserResumeRecordParameters,
  isEnabled: async ({ runContext }) => {
    const c = runContext.context as CarlyRunContext | undefined;
    return Boolean(c?.convexToken);
  },
  execute: async (_input, runContext) => {
    const ctx = runContext?.context as CarlyRunContext | undefined;
    if (!ctx?.convexToken) {
      return "Could not load resume: missing session.";
    }
    try {
      const record = await fetchQuery(
        api.storage.resume.getLatestFullRecord,
        {},
        { token: ctx.convexToken },
      );
      if (!record) {
        return "No resume record in the database for this user.";
      }
      return JSON.stringify(record, null, 2);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return `Could not fetch resume record: ${msg}`;
    }
  },
});

const updateConversationResumeDraftDescription = `**When to use:** call this when the user wants to **add, remove, or change** something on their **resume / CV** (sections, experience, education, skills, contact info, etc.) and you need to **persist the draft** tied to this conversation.

**What it does:** saves the full updated resume body in \`newContent\` (e.g. HTML or structured text) on the given conversation, replacing any previous draft.

**Writing style constraints:** preserve the user’s original narrative voice and tense throughout the CV. If the resume is written in first person and in a specific tense, keep that same person/tense in all edits. Do not rewrite in third person, impersonal voice, or a different tense.

**What it is not:** do not use this to edit chat history or chat messages—only the CV content attached to the thread.`;

const updateConversationResumeDraftParameters = z.object({
  conversationId: z
    .string()
    .describe("Active Convex conversation id (must match the current thread)."),
  newContent: z
    .string()
    .min(1)
    .max(500_000)
    .describe("Full resume content after applying the user’s requested changes."),
});

export const updateConversationResumeDraftTool = tool({
  name: "update_conversation_resume_draft",
  description: updateConversationResumeDraftDescription,
  parameters: updateConversationResumeDraftParameters,
  isEnabled: async ({ runContext }) => {
    const c = runContext.context as CarlyRunContext | undefined;
    return Boolean(c?.convexToken && c?.conversationId);
  },
  execute: async (input, runContext) => {
    const ctx = runContext?.context as CarlyRunContext | undefined;
    if (!ctx?.convexToken || !ctx.conversationId) {
      return "Could not save resume draft: missing session or active conversation.";
    }
    if (input.conversationId !== ctx.conversationId) {
      return `conversationId must match the active conversation (${ctx.conversationId}).`;
    }
    try {
      await fetchMutation(
        api.agent.conversations.patch,
        {
          conversationId: ctx.conversationId,
          content: input.newContent,
        },
        { token: ctx.convexToken },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return `Could not save content: ${msg}`;
    }
    return "Resume draft updated and stored on this conversation.";
  },
});
