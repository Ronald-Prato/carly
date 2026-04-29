"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { FirstCvSearchBanner } from "../components/FirstCvSearchBanner";

type MyCvsLayoutClientProps = {
  children: ReactNode;
};

/**
 * Contenedor compartido de /my-cvs: sidebar fijo, área principal con children.
 */
export function MyCvsLayoutClient({ children }: MyCvsLayoutClientProps) {
  return (
    <AppShell
      mode="cvs"
      activeConversationId={null}
      onSelectConversation={() => {}}
      onArchiveConversation={async () => {}}
      onNewChat={() => {}}
      mainClassName="overflow-y-auto"
    >
      <Unauthenticated>
        <div className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-10">
          <h1 className="text-2xl font-semibold text-[var(--carly-text)]">
            Mi CV
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--carly-muted)]">
            Inicia sesión para subir tu PDF y que Carly use tu hoja de vida en
            el chat.
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
    </AppShell>
  );
}
