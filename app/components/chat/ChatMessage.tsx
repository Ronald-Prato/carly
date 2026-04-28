"use client";

import { Sparkles } from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  getCarlyToolLogLabel,
  segmentsFromAssistantContent,
} from "@/app/lib/carlyToolStreamMarkers";

import {
  agentMessageAssistant,
  agentMessageAssistantStreaming,
  agentMessageUser,
} from "./agentChatStyles";
import type { ChatMessage } from "./types";

function CarlyChatMarkdownBody({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
}

/** Contenido de mensaje usuario: markdown (estilos en `agentMessageUser`). */
function UserMessageMarkdown({ text }: { text: string }) {
  return (
    <div className={agentMessageUser}>
      <CarlyChatMarkdownBody text={text} />
    </div>
  );
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="my-5 flex w-full max-w-full min-w-0 justify-end">
        <div
          className="relative w-fit max-w-[20rem] overflow-hidden rounded-full shadow-[0_1px_0_rgb(15_23_42/0.04)] dark:shadow-[0_1px_0_rgb(0_0_0/0.2)]"
          style={{ backgroundImage: "var(--carly-gradient)" }}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--carly-page-bg)_92%,transparent)] dark:bg-[color-mix(in_srgb,var(--carly-page-bg)_88%,transparent)]"
            aria-hidden
          />
          <div className="relative z-10 pl-5 pr-3 py-2.5 text-left leading-relaxed text-[var(--carly-agent-text)]">
            <UserMessageMarkdown text={message.content} />
          </div>
        </div>
      </div>
    );
  }

  const segments = segmentsFromAssistantContent(message.content);
  const assistantBodyClass = [
    agentMessageAssistant,
    message.streamAnimate ? agentMessageAssistantStreaming : null,
    message.streamAnimate ? "min-h-[1.5rem]" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex w-full max-w-full flex-col gap-2 self-start">
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <div key={i} className={assistantBodyClass}>
            <CarlyChatMarkdownBody text={seg.text} />
          </div>
        ) : (
          <div
            key={i}
            className="flex max-w-full items-center gap-2 self-start text-[13px] leading-snug text-[var(--carly-agent-text-muted)]"
            role="status"
            aria-label={`Tarea del agente: ${getCarlyToolLogLabel(seg.name)}`}
          >
            <Sparkles
              className="h-3.5 w-3.5 shrink-0 opacity-80"
              strokeWidth={2}
              aria-hidden
            />
            <span>{getCarlyToolLogLabel(seg.name)}</span>
          </div>
        ),
      )}
    </div>
  );
}
