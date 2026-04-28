"use client";

import { Menu } from "@base-ui/react/menu";
import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

type UserAccountMenuProps = {
  collapsed?: boolean;
  /** Nombre mostrado (Clerk + fallback Convex desde el padre). */
  accountName: string | null;
  accountEmail: string | null;
};

function AccountAvatar({
  src,
  name,
  className,
}: {
  src: string | null;
  name: string | null;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- dominio dinámico de Clerk
      <img
        src={src}
        alt=""
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-800",
        className,
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export function UserAccountMenu({
  collapsed,
  accountName,
  accountEmail,
}: UserAccountMenuProps) {
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();
  const imageUrl = user?.imageUrl ?? null;

  const label = accountName ?? "Cuenta";

  if (!isLoaded) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-full bg-[var(--carly-border)]",
          collapsed ? "size-9" : "size-10",
        )}
      />
    );
  }

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        type="button"
        aria-label={`Menú de cuenta: ${label}`}
        className={cn(
          "outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
          collapsed
            ? "flex size-9 items-center justify-center rounded-full ring-2 ring-[var(--carly-border)] transition hover:opacity-90 focus-visible:ring-offset-[var(--carly-sidebar-bg)]"
            : "flex w-full items-start gap-3 rounded-xl bg-[var(--carly-profile-card-bg)] px-3 py-3 text-left transition hover:brightness-[0.99] focus-visible:ring-offset-[var(--carly-profile-card-bg)]",
        )}
      >
        {collapsed ? (
          <AccountAvatar
            src={imageUrl}
            name={accountName}
            className="size-9"
          />
        ) : (
          <>
            <AccountAvatar
              src={imageUrl}
              name={accountName}
              className="size-10 shrink-0"
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-2">
                <span
                  className="min-w-0 truncate text-sm font-semibold text-[var(--carly-text)]"
                  title={accountEmail ?? undefined}
                >
                  {accountName ?? "Sesión activa"}
                </span>
                <span
                  className="size-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-[var(--carly-profile-card-bg)]"
                  title="Conectado"
                  aria-hidden
                />
              </div>
              <p
                className="mt-1 truncate text-xs text-[var(--carly-muted)]"
                title={accountEmail ?? undefined}
              >
                {accountEmail ?? "—"}
              </p>
            </div>
          </>
        )}
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          className="z-[300] outline-none"
          side="top"
          align={collapsed ? "center" : "start"}
          sideOffset={8}
        >
          <Menu.Popup
            className={cn(
              "min-w-[240px] origin-[var(--transform-origin)] rounded-xl border border-[var(--carly-border)] bg-[var(--carly-card-bg)] py-1 text-[var(--carly-text)] shadow-lg outline-none",
              "transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            )}
          >
            <div className="flex gap-3 border-b border-[var(--carly-border)] px-3 py-2.5">
              <AccountAvatar
                src={imageUrl}
                name={accountName}
                className="size-10 shrink-0"
              />
              <div className="min-w-0 py-0.5">
                <p className="truncate text-sm font-semibold text-[var(--carly-text)]">
                  {accountName ?? "Sesión activa"}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--carly-muted)]">
                  {accountEmail ?? "—"}
                </p>
              </div>
            </div>

            <Menu.Item
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-medium outline-none",
                "text-[var(--carly-text)] data-highlighted:bg-[var(--carly-row-hover)]",
              )}
              onClick={() => {
                const home = new URL("/", window.location.href).toString();
                void signOut({ redirectUrl: home });
              }}
            >
              <LogOut className="size-4 shrink-0 opacity-70" strokeWidth={2.25} />
              Cerrar sesión
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
