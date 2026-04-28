"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { CarlyWordmark } from "@/app/components/CarlyWordmark";

export default function OAuthCallbackPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 bg-[var(--carly-page-bg)] px-4 py-16 text-[var(--carly-text)]">
      <div
        className="size-8 animate-spin rounded-full border-2 border-[var(--carly-border)] border-t-violet-600"
        aria-hidden
      />
      <div className="text-center">
        <p className="text-sm text-[var(--carly-muted)]">Completando acceso</p>
        <p className="mt-2 text-lg">
          <CarlyWordmark className="text-2xl" />
        </p>
      </div>
      <AuthenticateWithRedirectCallback />
      <div id="clerk-captcha" />
    </div>
  );
}
