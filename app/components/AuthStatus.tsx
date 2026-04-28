"use client";

import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { AccountCardSkeleton } from "./loading-skeletons";
import { UserAccountMenu } from "./UserAccountMenu";

type AuthStatusProps = {
  /** Barra lateral colapsada: solo avatar centrado */
  collapsed?: boolean;
};

export function AuthStatus({ collapsed = false }: AuthStatusProps) {
  const convexUser = useQuery(api.database.users.getCurrent);
  const { user } = useUser();
  const accountName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    convexUser?.name ||
    null;
  const accountEmail =
    user?.primaryEmailAddress?.emailAddress ?? convexUser?.email ?? null;

  const sectionTitle = (
    <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--carly-label)]">
      Cuenta
    </p>
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3">
        <Unauthenticated>
          <Link
            href="/login"
            title="Iniciar sesión"
            className="flex size-9 items-center justify-center rounded-[8px] border border-[var(--carly-border)] bg-[var(--carly-icon-bg)] text-[var(--carly-text)] transition hover:bg-[var(--carly-row-hover)]"
          >
            <LogIn className="size-4" strokeWidth={2.25} aria-hidden />
          </Link>
        </Unauthenticated>
        <Authenticated>
          {convexUser === undefined ? (
            <div className="size-9 animate-pulse rounded-full bg-[var(--carly-border)]" />
          ) : (
            <div className="flex justify-center">
              <UserAccountMenu
                collapsed
                accountName={accountName}
                accountEmail={accountEmail}
              />
            </div>
          )}
        </Authenticated>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sectionTitle}
      <Unauthenticated>
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-[10px] border border-[var(--carly-border)] bg-[var(--carly-icon-bg)] px-3 py-2.5 text-sm font-medium text-[var(--carly-text)] transition hover:bg-[var(--carly-row-hover)]"
        >
          Iniciar sesión
        </Link>
        <p className="px-1 text-xs leading-relaxed text-[var(--carly-muted)]">
          Google, GitHub o LinkedIn (según lo actives en Clerk).
        </p>
      </Unauthenticated>
      <Authenticated>
        {convexUser === undefined ? (
          <AccountCardSkeleton />
        ) : (
          <UserAccountMenu
            accountName={accountName}
            accountEmail={accountEmail}
          />
        )}
      </Authenticated>
    </div>
  );
}
