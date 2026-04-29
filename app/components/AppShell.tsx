"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { AppSidebar, type AppSidebarMode } from "./AppSidebar";
import type { Id } from "@/convex/_generated/dataModel";

const MD_UP_QUERY = "(min-width: 768px)";

export type AppShellProps = {
  children: ReactNode;
  mode: AppSidebarMode;
  activeConversationId: Id<"conversations"> | null;
  onSelectConversation: (id: Id<"conversations">) => void;
  onArchiveConversation: (id: Id<"conversations">) => void;
  onNewChat: () => void;
  /** Clases extra en el &lt;main&gt; (p. ej. overflow, padding). */
  mainClassName?: string;
};

/**
 * Shell con sidebar fija en md+ y drawer + barra superior con menú hamburguesa en móvil.
 */
export function AppShell({
  children,
  mode,
  activeConversationId,
  onSelectConversation,
  onArchiveConversation,
  onNewChat,
  mainClassName,
}: AppShellProps) {
  const pathname = usePathname();
  const mdUp = useMediaQuery(MD_UP_QUERY);
  const isNarrow = mdUp === false;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    // Cerrar drawer al navegar (links del sidebar, etc.)
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- derivar estado de UI desde la ruta */
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen || !isNarrow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen, isNarrow]);

  useEffect(() => {
    if (!isNarrow || !mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isNarrow, mobileNavOpen]);

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-[var(--carly-page-bg)] text-[var(--carly-text)] antialiased md:flex-row">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--carly-border)] bg-[var(--carly-page-bg)] px-4 md:hidden">
        <button
          type="button"
          aria-expanded={mobileNavOpen}
          aria-controls="carly-app-sidebar-panel"
          onClick={() => setMobileNavOpen(true)}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--carly-border)] bg-[var(--carly-icon-bg)] text-[var(--carly-text)] shadow-sm transition hover:bg-[var(--carly-row-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--carly-primary-bg)]"
        >
          <Menu className="size-5" strokeWidth={2} aria-hidden />
          <span className="sr-only">Abrir menú de navegación</span>
        </button>
        <Link
          href="/"
          className="min-w-0 truncate text-lg font-bold tracking-tight text-transparent bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 bg-clip-text"
        >
          Carly
        </Link>
      </header>

      <div
        role="presentation"
        aria-hidden={!mobileNavOpen}
        className={cn(
          "fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] transition-opacity duration-300 ease-out motion-reduce:transition-none md:hidden",
          mobileNavOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={closeMobileNav}
      />

      <div
        id="carly-app-sidebar-panel"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex max-w-[100vw] md:static md:z-auto",
          "transition-transform duration-300 ease-out motion-reduce:transition-none",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <AppSidebar
          mode={mode}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => {
            closeMobileNav();
            onSelectConversation(id);
          }}
          onArchiveConversation={async (id) => {
            closeMobileNav();
            await onArchiveConversation(id);
          }}
          onNewChat={() => {
            closeMobileNav();
            onNewChat();
          }}
          isMobileShell={isNarrow}
          onMobileDrawerClose={closeMobileNav}
        />
      </div>

      <main
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--carly-page-bg)]",
          mainClassName,
        )}
      >
        {children}
      </main>
    </div>
  );
}
