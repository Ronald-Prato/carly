"use client";

import { useAuth } from "@clerk/nextjs";
import { Bot, FileText, MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthStatus } from "./AuthStatus";
import { ConversationListSkeleton } from "./loading-skeletons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";

const THEME_KEY = "carly-theme";

type Theme = "light" | "dark";

export type AppSidebarMode = "chat" | "cvs";

type AppSidebarProps = {
  mode: AppSidebarMode;
  /**
   * Conversación activa (solo modo chat).
   */
  activeConversationId: Id<"conversations"> | null;
  onSelectConversation: (id: Id<"conversations">) => void;
  onArchiveConversation: (id: Id<"conversations">) => void;
  onNewChat: () => void;
};

export function AppSidebar({
  mode,
  activeConversationId,
  onSelectConversation,
  onArchiveConversation,
  onNewChat,
}: AppSidebarProps) {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();
  const agentActive = pathname === "/";
  const cvsActive = pathname.startsWith("/my-cvs");
  const conversationRows = useQuery(
    api.agent.conversations.list,
    isSignedIn && mode === "chat" ? {} : "skip",
  );
  const resumeRows = useQuery(
    api.storage.resume.list,
    isSignedIn ? {} : "skip",
  );

  const cvHref = useMemo(() => {
    if (!isSignedIn || resumeRows === undefined) {
      return "/my-cvs";
    }
    if (resumeRows.length > 0) {
      return `/my-cvs/${resumeRows[0]._id}`;
    }
    return "/my-cvs";
  }, [isSignedIn, resumeRows]);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    const initial: Theme = saved === "dark" ? "dark" : "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- theme from localStorage after mount to avoid hydration mismatch
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const isDark = theme === "dark";
  const listLoadingConversations =
    isSignedIn && mode === "chat" && conversationRows === undefined;

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-[var(--carly-border)] bg-[var(--carly-sidebar-bg)]">
      <header className="shrink-0 border-b border-[var(--carly-border)] px-3 py-3 sm:px-4 sm:py-3.5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="min-w-0 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 bg-clip-text text-xl font-semibold leading-tight tracking-tight text-transparent sm:text-2xl">
            <Link
              href="/"
              className="block min-w-0 text-transparent [background:inherit] [background-clip:padding-box] hover:opacity-90"
            >
              Carly
            </Link>
          </h1>
          {mode === "cvs" ? (
            <Link
              href="/"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--carly-primary-bg)] px-2.5 py-2 text-xs font-semibold text-[var(--carly-primary-fg)] shadow-sm transition hover:bg-[var(--carly-primary-hover)] active:scale-[0.98] active:bg-[var(--carly-primary-active)] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
            >
              <MessageSquarePlus
                className="size-3.5 shrink-0 sm:size-4"
                strokeWidth={2.25}
                aria-hidden
              />
              <span className="whitespace-nowrap">Nuevo chat</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={onNewChat}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--carly-primary-bg)] px-2.5 py-2 text-xs font-semibold text-[var(--carly-primary-fg)] shadow-sm transition hover:bg-[var(--carly-primary-hover)] active:scale-[0.98] active:bg-[var(--carly-primary-active)] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
            >
              <MessageSquarePlus
                className="size-3.5 shrink-0 sm:size-4"
                strokeWidth={2.25}
                aria-hidden
              />
              <span className="whitespace-nowrap">Nuevo chat</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-2 pb-2 sm:pt-3">
        <div className="shrink-0">
          <Link
            href="/"
            aria-current={agentActive ? "page" : undefined}
            className={[
              "mb-2 flex w-full min-w-0 items-center gap-2 rounded-[10px] py-2.5 pl-2 pr-2 text-left text-sm transition",
              agentActive
                ? "bg-[var(--carly-sidebar-active)] font-medium text-[var(--carly-text)]"
                : "text-[var(--carly-muted)] hover:bg-[var(--carly-row-hover)]",
            ].join(" ")}
          >
            <span
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-[var(--carly-icon-border)] bg-[var(--carly-icon-bg)] text-[var(--carly-icon-fg)]"
              aria-hidden
            >
              <Bot className="size-3.5" strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1 truncate">Agente</span>
          </Link>
          <Link
            href={cvHref}
            aria-current={cvsActive ? "page" : undefined}
            className={[
              "mb-3 flex w-full min-w-0 items-center gap-2 rounded-[10px] py-2.5 pl-2 pr-2 text-left text-sm transition",
              cvsActive
                ? "bg-[var(--carly-sidebar-active)] font-medium text-[var(--carly-text)]"
                : "text-[var(--carly-muted)] hover:bg-[var(--carly-row-hover)]",
            ].join(" ")}
          >
            <span
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-[var(--carly-icon-border)] bg-[var(--carly-icon-bg)] text-[var(--carly-icon-fg)]"
              aria-hidden
            >
              <FileText className="size-3.5" strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1 truncate">Mi CV</span>
          </Link>
        </div>

        {mode === "chat" ? (
          <>
            <p className="mb-2 shrink-0 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--carly-label)]">
              Mis conversaciones
            </p>
            <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
              {!isSignedIn ? (
                <p className="px-2 py-3 text-sm leading-relaxed text-[var(--carly-muted)]">
                  Inicia sesión para ver tus conversaciones guardadas, o abre un
                  chat local con &quot;Nuevo chat&quot;.
                </p>
              ) : listLoadingConversations ? (
                <ConversationListSkeleton />
              ) : (conversationRows ?? []).length === 0 ? (
                <p className="px-2 py-3 text-xs leading-relaxed text-[var(--carly-muted)]">
                  Aún no hay conversaciones. Crea un chat para empezar.
                </p>
              ) : (
                (conversationRows ?? []).map((row) => {
                  const isActive = activeConversationId === row._id;
                  return (
                    <div
                      key={row._id}
                      className={[
                        "group flex w-full min-w-0 items-center gap-0.5 rounded-[10px] pl-1 pr-1.5 text-sm transition",
                        isActive
                          ? "bg-[var(--carly-sidebar-active)] font-medium text-[var(--carly-text)]"
                          : "text-[var(--carly-muted)] hover:bg-[var(--carly-row-hover)]",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectConversation(row._id)}
                        className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-2 pr-0 text-left"
                      >
                        <span
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-[var(--carly-icon-border)] bg-[var(--carly-icon-bg)] text-[var(--carly-icon-fg)]"
                          aria-hidden
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {row.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onArchiveConversation(row._id);
                        }}
                        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--carly-muted)] opacity-0 pointer-events-none transition group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto hover:bg-[var(--carly-row-hover)] hover:text-[var(--carly-text)] focus:outline-none focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:ring-2 focus-visible:ring-[var(--carly-primary-bg)]"
                        title="Archivar"
                        aria-label={`Archivar «${row.title}»`}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <rect width="20" height="5" x="2" y="3" rx="1" />
                          <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                          <path d="M10 12h4" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              )}
            </nav>
          </>
        ) : null}
      </div>

      <div className="shrink-0 space-y-4 border-t border-[var(--carly-border)] p-3">
        <AuthStatus />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
            }
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--carly-border)] bg-[var(--carly-icon-bg)] text-[var(--carly-text)] transition hover:bg-[var(--carly-row-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--carly-primary-bg)]"
          >
            {isDark ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
