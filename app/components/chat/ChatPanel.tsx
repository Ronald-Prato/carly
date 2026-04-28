"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";

import { agentScrollSurface } from "./agentChatStyles";
import { ChatInput } from "./ChatInput";
import { ChatMessageBubble } from "./ChatMessage";
import type { ChatMessage } from "./types";
import type { Id } from "@/convex/_generated/dataModel";
import { useCarlyChat } from "./useCarlyChat";
import { cn } from "@/app/lib/cn";
import { ChatResumeLoadingSkeleton } from "@/app/components/loading-skeletons";

type ChatPanelProps = {
  messages: ChatMessage[];
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void;
  isSignedIn: boolean;
  /** `null` en borrador hasta el primer envío. */
  conversationId: Id<"conversations"> | null;
  onConversationCreated: (id: Id<"conversations">, title: string) => void;
  /** Historial alimentado por la query de la tabla `messages` (no solo estado local). */
  persistFromConvex: boolean;
  /**
   * Con CV cargada y conversación vacía, el compositor se centra como en
   * coding-agent-hardness (`Composer` + `centered`).
   */
  centerComposerWhenEmpty?: boolean;
  /** Sesión iniciada y query de CV aún sin resolver. */
  resumeLoading?: boolean;
  /**
   * Con CV y chat vacío, título + compositor en un solo bloque (`flex flex-col gap-4
   * items-center`) sin barra separadora.
   */
  emptyStateTitle?: string;
};

function useStickToBottom(
  endRef: RefObject<HTMLDivElement | null>,
  deps: { messageCount: number; streamingText: string | undefined; isStreaming: boolean },
) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = endRef.current;
    if (!el) return;

    const scrollEnd = (behavior: ScrollBehavior) => {
      el.scrollIntoView({ behavior, block: "end" });
    };

    if (deps.isStreaming) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        scrollEnd("auto");
      });
    } else {
      scrollEnd(deps.messageCount <= 1 ? "smooth" : "auto");
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    endRef,
    deps.messageCount,
    deps.streamingText,
    deps.isStreaming,
  ]);
}

function ThinkingDots() {
  return (
    <div
      className="my-0.5 flex h-8 max-w-full items-center gap-1 self-start rounded-[10px] px-3"
      role="status"
      aria-label="Pensando"
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--carly-agent-text-muted)]"
          style={{
            animationDelay: `${index * 120}ms`,
            animationDuration: "900ms",
          }}
        />
      ))}
    </div>
  );
}

export function ChatPanel({
  messages,
  setMessages,
  isSignedIn,
  conversationId,
  onConversationCreated,
  persistFromConvex,
  centerComposerWhenEmpty = false,
  resumeLoading = false,
  emptyStateTitle,
}: ChatPanelProps) {
  const { streamReply, isSending, sendMessage, errorBanner } = useCarlyChat(
    messages,
    setMessages,
    {
      isSignedIn,
      persistFromConvex,
      conversationId,
      onConversationCreated,
    },
  );
  const endRef = useRef<HTMLDivElement>(null);

  const isStreaming = streamReply !== null;

  const displayMessages = useMemo(() => {
    if (streamReply !== null && streamReply.text.length > 0) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.content === streamReply.text) {
        return messages;
      }
      return [
        ...messages,
        {
          id: "assistant-streaming",
          role: "assistant" as const,
          content: streamReply.text,
          streamAnimate: true,
        },
      ];
    }
    return messages;
  }, [messages, streamReply]);

  useStickToBottom(endRef, {
    messageCount: displayMessages.length,
    streamingText: streamReply?.text,
    isStreaming,
  });

  /** Solo antes del primer token: `streamReply` existe pero aún vacío. Si es `null`, el stream ya terminó o falló (p. ej. persistiendo en Convex) — no mostrar puntos. */
  const showThinking =
    isSending &&
    streamReply !== null &&
    streamReply.text.trim() === "";

  const composerCentered =
    centerComposerWhenEmpty &&
    displayMessages.length === 0 &&
    !isSending;

  const showCvUnified = Boolean(emptyStateTitle) && composerCentered;

  if (showCvUnified) {
    return (
      <div className="bg-carly-agent relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mx-auto flex min-h-0 w-full max-w-[900px] flex-1 flex-col items-center justify-center gap-4 px-3 py-4">
          <p
            className="m-0 max-w-lg text-balance text-center text-xl font-medium leading-snug text-[var(--carly-agent-text)] sm:text-2xl sm:leading-tight"
            role="status"
          >
            {emptyStateTitle}
          </p>
          <div className="w-full max-w-[min(720px,100%)]">
            <ChatInput
              onSend={sendMessage}
              disabled={isSending}
              centered={false}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-carly-agent relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full max-w-[900px] flex-1 flex-col gap-4 overflow-y-auto px-3 py-5",
          agentScrollSurface,
        )}
      >
        {displayMessages.length === 0 && !isSending && (
          <div className="flex w-full justify-center">
            {resumeLoading ? (
              <ChatResumeLoadingSkeleton />
            ) : !centerComposerWhenEmpty ? (
              <p className="m-0 text-center text-sm text-[var(--carly-agent-text-muted)]">
                Carga tu hoja de vida arriba para usar el chat centrado, o escribe
                abajo para empezar.
              </p>
            ) : null}
          </div>
        )}
        {displayMessages.map((m) => (
          <ChatMessageBubble key={m.id} message={m} />
        ))}
        {errorBanner && persistFromConvex ? (
          <p
            className="m-0 max-w-full rounded-[10px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
            role="alert"
          >
            {errorBanner}
          </p>
        ) : null}
        {showThinking ? <ThinkingDots /> : null}
        <div ref={endRef} className="h-px w-full shrink-0" aria-hidden />
      </div>
      <ChatInput
        onSend={sendMessage}
        disabled={isSending}
        centered={composerCentered}
      />
    </div>
  );
}
