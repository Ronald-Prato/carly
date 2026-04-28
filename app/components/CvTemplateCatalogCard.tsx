"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CvTemplateDefinition, CvWireframeKind } from "@/lib/cvTemplates";
import { cn } from "@/lib/utils";
import { Eye, Loader2 } from "lucide-react";

/** Carta legal US 8,5 × 14 in a 96 dpi de referencia (ratio “oficio”). */
const PREVIEW_DOC_WIDTH = 816;
const PREVIEW_DOC_HEIGHT = 1344;

function CvTemplateWireframePreview({ kind }: { kind: CvWireframeKind }) {
  const base =
    "relative flex h-full w-full flex-col overflow-hidden rounded-md bg-white";

  switch (kind) {
    case "minimal":
      return (
        <div className={cn(base, "px-5 pt-8 pb-6")}>
          <div className="mx-auto h-2 w-[42%] rounded-full bg-neutral-200" />
          <div className="mx-auto mt-3 h-1.5 w-[58%] rounded-full bg-neutral-100" />
          <div className="mt-10 flex flex-col gap-2 px-1">
            {[92, 88, 72, 80, 65].map((w) => (
              <div
                key={w}
                className="h-1 rounded-full bg-neutral-100"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
          <div className="mt-auto flex gap-2 pt-6">
            <div className="h-16 flex-1 rounded-md bg-neutral-50" />
            <div className="h-16 flex-1 rounded-md bg-neutral-50" />
          </div>
        </div>
      );
    case "creative":
      return (
        <div
          className={cn(
            base,
            "bg-gradient-to-br from-pink-50 via-orange-50 to-amber-50",
          )}
        >
          <div className="absolute -right-6 -top-8 size-28 rounded-full bg-pink-300/40 blur-2xl" />
          <div className="absolute -bottom-4 -left-4 size-24 rounded-full bg-orange-300/35 blur-2xl" />
          <div className="relative z-[1] m-3 flex-1 rounded-lg bg-white/90 p-3 shadow-sm backdrop-blur-[2px]">
            <div className="h-2 w-1/3 rounded bg-pink-200/80" />
            <div className="mt-3 h-1 w-1/2 rounded bg-neutral-100" />
            <div className="mt-5 space-y-1.5">
              {[70, 85, 60].map((w) => (
                <div
                  key={w}
                  className="h-1 rounded bg-neutral-100"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      );
    case "timeline":
      return (
        <div className={cn(base, "px-4 py-6")}>
          <div className="mb-4 h-2 w-2/5 rounded bg-neutral-200" />
          <div className="relative flex flex-1 flex-col gap-3 pl-5">
            <div className="absolute bottom-3 left-[18px] top-10 w-px bg-violet-200" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="relative z-[1] flex flex-col gap-1.5">
                <div className="absolute -left-[11px] top-0.5 size-2 rounded-full border-2 border-violet-400 bg-white" />
                <div className="h-1 w-full rounded bg-neutral-100" />
                <div className="h-1 w-[85%] rounded bg-neutral-50" />
              </div>
            ))}
          </div>
        </div>
      );
    case "functional":
      return (
        <div className={cn(base, "bg-white")}>
          <div className="h-[18%] w-full bg-emerald-800/90" />
          <div className="flex flex-1 flex-col gap-2 px-4 py-4">
            <div className="h-1.5 w-1/3 rounded bg-neutral-200" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="h-10 rounded-md bg-emerald-50" />
              <div className="h-10 rounded-md bg-emerald-50/70" />
              <div className="h-10 rounded-md bg-emerald-50/50" />
              <div className="h-10 rounded-md bg-emerald-50/30" />
            </div>
            <div className="mt-2 space-y-1">
              <div className="h-1 w-full rounded bg-neutral-100" />
              <div className="h-1 w-[92%] rounded bg-neutral-50" />
            </div>
          </div>
        </div>
      );
    case "academic":
      return (
        <div className={cn(base, "bg-white px-4 pt-7 pb-5")}>
          <div className="h-2 w-3/5 rounded bg-slate-800/85" />
          <div className="mt-4 h-px w-full bg-slate-200" />
          <div className="mt-4 text-[9px] font-serif leading-relaxed text-neutral-400">
            <div className="h-1 w-full rounded bg-neutral-100" />
            <div className="mt-1.5 h-1 w-full rounded bg-neutral-50" />
            <div className="mt-1.5 h-1 w-[92%] rounded bg-neutral-50" />
          </div>
          <div className="mt-5 border border-neutral-100 bg-neutral-50/60 p-2">
            <div className="h-1 w-2/3 rounded bg-neutral-200" />
            <div className="mt-2 h-1 w-full rounded bg-neutral-100" />
          </div>
        </div>
      );
    case "tech":
      return (
        <div className={cn(base, "flex-row bg-neutral-950")}>
          <div className="flex w-[26%] flex-col gap-2 border-r border-neutral-800 p-2.5">
            <div className="h-1.5 w-full rounded bg-emerald-500/40" />
            <div className="h-1 w-4/5 rounded bg-neutral-700" />
            <div className="h-1 w-full rounded bg-neutral-700" />
            <div className="mt-auto h-6 w-full rounded bg-neutral-800" />
          </div>
          <div className="flex flex-1 flex-col gap-1.5 bg-neutral-900/40 p-3">
            <div className="font-mono text-[8px] text-emerald-400/90">&#123; &#125;</div>
            <div className="h-1 w-full rounded bg-neutral-700/80" />
            <div className="h-1 w-[88%] rounded bg-neutral-700/50" />
            <div className="mt-2 h-12 w-full rounded border border-neutral-700/60 bg-neutral-800/40" />
          </div>
        </div>
      );
    case "executive":
      return (
        <div className={cn(base, "bg-white")}>
          <div className="h-[14%] w-full bg-neutral-900" />
          <div className="mx-4 -mt-2 h-0.5 w-12 rounded-full bg-amber-400/90" />
          <div className="flex flex-1 flex-col gap-3 px-4 pt-5 pb-4">
            <div className="flex justify-between gap-2">
              <div className="h-2 w-2/5 rounded bg-neutral-200" />
              <div className="h-2 w-16 rounded bg-amber-100" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="h-14 rounded-md border border-neutral-100 bg-neutral-50" />
              <div className="h-14 rounded-md border border-neutral-100 bg-neutral-50" />
              <div className="h-14 rounded-md border border-neutral-100 bg-neutral-50" />
            </div>
            <div className="h-1 w-full rounded bg-neutral-100" />
            <div className="h-1 w-[70%] rounded bg-neutral-50" />
          </div>
        </div>
      );
    default:
      return <div className={cn(base, "bg-neutral-50")} />;
  }
}

type CvTemplateCatalogCardProps = {
  template: CvTemplateDefinition;
  srcDoc: string | null;
  /** Abre la vista previa modal con datos de ejemplo. */
  onPreview: () => void;
  /** Abre el editor visual con esta plantilla y los datos del CV. */
  onUse: () => void;
  /** Hay datos reales del CV disponibles para abrir el editor. */
  canUse: boolean;
};

export function CvTemplateCatalogCard({
  template,
  srcDoc,
  onPreview,
  onUse,
  canUse,
}: CvTemplateCatalogCardProps) {
  const live = Boolean(srcDoc);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (!live) return;
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / PREVIEW_DOC_WIDTH);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [live]);

  return (
    <article
      className={cn(
        "group/card flex flex-col rounded-2xl border border-neutral-200/90 bg-white p-3.5 shadow-sm transition",
        "dark:border-neutral-800 dark:bg-neutral-950",
        live && "hover:border-violet-200/80 hover:shadow-md dark:hover:border-violet-900/40",
      )}
    >
      <div
        className={cn(
          "relative rounded-xl bg-neutral-100/95 p-2 dark:bg-neutral-900/80",
          "ring-1 ring-inset ring-neutral-200/60 dark:ring-neutral-800",
        )}
      >
        {live ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            aria-label={`Vista previa de ${template.name}`}
            title="Vista previa"
            className={cn(
              "absolute right-3 top-3 z-[2] inline-flex size-8 items-center justify-center rounded-full",
              "border border-neutral-200/80 bg-white/95 text-neutral-700 shadow-sm backdrop-blur",
              "opacity-0 transition group-hover/card:opacity-100 focus-visible:opacity-100",
              "hover:bg-white hover:text-violet-600",
              "dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-200 dark:hover:text-violet-300",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
            )}
          >
            <Eye className="size-4" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        {/*
          Recorte literal: el template sigue en ratio carta completo 8.5×14; solo se muestra
          la mitad superior (padding-bottom = mitad de 14/8.5 en función del ancho).
        */}
        <div
          className={cn(
            "relative h-0 w-full overflow-hidden rounded-lg bg-white pb-[calc(100%*7/8.5)]",
            "shadow-[0_6px_20px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.35)]",
          )}
        >
          <div className="absolute left-0 top-0 w-full">
            <div ref={wrapRef} className="relative aspect-[8.5/14] w-full">
              {live ? (
                !srcDoc ? (
                  <div className="flex h-full min-h-[140px] items-center justify-center bg-neutral-50 dark:bg-neutral-900/50">
                    <Loader2
                      className="size-7 shrink-0 animate-spin text-violet-500"
                      aria-hidden
                    />
                  </div>
                ) : (
                  <iframe
                    title=""
                    aria-hidden
                    sandbox=""
                    className="pointer-events-none absolute left-0 top-0 border-0"
                    style={{
                      width: PREVIEW_DOC_WIDTH,
                      height: PREVIEW_DOC_HEIGHT,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                    }}
                    srcDoc={srcDoc}
                  />
                )
              ) : template.wireframe ? (
                <CvTemplateWireframePreview kind={template.wireframe} />
              ) : (
                <div className="flex h-full items-center justify-center bg-neutral-50 text-xs text-neutral-400">
                  Próximamente
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <h3 className="mt-3.5 text-[15px] font-bold leading-tight tracking-tight text-neutral-900 dark:text-neutral-50">
        {template.name}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        {template.description}
      </p>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUse();
          }}
          disabled={!live || !canUse}
          className={cn(
            "inline-flex h-9 min-w-[6.5rem] items-center justify-center gap-2 rounded-[10px] px-3 text-xs font-semibold transition",
            "bg-violet-600 text-white hover:bg-violet-500",
            "dark:bg-violet-600 dark:hover:bg-violet-500",
            "disabled:pointer-events-none disabled:opacity-50",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
          )}
        >
          <span>Usar plantilla</span>
        </button>
      </div>
    </article>
  );
}
