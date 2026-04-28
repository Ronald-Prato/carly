"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

/**
 * Aviso fijo (solo se oculta con «Entendido») cuando el CV está listo y el usuario aún no ha confirmado el mensaje.
 */
export function FirstCvSearchBanner() {
  const [dismissedOptimistic, setDismissedOptimistic] = useState(false);
  const resumeRows = useQuery(api.storage.resume.list, {});
  const profile = useQuery(api.database.profiles.getCurrent, {});
  const acknowledge = useMutation(
    api.database.profiles.dismissFirstCvUploadedToast,
  );

  const primaryResume = resumeRows?.[0];
  const enrichmentReady = primaryResume?.enrichmentStatus === "ready";

  const visible =
    !dismissedOptimistic &&
    resumeRows !== undefined &&
    resumeRows.length > 0 &&
    enrichmentReady &&
    profile !== undefined &&
    profile.hasUploadedFirstCV !== true;

  const onAcknowledge = useCallback(() => {
    setDismissedOptimistic(true);
    void acknowledge().catch(() => {
      setDismissedOptimistic(false);
    });
  }, [acknowledge]);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Tu CV está listo para buscar ofertas"
      className={cn(
        "pointer-events-auto fixed right-4 top-4 z-[210] w-[min(calc(100vw-2rem),25rem)] overflow-hidden rounded-lg border border-[var(--carly-border)] bg-[var(--carly-card-bg)] shadow-xl shadow-violet-900/15 ring-1 ring-black/[0.05] dark:shadow-black/40 dark:ring-white/[0.06]",
        "animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300",
      )}
    >
      <div
        className="pointer-events-none h-1.5 w-full shrink-0"
        style={{ backgroundImage: "var(--carly-gradient)" }}
        aria-hidden
      />

      <div className="p-4">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 text-white shadow-sm">
            <Sparkles className="size-[18px]" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-[var(--carly-text-strong)]">
              Ya puedes buscar oportunidades en Carly
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--carly-muted)]">
              Haremos una búsqueda personalizada de ofertas según tu perfil
            </p>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onAcknowledge}
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
              "hover:brightness-[1.06] active:brightness-95",
            )}
            style={{ backgroundImage: "var(--carly-gradient)" }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
