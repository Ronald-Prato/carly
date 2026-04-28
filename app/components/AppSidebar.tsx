"use client";

import { useAuth } from "@clerk/nextjs";
import {
  Bookmark,
  Bot,
  Briefcase,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Home,
  Moon,
  SquarePen,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { HoverTooltip } from "./PointerTooltip";
import { CvTabOnboarding } from "./CvTabOnboarding";
import { AuthStatus } from "./AuthStatus";
import { ConversationListSkeleton } from "./loading-skeletons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CV_REQUIRED_TOOLTIP } from "@/lib/cvGate";
import { AGENT_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";

const SIDEBAR_COLLAPSED_KEY = "carly-sidebar-collapsed";

/** En false, se ocultan Agente, Nuevo chat y conversaciones. */
const SHOW_AGENT_IN_SIDEBAR = true;

/** Ancho animado — coincidir con clases Tailwind w-[280px] / w-[72px] */
const SIDEBAR_EXPANDED_CLASS = "w-[280px]";
const SIDEBAR_COLLAPSED_CLASS = "w-[72px]";
const SIDEBAR_TRANSITION =
  "transition-[width] duration-300 ease-in-out motion-reduce:transition-none";
/** Debe coincidir con duration-300 + margen para transitionend con motion-reduce */
const WIDTH_TRANSITION_MS = 300;

export type AppSidebarMode = "chat" | "cvs" | "home";

type AppSidebarProps = {
  mode: AppSidebarMode;
  /** Conversación activa (solo modo chat). */
  activeConversationId: Id<"conversations"> | null;
  onSelectConversation: (id: Id<"conversations">) => void;
  onArchiveConversation: (id: Id<"conversations">) => void;
  onNewChat: () => void;
};

function iconBoxClass(active: boolean) {
  return cn(
    "inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] transition-colors",
    active
      ? "border border-transparent bg-[var(--carly-nav-active-icon-bg)] text-white shadow-none"
      : "border border-[var(--carly-border)] bg-[var(--carly-icon-bg)] text-[var(--carly-nav-inactive-fg)]",
  );
}

function SidebarNavRow({
  href,
  locked,
  active,
  showIconRail,
  icon,
  label,
  marginClass = "mb-3",
}: {
  href: string;
  locked: boolean;
  active: boolean;
  showIconRail: boolean;
  icon: ReactNode;
  label: string;
  marginClass?: string;
}) {
  const base = cn(
    marginClass,
    "flex min-w-0 items-center rounded-[12px] py-2.5 text-left text-sm transition-colors",
    showIconRail ? "w-full justify-center px-2" : "w-full gap-2.5 pl-2 pr-2",
  );

  const interactive = locked
    ? "cursor-not-allowed opacity-[0.55] text-[var(--carly-nav-inactive-fg)]"
    : active
      ? "bg-[var(--carly-sidebar-active)] font-semibold text-[var(--carly-nav-active-text)] shadow-sm"
      : "text-[var(--carly-nav-inactive-fg)] hover:bg-[var(--carly-row-hover)]";

  const iconActive = locked ? false : active;

  const inner = (
    <>
      <span className={iconBoxClass(iconActive)} aria-hidden>
        {icon}
      </span>
      {!showIconRail && (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      )}
    </>
  );

  if (locked) {
    return (
      <HoverTooltip
        content={CV_REQUIRED_TOOLTIP}
        role="link"
        aria-disabled="true"
        className={cn(base, interactive)}
      >
        {inner}
      </HoverTooltip>
    );
  }

  return (
    <Link
      href={href}
      title={showIconRail ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(base, interactive)}
    >
      {inner}
    </Link>
  );
}

function ThemeSwitchPill({
  checked,
  onToggle,
  title,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-7 w-[3.25rem] shrink-0 rounded-full px-px transition-colors duration-300 ease-in-out motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--carly-primary-bg)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--carly-sidebar-bg)] disabled:pointer-events-none disabled:opacity-50",
        checked ? "bg-violet-600" : "bg-slate-200 dark:bg-zinc-600",
      )}
    >
      <span className="sr-only">Alternar modo oscuro</span>
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 inline-block size-[22px] -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-300 ease-in-out motion-reduce:transition-none",
          checked ? "left-[calc(100%-23px)]" : "left-px",
        )}
      />
    </button>
  );
}

export function AppSidebar({
  mode,
  activeConversationId,
  onSelectConversation,
  onArchiveConversation,
  onNewChat,
}: AppSidebarProps) {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();
  const homeActive = pathname === "/";
  const agentActive =
    pathname === AGENT_PATH || pathname.startsWith(`${AGENT_PATH}/`);
  const cvsActive = pathname.startsWith("/my-cvs");
  const jobsActive = pathname.startsWith("/jobs");
  const savedOffersActive = pathname.startsWith("/saved-offers");

  /** Ancho objetivo del aside (animado). */
  const [widthCollapsed, setWidthCollapsed] = useState(false);
  /** Solo iconos / cabecera compacta — se sincroniza al terminar la animación de ancho. */
  const [railCollapsed, setRailCollapsed] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const cvNavAnchorRef = useRef<HTMLDivElement>(null);
  const widthAnimPendingRef = useRef<"collapse" | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (raw === "1") {
        // Estado restaurado desde localStorage: sin animación; ancho + rail alineados.
        /* eslint-disable react-hooks/set-state-in-effect -- restore sidebar from localStorage after mount (same pattern as theme) */
        setWidthCollapsed(true);
        setRailCollapsed(true);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      /* ignore */
    }
  }, []);

  const commitIconRailAfterCollapse = useCallback(() => {
    setRailCollapsed(true);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
    } catch {
      /* ignore */
    }
    widthAnimPendingRef.current = null;
  }, []);

  useEffect(() => {
    if (widthAnimPendingRef.current !== "collapse") return;
    const el = asideRef.current;
    if (!el) return;

    let finished = false;
    const flush = () => {
      if (finished) return;
      finished = true;
      commitIconRailAfterCollapse();
    };

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== "width") return;
      flush();
    };

    el.addEventListener("transitionend", onTransitionEnd);
    const fallback = window.setTimeout(flush, WIDTH_TRANSITION_MS + 80);

    return () => {
      el.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(fallback);
    };
  }, [widthCollapsed, commitIconRailAfterCollapse]);

  const beginCollapse = useCallback(() => {
    if (widthCollapsed) return;
    widthAnimPendingRef.current = "collapse";
    setWidthCollapsed(true);
  }, [widthCollapsed]);

  const beginExpand = useCallback(() => {
    if (!widthCollapsed) return;
    widthAnimPendingRef.current = null;
    setRailCollapsed(false);
    setWidthCollapsed(false);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "0");
    } catch {
      /* ignore */
    }
  }, [widthCollapsed]);

  const conversationRows = useQuery(
    api.agent.conversations.list,
    isSignedIn && mode === "chat" ? {} : "skip",
  );
  const showChatChrome = SHOW_AGENT_IN_SIDEBAR && mode === "chat";
  const resumeRows = useQuery(
    api.storage.resume.list,
    isSignedIn ? {} : "skip",
  );
  const profile = useQuery(
    api.database.profiles.getCurrent,
    isSignedIn ? {} : "skip",
  );
  const markWalkthroughDone = useMutation(
    api.database.profiles.markWalkthroughDone,
  );

  /** Oculta el WT al instante; la mutación corre en segundo plano. */
  const [cvWtDismissedOptimistic, setCvWtDismissedOptimistic] =
    useState(false);

  const dismissCvOnboarding = useCallback(() => {
    setCvWtDismissedOptimistic(true);
    void markWalkthroughDone();
  }, [markWalkthroughDone]);

  const lockAgentJobs =
    !isSignedIn ||
    resumeRows === undefined ||
    resumeRows.length === 0;

  const cvHref = useMemo(() => {
    if (!isSignedIn || resumeRows === undefined) {
      return "/my-cvs";
    }
    if (resumeRows.length > 0) {
      return `/my-cvs/${resumeRows[0]._id}`;
    }
    return "/my-cvs";
  }, [isSignedIn, resumeRows]);

  const { resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => {
    setThemeMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const isDark = themeMounted && resolvedTheme === "dark";
  const listLoadingConversations =
    isSignedIn && showChatChrome && conversationRows === undefined;

  /** Modo rail solo-iconos estable: solo con ancho estrecho y tras terminar la animación de colapso (al expandir, layout completo antes de que crezca el aside). */
  const showIconRail = railCollapsed && widthCollapsed;

  const showCvTabOnboarding =
    isSignedIn &&
    !showIconRail &&
    !cvWtDismissedOptimistic &&
    resumeRows !== undefined &&
    resumeRows.length === 0 &&
    profile !== undefined &&
    profile?.hasDoneWT !== true;

  return (
    <aside
      ref={asideRef}
      className={cn(
        "relative flex shrink-0 flex-col overflow-hidden border-r border-[var(--carly-border)] bg-[var(--carly-sidebar-bg)] antialiased",
        SIDEBAR_TRANSITION,
        widthCollapsed ? SIDEBAR_COLLAPSED_CLASS : SIDEBAR_EXPANDED_CLASS,
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          !showIconRail && "min-w-[280px]",
        )}
      >
      <header className="shrink-0 border-b border-[var(--carly-border)] px-3 py-3.5">
        {!showIconRail ? (
          <div className="flex items-center justify-between gap-2">
            <h1 className="min-w-0 flex-1 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 bg-clip-text text-xl font-bold leading-tight tracking-tight text-transparent sm:text-2xl">
              <Link
                href="/"
                className="block min-w-0 text-transparent [background:inherit] [background-clip:padding-box] hover:opacity-90"
              >
                Carly
              </Link>
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              {SHOW_AGENT_IN_SIDEBAR && agentActive ? (
                <button
                  type="button"
                  onClick={onNewChat}
                  title="Nuevo chat"
                  aria-label="Nuevo chat"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--carly-primary-bg)] text-[var(--carly-primary-fg)] shadow-sm transition hover:bg-[var(--carly-primary-hover)] active:scale-[0.98] active:bg-[var(--carly-primary-active)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--carly-primary-bg)]"
                >
                  <SquarePen
                    className="size-4 shrink-0"
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
              ) : null}
            <button
              type="button"
              onClick={beginCollapse}
              aria-expanded={!showIconRail}
              aria-label="Colapsar barra lateral"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-[var(--carly-border)] bg-[var(--carly-page-bg)] text-[var(--carly-muted)] shadow-sm transition hover:bg-[var(--carly-row-hover)] hover:text-[var(--carly-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--carly-primary-bg)]"
            >
              <ChevronsLeft className="size-3.5" strokeWidth={2} aria-hidden />
            </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Link
              href="/"
              title="Carly — Inicio"
              className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-500 text-xs font-bold text-white shadow-sm transition hover:opacity-92"
            >
              C
            </Link>
            <button
              type="button"
              onClick={beginExpand}
              aria-expanded={!showIconRail}
              aria-label="Expandir barra lateral"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-[var(--carly-border)] bg-[var(--carly-page-bg)] text-[var(--carly-muted)] shadow-sm transition hover:bg-[var(--carly-row-hover)] hover:text-[var(--carly-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--carly-primary-bg)]"
            >
              <ChevronsRight className="size-3.5" strokeWidth={2} aria-hidden />
            </button>
          </div>
        )}
      </header>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto pb-2",
          showIconRail ? "px-2 pt-2" : "px-3 pt-3",
        )}
      >
        <div
          className={cn("shrink-0", showIconRail && "flex flex-col items-center")}
        >
          <Link
            href="/"
            title={showIconRail ? "Inicio" : undefined}
            aria-current={homeActive ? "page" : undefined}
            className={cn(
              "mb-3 flex min-w-0 items-center rounded-[12px] py-2.5 text-left text-sm transition-colors",
              showIconRail ? "w-full justify-center px-2" : "w-full gap-2.5 pl-2 pr-2",
              homeActive
                ? "bg-[var(--carly-sidebar-active)] font-semibold text-[var(--carly-nav-active-text)] shadow-sm"
                : "text-[var(--carly-nav-inactive-fg)] hover:bg-[var(--carly-row-hover)]",
            )}
          >
            <span className={iconBoxClass(homeActive)} aria-hidden>
              <Home className="size-4" strokeWidth={2.25} />
            </span>
            {!showIconRail && (
              <span className="min-w-0 flex-1 truncate">Inicio</span>
            )}
          </Link>

          <div ref={cvNavAnchorRef} className="relative mb-3">
            <Link
              href={cvHref}
              title={showIconRail ? "Mi CV" : undefined}
              aria-current={cvsActive ? "page" : undefined}
              className={cn(
                "flex min-w-0 items-center rounded-[12px] py-2.5 text-left text-sm transition-colors",
                showIconRail ? "w-full justify-center px-2" : "w-full gap-2.5 pl-2 pr-2",
                cvsActive
                  ? "bg-[var(--carly-sidebar-active)] font-semibold text-[var(--carly-nav-active-text)] shadow-sm"
                  : "text-[var(--carly-nav-inactive-fg)] hover:bg-[var(--carly-row-hover)]",
              )}
            >
              <span className={iconBoxClass(cvsActive)} aria-hidden>
                <FileText className="size-4" strokeWidth={2.25} />
              </span>
              {!showIconRail && (
                <span className="min-w-0 flex-1 truncate">Mi CV</span>
              )}
            </Link>
          </div>

          {SHOW_AGENT_IN_SIDEBAR ? (
            <SidebarNavRow
              href={AGENT_PATH}
              locked={lockAgentJobs}
              active={agentActive}
              showIconRail={showIconRail}
              icon={<Bot className="size-4" strokeWidth={2.25} />}
              label="Agente"
              marginClass="mb-3"
            />
          ) : null}

          <SidebarNavRow
            href="/jobs"
            locked={lockAgentJobs}
            active={jobsActive}
            showIconRail={showIconRail}
            icon={<Briefcase className="size-4" strokeWidth={2.25} />}
            label="Empleos"
            marginClass="mb-3"
          />

          <SidebarNavRow
            href="/saved-offers"
            locked={lockAgentJobs}
            active={savedOffersActive}
            showIconRail={showIconRail}
            icon={<Bookmark className="size-4" strokeWidth={2.25} />}
            label="Ofertas guardadas"
            marginClass="mb-3"
          />
        </div>

        {showChatChrome ? (
          <>
            {!showIconRail && (
              <p className="mb-2 shrink-0 px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--carly-label)]">
                Mis conversaciones
              </p>
            )}
            <nav className={cn(
              "min-h-0 flex-1 overflow-y-auto",
              showIconRail ? "pr-0" : "pr-1",
            )}
            >
              {!isSignedIn ? (
                !showIconRail ? (
                  <p className="px-2 py-3 text-sm leading-relaxed text-[var(--carly-muted)]">
                    Inicia sesión para ver tus conversaciones guardadas, o abre un
                    chat local con &quot;Nuevo chat&quot;.
                  </p>
                ) : null
              ) : listLoadingConversations ? (
                <ConversationListSkeleton compact={showIconRail} />
              ) : (conversationRows ?? []).length === 0 ? (
                !showIconRail ? (
                  <p className="px-2 py-3 text-xs leading-relaxed text-[var(--carly-muted)]">
                    Aún no hay conversaciones. Crea un chat para empezar.
                  </p>
                ) : null
              ) : (
                (conversationRows ?? []).map((row) => {
                  const isActive = activeConversationId === row._id;
                  return (
                    <div
                      key={row._id}
                      className={cn(
                        "group mb-0.5 flex w-full min-w-0 items-center gap-0.5 rounded-[12px] pl-1 pr-1.5 text-sm transition",
                        isActive
                          ? "bg-[var(--carly-sidebar-active)] font-medium text-[var(--carly-nav-active-text)]"
                          : "text-[var(--carly-muted)] hover:bg-[var(--carly-row-hover)]",
                      )}
                    >
                      <button
                        type="button"
                        title={showIconRail ? row.title : undefined}
                        onClick={() => onSelectConversation(row._id)}
                        className={cn(
                          "flex items-center gap-1.5 py-2.5 text-left",
                          showIconRail
                            ? "w-full shrink-0 justify-center px-0 pl-2 pr-0"
                            : "min-w-0 flex-1 pl-2 pr-0",
                        )}
                      >
                        <span
                          className={iconBoxClass(isActive)}
                          aria-hidden
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
                          >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        </span>
                        {!showIconRail && (
                          <span className="min-w-0 flex-1 truncate">
                            {row.title}
                          </span>
                        )}
                      </button>
                      {!showIconRail && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onArchiveConversation(row._id);
                        }}
                        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--carly-muted)] opacity-0 pointer-events-none transition group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto hover:bg-[var(--carly-row-hover)] hover:text-[var(--carly-text)] focus:outline-none focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:ring-2 focus-visible:ring-[var(--carly-primary-bg)]"
                        title="Archivar"
                        aria-label={`Archivar «${row.title}»`}
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
                          aria-hidden
                        >
                          <rect width="20" height="5" x="2" y="3" rx="1" />
                          <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                          <path d="M10 12h4" />
                        </svg>
                      </button>
                      )}
                    </div>
                  );
                })
              )}
            </nav>
          </>
        ) : null}
      </div>

      <div
        className={cn(
          "shrink-0 space-y-4 border-t border-[var(--carly-border)]",
          showIconRail ? "px-2 py-4" : "p-4",
        )}
      >
        <AuthStatus collapsed={showIconRail} />

        {!showIconRail ? (
          <div className="flex items-center justify-between gap-3 rounded-[12px] px-1 py-1">
            <span className="inline-flex min-w-0 items-center gap-2 text-sm text-[var(--carly-nav-inactive-fg)]">
              <Moon className="size-4 shrink-0 text-[var(--carly-muted)]" strokeWidth={2.25} />
              <span>Modo oscuro</span>
            </span>
            <ThemeSwitchPill
              checked={isDark}
              onToggle={toggleTheme}
              disabled={!themeMounted}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Moon
              className="size-4 shrink-0 text-[var(--carly-muted)]"
              strokeWidth={2.25}
              aria-hidden
            />
            <ThemeSwitchPill
              checked={isDark}
              onToggle={toggleTheme}
              disabled={!themeMounted}
              title={isDark ? "Modo oscuro activo" : "Activar modo oscuro"}
            />
          </div>
        )}

        <p
          className={cn(
            "text-center text-[11px] leading-snug text-[var(--carly-muted)]",
            showIconRail && "px-0.5",
          )}
        >
          Hecho con ❤️ por{" "}
          <Link
            href="https://github.com/Ronald-Prato"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--carly-nav-active-text)] underline-offset-2 hover:underline"
          >
            Ronald Prato
          </Link>
        </p>
      </div>
      </div>

      <CvTabOnboarding
        open={Boolean(showCvTabOnboarding)}
        anchorRef={cvNavAnchorRef}
        onDismiss={dismissCvOnboarding}
      />
    </aside>
  );
}
