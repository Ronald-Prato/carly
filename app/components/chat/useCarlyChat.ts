"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";

import { NEW_CONVERSATION_PLACEHOLDER_TITLE } from "@/app/lib/carlyAgent";
import { getClientChatModel } from "@/app/lib/chatModel";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import type { ChatMessage } from "./types";

type SetMessages = (
  value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
) => void;

type UseCarlyChatOptions = {
  isSignedIn: boolean;
  /**
   * With a Convex conversation, the thread is driven by the query;
   * on success we do not append user/assistant to local state.
   */
  persistFromConvex: boolean;
  /** `null` for draft; after creating or opening a saved chat, the real id. */
  conversationId: Id<"conversations"> | null;
  onConversationCreated: (id: Id<"conversations">, title: string) => void;
};

export function useCarlyChat(
  messages: ChatMessage[],
  setMessages: SetMessages,
  {
    isSignedIn,
    persistFromConvex,
    conversationId,
    onConversationCreated,
  }: UseCarlyChatOptions,
) {
  const { getToken } = useAuth();
  const [streamReply, setStreamReply] = useState<{ text: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const createConversation = useMutation(api.agent.conversations.create);
  const addUserMessage = useMutation(api.agent.messages.addUserMessage);
  const addSystemMessage = useMutation(api.agent.messages.addSystemMessage);
  const modelLabel = getClientChatModel();

  useEffect(() => {
    setStreamReply(null);
    setErrorBanner(null);
  }, [conversationId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isSending) return;
      setErrorBanner(null);

      const userMsg: ChatMessage = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };

      if (!persistFromConvex) {
        setMessages((prev) => [...prev, userMsg]);
      }
      setIsSending(true);
      setStreamReply({ text: "" });

      const historyPayload = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let activeConversationId = conversationId;
      let justCreated = false;
      const titleForCreated = NEW_CONVERSATION_PLACEHOLDER_TITLE;

      try {
        if (isSignedIn) {
          if (activeConversationId === null) {
            activeConversationId = await createConversation({
              title: titleForCreated,
              initialMessages: [],
            });
            justCreated = true;
          }
          if (activeConversationId !== null) {
            await addUserMessage({
              conversationId: activeConversationId,
              content: trimmed,
              inTokens: 0,
              outTokens: 0,
            });
          }
        }

        const useServerHistory =
          isSignedIn && activeConversationId !== null;
        if (!isSignedIn && historyPayload.length === 0) {
          throw new Error("No message to send.");
        }

        let convexJwt: string | undefined;
        if (useServerHistory && activeConversationId !== null) {
          try {
            convexJwt =
              (await getToken({ template: "convex" })) ??
              (await getToken()) ??
              undefined;
          } catch {
            try {
              convexJwt = (await getToken()) ?? undefined;
            } catch {
              convexJwt = undefined;
            }
          }
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            useServerHistory && activeConversationId !== null
              ? {
                  conversationId: activeConversationId,
                  /** Server can skip loading history via getToken("convex") when the body includes it. */
                  messages: historyPayload,
                  ...(convexJwt ? { convexToken: convexJwt } : {}),
                }
              : { messages: historyPayload },
          ),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Error ${res.status}`);
        }

        if (!res.body) {
          throw new Error("Response had no body.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setStreamReply({ text: accumulated });
        }

        const finalText = accumulated;

        if (useServerHistory) {
          if (finalText.trim().length > 0) {
            await addSystemMessage({
              conversationId: activeConversationId!,
              content: finalText,
              model: modelLabel,
              inTokens: 0,
              outTokens: 0,
            });
          }
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id:
                typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `a-${Date.now()}`,
              role: "assistant",
              content: finalText,
            },
          ]);
        }
        setStreamReply(null);
        if (useServerHistory && justCreated && activeConversationId !== null) {
          onConversationCreated(activeConversationId, titleForCreated);
        }
      } catch (e) {
        setStreamReply(null);
        const msg =
          e instanceof Error
            ? e.message
            : "Could not complete the message. Check your connection and try again.";
        setErrorBanner(msg);
        if (!persistFromConvex) {
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "assistant",
              content: `**Error:** ${msg}`,
            },
          ]);
        }
      } finally {
        setIsSending(false);
      }
    },
    [
      isSending,
      messages,
      setMessages,
      isSignedIn,
      persistFromConvex,
      conversationId,
      onConversationCreated,
      createConversation,
      addUserMessage,
      addSystemMessage,
      modelLabel,
      getToken,
    ],
  );

  return {
    streamReply,
    isSending,
    sendMessage,
    errorBanner,
  };
}
