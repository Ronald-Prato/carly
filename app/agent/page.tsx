"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppSidebar } from "../components/AppSidebar";
import { ChatPanel } from "../components/chat/ChatPanel";
import type { ChatMessage } from "../components/chat/types";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { AGENT_PATH } from "@/lib/routes";

function mapMessageDoc(m: Doc<"messages">): ChatMessage {
  return {
    id: m._id,
    role: m.type === "user" ? "user" : "assistant",
    content: m.content,
  };
}

function AgentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const convInUrl = searchParams.get("conv");
  const { isSignedIn } = useAuth();
  const resume = useQuery(api.storage.resume.get);
  const cvReady = Boolean(
    isSignedIn && resume !== undefined && resume !== null,
  );
  const resumeLoading = Boolean(isSignedIn && resume === undefined);

  const conversationRows = useQuery(
    api.agent.conversations.list,
    isSignedIn ? {} : "skip",
  );
  const archiveConversation = useMutation(api.agent.conversations.archive);

  const [draftMessages, setDraftMessages] = useState<ChatMessage[]>([]);

  const serverConvId: Id<"conversations"> | null = useMemo(() => {
    if (!convInUrl) {
      return null;
    }
    const id = convInUrl as Id<"conversations">;
    if (!isSignedIn) {
      return null;
    }
    if (conversationRows === undefined) {
      return id;
    }
    return conversationRows.some((r) => r._id === id) ? id : null;
  }, [isSignedIn, conversationRows, convInUrl]);

  useEffect(() => {
    if (!isSignedIn || conversationRows === undefined || !convInUrl) {
      return;
    }
    const id = convInUrl as Id<"conversations">;
    if (!conversationRows.some((r) => r._id === id)) {
      router.replace(AGENT_PATH);
    }
  }, [isSignedIn, convInUrl, conversationRows, router]);

  const rowMessages = useQuery(
    api.agent.messages.listByConversation,
    serverConvId ? { conversationId: serverConvId } : "skip",
  );

  const displayMessages: ChatMessage[] = useMemo(() => {
    if (!serverConvId) {
      return draftMessages;
    }
    if (rowMessages === undefined) {
      return draftMessages;
    }
    return rowMessages.map(mapMessageDoc);
  }, [serverConvId, rowMessages, draftMessages]);

  const setDisplayMessages = useCallback(
    (value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      if (serverConvId) return;
      setDraftMessages((prev) =>
        typeof value === "function" ? value(prev) : value,
      );
    },
    [serverConvId],
  );

  const onConversationCreated = useCallback(
    (id: Id<"conversations">, title: string) => {
      router.replace(`${AGENT_PATH}?conv=${id}`);
      void title;
    },
    [router],
  );

  const createChat = useCallback(() => {
    setDraftMessages([]);
    router.replace(AGENT_PATH);
  }, [router]);

  const selectConversation = useCallback(
    (id: Id<"conversations">) => {
      setDraftMessages([]);
      router.replace(`${AGENT_PATH}?conv=${id}`);
    },
    [router],
  );

  const onArchiveConversation = useCallback(
    async (id: Id<"conversations">) => {
      await archiveConversation({ conversationId: id });
      if (serverConvId === id) {
        setDraftMessages([]);
        router.replace(AGENT_PATH);
      }
    },
    [archiveConversation, serverConvId, router],
  );

  const persistFromConvex = Boolean(isSignedIn && serverConvId !== null);
  const conversationIdForApi = serverConvId;

  const emptyCvHeadline =
    cvReady && !resumeLoading && displayMessages.length === 0
      ? "¿Qué quieres que hagamos hoy con tu CV?"
      : undefined;

  return (
    <div className="flex h-dvh min-h-0 bg-[var(--carly-page-bg)] text-[var(--carly-text)] antialiased">
      <AppSidebar
        mode="chat"
        activeConversationId={serverConvId}
        onSelectConversation={selectConversation}
        onArchiveConversation={onArchiveConversation}
        onNewChat={createChat}
      />
      <main className="flex min-w-0 flex-1 flex-col bg-[var(--carly-page-bg)]">
        <div className="bg-carly-agent flex min-h-0 min-w-0 flex-1 flex-col">
          <ChatPanel
            messages={displayMessages}
            setMessages={setDisplayMessages}
            isSignedIn={Boolean(isSignedIn)}
            conversationId={conversationIdForApi}
            onConversationCreated={onConversationCreated}
            persistFromConvex={persistFromConvex}
            centerComposerWhenEmpty={cvReady}
            resumeLoading={resumeLoading}
            emptyStateTitle={emptyCvHeadline}
          />
        </div>
      </main>
    </div>
  );
}

function AgentFallback() {
  return (
    <div className="flex h-dvh min-h-0 items-center justify-center bg-[var(--carly-page-bg)] text-[var(--carly-text)]">
      <p className="text-sm text-[var(--carly-muted)]">Cargando…</p>
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={<AgentFallback />}>
      <AgentPageContent />
    </Suspense>
  );
}
