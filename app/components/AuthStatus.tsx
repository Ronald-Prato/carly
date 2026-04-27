"use client";

import { UserButton } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import Link from "next/link";
import { AccountCardSkeleton } from "./loading-skeletons";

export function AuthStatus() {
  const convexUser = useQuery(api.database.users.getCurrent);

  return (
    <div className="space-y-3">
      <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--carly-label)]">
        Cuenta
      </p>
      <Unauthenticated>
        <Link
          href="/sign-in"
          className="flex w-full items-center justify-center rounded-[10px] border border-[var(--carly-border)] bg-[var(--carly-icon-bg)] px-3 py-2.5 text-sm font-medium text-[var(--carly-text)] transition hover:bg-[var(--carly-row-hover)]"
        >
          Iniciar sesión
        </Link>
        <p className="px-1 text-xs leading-relaxed text-[var(--carly-muted)]">
          Usa GitHub o LinkedIn cuando los actives en Clerk.
        </p>
      </Unauthenticated>
      <Authenticated>
        {convexUser === undefined ? (
          <AccountCardSkeleton />
        ) : (
          <div className="flex flex-col gap-3 rounded-[10px] border border-[var(--carly-border)] bg-[var(--carly-icon-bg)] px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-[var(--carly-text)]">
                {convexUser?.name ?? convexUser?.email ?? "Sesión activa"}
              </span>
              <UserButton />
            </div>
            {convexUser?.email ? (
              <p className="truncate text-xs text-[var(--carly-muted)]">
                {convexUser.email}
              </p>
            ) : null}
            <p className="text-[10px] uppercase tracking-wide text-[var(--carly-label)]">
              Guardado en Convex
            </p>
          </div>
        )}
      </Authenticated>
    </div>
  );
}
