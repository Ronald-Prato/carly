import {
  assistant,
  Agent,
  type AgentInputItem,
  type RunStreamEvent,
  run,
  user,
} from "@openai/agents";
import { StreamEventTextStream } from "@openai/agents-core/types";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { z } from "zod";

import {
  CARLY_INSTRUCTIONS,
  setConversationTitleIfFirstTurn,
} from "@/app/lib/carlyAgent";
import { CARLY_DEFAULT_CHAT_MODEL } from "@/app/lib/chatModel";
import {
  encodeCarlyToolMarker,
  stripCarlyToolMarkers,
  toolCallNameFromRunStreamItem,
} from "@/app/lib/carlyToolStreamMarkers";
import {
  fetchUserResumeRecordTool,
  searchResumeByKeywordsTool,
  updateConversationResumeDraftTool,
  type CarlyRunContext,
} from "@/app/lib/carlyTools";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const maxDuration = 120;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(100_000),
});

const bodySchema = z.object({
  /**
   * With `conversationId` and a session, context can be loaded from `conversations.messages`
   * (same compaction path: immutable log lives in the `messages` table for the UI).
   */
  messages: z.array(messageSchema).max(200).optional().default([]),
  conversationId: z.string().min(1).max(200).optional(),
  /**
   * Clerk JWT using the `convex` template (same as the Convex client).
   * Without it, the server may not resolve getToken("convex") and the title is not saved.
   */
  convexToken: z.string().min(1).optional(),
});

const MODEL = process.env.OPENAI_CHAT_MODEL ?? CARLY_DEFAULT_CHAT_MODEL;

/** chat.completions (e.g. gpt-4o-mini); the main agent model may differ (e.g. gpt-5.4-nano). */
const TITLE_COMPLETION_MODEL =
  process.env.OPENAI_TITLE_MODEL ?? "gpt-4o-mini";

type ClientMessage = z.infer<typeof messageSchema>;

function buildAgentInput(msgs: ClientMessage[]): string | AgentInputItem[] {
  if (msgs.length === 1) {
    const only = msgs[0]!;
    if (only.role === "user") {
      return only.content;
    }
  }
  const items: AgentInputItem[] = [];
  for (const m of msgs) {
    if (m.role === "user") {
      items.push(user(m.content));
    } else {
      items.push(assistant(stripCarlyToolMarkers(m.content)));
    }
  }
  return items;
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Missing OPENAI_API_KEY in the server environment." },
      { status: 500 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let { messages, conversationId, convexToken: convexTokenFromBody } =
    parsed.data;

  /**
   * With `conversationId` and an empty `messages` array, load agent context from
   * `conversations.get` (`messages` field), not from the `messages` table.
   */
  if (conversationId && messages.length === 0) {
    const { getToken } = await auth();
    let token: string | null;
    try {
      token = (await getToken({ template: "convex" })) ?? null;
    } catch (e) {
      console.error("[api/chat] Clerk getToken({ template: \"convex\" }):", e);
      return Response.json(
        {
          error:
            "Missing Clerk JWT template \"convex\". In Clerk → Integrations → Convex (or create the `convex` template), then sign in again.",
        },
        { status: 503 },
      );
    }
    if (!token) {
      return Response.json(
        { error: "Session required to continue a saved chat." },
        { status: 401 },
      );
    }
    const doc = await fetchQuery(
      api.agent.conversations.get,
      { conversationId: conversationId as Id<"conversations"> },
      { token },
    );
    if (!doc) {
      return Response.json(
        { error: "Conversation not found or not accessible." },
        { status: 404 },
      );
    }
    const ctxParsed = z
      .array(messageSchema)
      .safeParse(
        Array.isArray(doc.messages) ? doc.messages : [],
      );
    if (!ctxParsed.success) {
      return Response.json(
        { error: "Stored conversation context is invalid." },
        { status: 422 },
      );
    }
    if (ctxParsed.data.length === 0) {
      return Response.json(
        {
          error:
            "No context in this conversation. Send a message again or check Convex persistence.",
        },
        { status: 404 },
      );
    }
    messages = ctxParsed.data;
  } else if (messages.length === 0) {
    return Response.json(
      { error: "Send `messages` or a `conversationId` with a session." },
      { status: 400 },
    );
  }

  const last = messages[messages.length - 1]!;
  if (last.role !== "user") {
    return Response.json(
      { error: "The last message must be from the user." },
      { status: 400 },
    );
  }

  const firstUserMessageOnly =
    messages.length === 1 && messages[0]!.role === "user";

  let convexTokenForTitle: string | null = convexTokenFromBody ?? null;
  if (firstUserMessageOnly && conversationId && !convexTokenForTitle) {
    const { getToken } = await auth();
    try {
      convexTokenForTitle = (await getToken({ template: "convex" })) ?? null;
    } catch (e) {
      console.error(
        '[api/chat] getToken({ template: "convex" }) (conversation title):',
        e,
      );
    }
  }

  /** Fire-and-forget: title (OpenAI + Convex) in parallel with the agent; stream starts immediately. */
  if (firstUserMessageOnly && conversationId && convexTokenForTitle) {
    const firstText = messages[0]!.content;
    const convId = conversationId as Id<"conversations">;
    const t = convexTokenForTitle;
    const key = process.env.OPENAI_API_KEY!;
    void setConversationTitleIfFirstTurn({
      firstUserText: firstText,
      completionModel: TITLE_COMPLETION_MODEL,
      openaiApiKey: key,
      conversationId: convId,
      convexToken: t,
    }).catch((e) => {
      console.error("[api/chat] background title task:", e);
    });
  }

  let convexTokenForAgent: string | null = convexTokenFromBody ?? null;
  if (!convexTokenForAgent) {
    const { getToken } = await auth();
    try {
      convexTokenForAgent = (await getToken({ template: "convex" })) ?? null;
    } catch (e) {
      console.error('[api/chat] getToken({ template: "convex" }) (tools):', e);
    }
  }

  const agentContext: CarlyRunContext | undefined = convexTokenForAgent
    ? {
        convexToken: convexTokenForAgent,
        ...(conversationId
          ? { conversationId: conversationId as Id<"conversations"> }
          : {}),
      }
    : undefined;

  const agent = new Agent<CarlyRunContext>({
    name: "Carly",
    handoffDescription:
      "Carly assistant: job search and keeping the user’s career narrative up to date",
    instructions: CARLY_INSTRUCTIONS,
    model: MODEL,
    tools: [
      searchResumeByKeywordsTool,
      fetchUserResumeRecordTool,
      updateConversationResumeDraftTool,
    ],
  });

  const input = buildAgentInput(messages);

  try {
    const runResult = await run(agent, input, {
      stream: true,
      ...(agentContext ? { context: agentContext } : {}),
    });
    const enc = new TextEncoder();
    const sourceStream = runResult.toStream() as unknown as ReadableStream<RunStreamEvent>;
    const textIn = sourceStream.pipeThrough(
      new TransformStream<RunStreamEvent, string>({
        transform(event, controller) {
          if (
            event.type === "raw_model_stream_event" &&
            event.data.type === "output_text_delta"
          ) {
            const parsed = StreamEventTextStream.safeParse(event.data);
            if (parsed.success) {
              controller.enqueue(parsed.data.delta);
            }
            return;
          }
          if (event.type === "run_item_stream_event" && event.name === "tool_called") {
            const name = toolCallNameFromRunStreamItem(event.item);
            if (name) {
              controller.enqueue(encodeCarlyToolMarker(name));
            }
          }
        },
      }),
    );
    const out = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = textIn.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            if (value) controller.enqueue(enc.encode(value));
          }
          await runResult.completed;
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
    return new Response(out, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        ...(conversationId
          ? { "X-Carly-Conversation-Id": conversationId }
          : {}),
      },
    });
  } catch (err) {
    console.error("[api/chat]", err);
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate a response.",
      },
      { status: 500 },
    );
  }
}
