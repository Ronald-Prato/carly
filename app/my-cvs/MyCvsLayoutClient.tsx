"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppSidebar } from "../components/AppSidebar";
import { FirstCvSearchBanner } from "../components/FirstCvSearchBanner";

type MyCvsLayoutClientProps = {
  children: ReactNode;
};

/**
 * Contenedor compartido de /my-cvs: sidebar fijo, área principal con children.
 */
export function MyCvsLayoutClient({ children }: MyCvsLayoutClientProps) {
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-[var(--carly-page-bg)] text-[var(--carly-text)] antialiased sm:flex-row">
      <AppSidebar
        mode="cvs"
        activeConversationId={null}
        onSelectConversation={() => {}}
        onArchiveConversation={() => {}}
        onNewChat={() => {}}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--carly-page-bg)]">
        <Unauthenticated>
          <div className="mx-auto max-w-md px-6 py-10">
            <h1 className="text-2xl font-semibold text-[var(--carly-text)]">
              Mi CV
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--carly-muted)]">
              Inicia sesión para subir tu PDF y que Carly use tu hoja de vida
              en el chat.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex items-center justify-center rounded-[10px] border border-[var(--carly-border)] bg-[var(--carly-icon-bg)] px-4 py-2.5 text-sm font-medium text-[var(--carly-text)] transition hover:bg-[var(--carly-row-hover)]"
            >
              Iniciar sesión
            </Link>
          </div>
        </Unauthenticated>
        <Authenticated>
          <>
            <FirstCvSearchBanner />
            {children}
          </>
        </Authenticated>
      </main>
    </div>
  );
}
