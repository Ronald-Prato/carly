"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const STEPS = [
  "Empecemos subiendo tu CV",
  "Así podremos personalizar la búsqueda de oportunidades",
] as const;

type CvTabOnboardingProps = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
};

export function CvTabOnboarding({
  open,
  anchorRef,
  onDismiss,
}: CvTabOnboardingProps) {
  const arrowGradId = `carly-wt-arr-${useId().replace(/:/g, "")}`;
  const [step, setStep] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(
    null,
  );

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const card = cardRef.current;
    if (!anchor || !open) {
      setCoords(null);
      return;
    }

    /** Espacio mínimo entre el ítem «Mi CV» y la tarjeta; el triángulo ocupa parte del hueco. */
    const gap = 4;
    const rect = anchor.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const cardH = cardRect.height > 0 ? cardRect.height : 140;
    const cardW = cardRect.width > 0 ? cardRect.width : 288;

    let left = rect.right + gap;
    const centerY = rect.top + rect.height / 2;

    const vw = typeof window !== "undefined" ? window.innerWidth : 400;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    if (left + cardW > vw - 12) {
      left = Math.max(12, vw - cardW - 12);
    }

    let topPx = centerY - cardH / 2;
    if (topPx < 12) topPx = 12;
    if (topPx + cardH > vh - 12) topPx = Math.max(12, vh - 12 - cardH);

    setCoords({ left, top: topPx });
  }, [anchorRef, open]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const tick = () => updatePosition();
    requestAnimationFrame(() => requestAnimationFrame(tick));

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updatePosition())
        : null;
    if (cardRef.current && ro) ro.observe(cardRef.current);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, step, updatePosition]);

  useEffect(() => {
    if (!open) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- reset step when tour closes so a cleared storage key replays from step 1 */
      setStep(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open || typeof document === "undefined") return null;

  const handlePrimary = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      onDismiss();
    }
  };

  const wtButtonClass =
    "border-0 text-white shadow-sm transition hover:brightness-[1.06] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--carly-card-bg)]";

  const portal = (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cv-onboarding-title"
      aria-describedby="cv-onboarding-desc"
      style={
        coords
          ? {
              left: coords.left,
              top: coords.top,
            }
          : { left: -9999, top: -9999, visibility: "hidden" as const }
      }
      className={cn(
        "fixed z-[200] w-[min(calc(100vw-2rem),18rem)]",
        "animate-in fade-in zoom-in-95 slide-in-from-left-2 duration-300",
        coords && "visible",
      )}
    >
      <div className="relative">
        {/* Triángulo hacia el sidebar, mismo gradiente que la franja superior */}
        <svg
          width={12}
          height={24}
          viewBox="0 0 12 24"
          className="pointer-events-none absolute left-0 top-1/2 z-10"
          style={{ transform: "translate(calc(-100% + 1px), -50%)" }}
          aria-hidden
        >
          <defs>
            <linearGradient
              id={arrowGradId}
              x1="100%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="45%" stopColor="#db2777" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>
          {/*
            Triángulo hacia la izquierda con vértices redondeados (radio ~2 en viewBox).
            Curvas cuadráticas con control en cada esquina original.
          */}
          <path
            fill={`url(#${arrowGradId})`}
            d="M 1.414 10.586 Q 0 12 1.414 13.414 L 10.586 22.586 Q 12 24 12 22 L 12 2 Q 12 0 10.586 1.414 L 1.414 10.586 Z"
          />
        </svg>

        <div className="overflow-hidden rounded-lg border border-[var(--carly-border)] bg-[var(--carly-card-bg)] shadow-xl shadow-violet-900/10 ring-1 ring-black/[0.04] dark:shadow-black/40 dark:ring-white/[0.06]">
          <div
            className="pointer-events-none h-1.5 w-full shrink-0"
            style={{ backgroundImage: "var(--carly-gradient)" }}
            aria-hidden
          />

          <div className="px-4 pb-4 pt-3">
            <div className="mb-3 flex items-start gap-2">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 text-white shadow-sm">
                <Sparkles className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  id="cv-onboarding-title"
                  className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400"
                >
                  Primeros pasos
                </p>
                <p
                  id="cv-onboarding-desc"
                  className="mt-1 text-sm font-medium leading-snug text-[var(--carly-text-strong)]"
                >
                  {STEPS[step]}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex gap-1.5" aria-hidden>
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === step
                        ? "w-5 bg-violet-600 dark:bg-violet-400"
                        : "w-1.5 bg-[var(--carly-border)] dark:bg-zinc-600",
                    )}
                  />
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handlePrimary}
                className={cn(wtButtonClass, "gap-1.5")}
                style={{ backgroundImage: "var(--carly-gradient)" }}
              >
                {step < STEPS.length - 1 ? "Siguiente" : "Entendido"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(portal, document.body);
}
