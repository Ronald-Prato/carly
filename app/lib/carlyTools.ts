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

const searchResumeByKeywordsDescription = `**When to use (default for CV questions):** call this first whenever the user asks something that could be answered from their stored CV / résumé, unless you already know you need the **entire** HTML body.

**How to use:** pass \`terms\`: 3–10 short keywords or short phrases taken from the user message (companies, roles, skills, degrees, cities, technologies). Example: user asks about React experience → \`terms: ["react", "frontend", "desarrollador"]\`. Prefer distinct tokens over one long sentence.

**What it does:** searches the latest stored resume as **plain text** (substring match, case-insensitive) and returns **small excerpts** around hits—like \`grep -C\`. No full CV content in the response.

**If snippets are empty:** widen or change \`terms\`, or try \`fetch_user_resume_record\` only if you need the full document.`;

/** Single property \`terms\` so the tool JSON schema stays valid for providers that require every key in \`required\`. */
const searchResumeByKeywordsParameters = z.object({
  terms: z
    .array(z.string().min(2).max(200))
    .min(1)
    .max(12)
    .describe(
      "Keywords or short phrases to find in the resume (2–200 chars each, max 12).",
    ),
});

export const searchResumeByKeywordsTool = tool({
  name: "search_resume_by_keywords",
  description: searchResumeByKeywordsDescription,
  parameters: searchResumeByKeywordsParameters,
  isEnabled: async ({ runContext }) => {
    const c = runContext.context as CarlyRunContext | undefined;
    return Boolean(c?.convexToken);
  },
  execute: async (input, runContext) => {
    const ctx = runContext?.context as CarlyRunContext | undefined;
    if (!ctx?.convexToken) {
      return "Could not search resume: missing session.";
    }
    try {
      const result = await fetchQuery(
        api.storage.resume.searchLatestResumeContent,
        {
          terms: input.terms,
          matchMode: "any",
        },
        { token: ctx.convexToken },
      );
      return JSON.stringify(result, null, 2);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return `Could not search resume: ${msg}`;
    }
  },
});

const fetchUserResumeRecordDescription = `**When to use:** only when you need the **complete** latest resume row (full HTML \`content\`, every DB field, PDF URL)—for example a **full rewrite** of the CV, or after \`search_resume_by_keywords\` returned too little and you must read the whole body.

**Do not use as the first step** for typical questions (experience, skills, jobs, education): use \`search_resume_by_keywords\` with extracted \`terms\` instead so context stays small.

**What it does:** loads the **full latest resume** for the signed-in user. Not the conversation draft; use the update-draft tool for chat-linked edits.`;

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
