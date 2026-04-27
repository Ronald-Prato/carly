import { tool } from "@openai/agents";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { parseCvData } from "@/lib/cvTemplates/schema";

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

**What it does:** saves a coherent CV draft on the conversation. The draft has TWO halves that MUST stay in sync after every edit:

1. \`newContent\` — the **full Markdown summary** of the CV (Notion-style page).
2. \`newData\` — the **full structured CV** (\`CvData\` JSON) used to render templates/PDFs.

Both must reflect the **same** post-edit state of the CV. Never update only one of them. If the user changes a job title, both the Markdown and the matching \`sections[].payload.items[].headline\` must change. If the user adds a skill, both the Markdown skills list and the corresponding \`tag_list\` section must include it.

**Markdown rules for \`newContent\`:**
- Pure Markdown only (CommonMark + GFM). NO HTML tags, NO code fences wrapping the whole doc, NO CSS, NO front-matter.
- Same language as the original CV (do not translate).
- Suggested layout: \`#\` for the person's name, \`##\` for sections, \`###\` for entries (jobs, degrees), \`*italics*\` for dates/locations, \`-\` for bullet lists.

**Structured half (\`newData\` parameter):** pass a **JSON string** (the tool field is a string) whose \`JSON.parse\` result is one \`CvData\` object — same shape as stored in the database. Do not wrap that string in markdown code fences. Example (conceptually): \`"{\\"basics\\":{...},\\"sections\\":[...]}"\`.

**Shape of the parsed JSON (\`CvData\`):**
\`\`\`
{
  "basics": {
    "name": string,
    "headline"?: string,
    "email"?: string,
    "phone"?: string,
    "location"?: string,
    "photoUrl"?: string,
    "links"?: [{ "label": string, "url"?: string }]
  },
  "sections": [
    {
      "id": string,
      "shape": "paragraph" | "tag_list" | "entry_list" | "key_value" | "media_grid",
      "title": string,
      "semanticHint"?: string,
      "payload": <depends on shape>
    }
  ]
}
\`\`\`
Payload by shape:
- \`paragraph\` → \`{ "text": string }\`
- \`tag_list\` → \`{ "items": string[] }\`
- \`entry_list\` → \`{ "items": [{ "headline": string, "subheadline"?: string, "dateRange"?: string, "location"?: string, "bullets"?: string[], "description"?: string }] }\`
- \`key_value\` → \`{ "items": [{ "key": string, "value": string }] }\`
- \`media_grid\` → \`{ "items": [{ "title": string, "description"?: string, "imageUrl"?: string }] }\`

**Writing style constraints:** preserve the user's original narrative voice and tense throughout the CV in BOTH halves. If the CV is in first person and in a specific tense, keep that person/tense everywhere. Do not rewrite in third person, impersonal voice, or a different tense. Do not invent data.

**What it is not:** do not use this to edit chat history or chat messages—only the CV draft attached to the thread.`;

/**
 * OpenAI tool JSON Schema rejects `oneOf` / discriminated unions on nested
 * objects. We expose `newData` as a plain string (serialized JSON) and
 * validate server-side with `parseCvData`.
 */
const updateConversationResumeDraftParameters = z.object({
  conversationId: z
    .string()
    .describe("Active Convex conversation id (must match the current thread)."),
  newContent: z
    .string()
    .min(1)
    .max(500_000)
    .describe(
      "Full Markdown summary of the CV after applying the user's changes (Notion-style, no HTML/CSS).",
    ),
  newData: z
    .string()
    .min(2)
    .max(500_000)
    .describe(
      "Single JSON string (parse with JSON.parse) of the full CvData object after edits. Must stay in sync with newContent. Compact one-line JSON is fine; no markdown fences inside this string.",
    ),
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
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(input.newData) as unknown;
    } catch {
      return "Could not save resume draft: newData is not valid JSON.";
    }
    try {
      const data = parseCvData(parsedJson);
      await fetchMutation(
        api.agent.conversations.patch,
        {
          conversationId: ctx.conversationId,
          content: input.newContent,
          data,
        },
        { token: ctx.convexToken },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return `Could not save resume draft: structured data failed validation (${msg}).`;
    }
    return "Resume draft updated (Markdown summary + structured data) on this conversation.";
  },
});
