"use client";

import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import {
  getCarlyToolLogLabel,
  segmentsFromAssistantContent,
} from "@/app/lib/carlyToolStreamMarkers";

import {
  agentMessageAssistant,
  agentMessageAssistantStreaming,
} from "./agentChatStyles";
import type { ChatMessage } from "./types";

function parseInline(raw: string): ReactNode[] {
  const parts = raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function renderMarkdown(
  text: string,
  options?: { userMessage?: boolean },
): ReactNode {
  const userMessage = options?.userMessage === true;
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (trimmed === "") return <div key={i} className="h-1.5" />;
    const isBullet = /^[-*]\s/.test(trimmed);
    const content = parseInline(isBullet ? trimmed.slice(2) : trimmed);
    if (isBullet) {
      return (
        <div
          key={i}
          className={userMessage ? "flex justify-end gap-1.5" : "flex gap-1.5"}
        >
          <span className="shrink-0">•</span>
          <span>{content}</span>
        </div>
      );
    }
    return <div key={i}>{content}</div>;
  });
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex w-full max-w-full min-w-0 justify-end">
        <div
          className={[
            "max-w-[min(88%,100%)] rounded-[10px] border border-[var(--carly-agent-user-border)]/45",
            "bg-[color-mix(in_srgb,var(--carly-agent-user-bg)_52%,transparent)]",
            "px-2.5 py-1.5 text-right shadow-[0_1px_0_rgb(15_23_42/0.04)]",
            "dark:border-[var(--carly-agent-user-border)]/35 dark:bg-[color-mix(in_srgb,var(--carly-agent-user-bg)_40%,transparent)] dark:shadow-[0_1px_0_rgb(0_0_0/0.2)]",
            "min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]",
            "text-[15px] leading-[1.62] text-[var(--carly-agent-text)]",
            "[&>div]:text-right",
          ].join(" ")}
        >
          {renderMarkdown(message.content, { userMessage: true })}
        </div>
      </div>
    );
  }

  const segments = segmentsFromAssistantContent(message.content);
  const assistantBodyClass = [
    agentMessageAssistant,
    message.streamAnimate ? agentMessageAssistantStreaming : null,
    message.streamAnimate ? "min-h-[1.5rem] whitespace-pre-wrap" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex w-full max-w-full flex-col gap-2 self-start">
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <div key={i} className={assistantBodyClass}>
            {renderMarkdown(seg.text)}
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
