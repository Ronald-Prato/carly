"use client";

import {
  Bookmark,
  BriefcaseBusiness,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  Lightbulb,
  MapPin,
  Monitor,
  Sparkles,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ComponentType } from "react";
import type { EnrichedJobCard } from "@/lib/jobs/enrichedJobCard";
import { cn } from "@/lib/utils";
import { PointerTooltipPortal } from "./PointerTooltip";

function formatLinkedInEpoch(value: number | null): string | null {
  if (value == null) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function boolText(value: boolean | null): string | null {
  if (value == null) {
    return null;
  }
  return value ? "Sí" : "No";
}

const STAT_ROW_TOOLTIPS = {
  location:
    "Zona geográfica o ámbito de la oferta (región o país comunicado por LinkedIn).",
  workplace:
    "Modalidad laboral según LinkedIn (por ejemplo presencial, híbrida o en remoto).",
  employment:
    "Tipo de contrato o jornada (por ejemplo jornada completa, parcial o temporal).",
  created:
    "Fecha en que LinkedIn registra que se creó o publicó el anuncio de la oferta.",
  easyApply:
    "Si LinkedIn ofrece un envío rápido de candidatura (tipo «Solicitud sencilla» / Easy Apply) desde la misma página.",
} as const;

function StatPill({
  icon: Icon,
  label,
  value,
  tooltip,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  tooltip: string;
  className?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  if (!value) {
    return null;
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}. ${tooltip}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={cn(
          "inline-flex shrink-0 cursor-help rounded-sm border-transparent bg-transparent p-0 text-blue-600 transition-colors",
          "hover:text-blue-700 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/55",
          "dark:text-blue-400 dark:hover:text-blue-300",
        )}
      >
        <Icon className="pointer-events-none size-5" aria-hidden />
      </button>
      <PointerTooltipPortal text={tooltip} open={open} anchorRef={triggerRef} />
      <span className="truncate text-sm text-[var(--carly-muted)]">
        {value}
      </span>
    </div>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  subtitle,
  tone = "blue",
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  tone?: "blue" | "yellow";
}) {
  const isYellow = tone === "yellow";
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-3",
        isYellow
          ? "bg-amber-50/90 dark:bg-amber-950/25"
          : "bg-blue-50/80 dark:bg-blue-950/25",
      ].join(" ")}
    >
      <span
        className={[
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          isYellow
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/45 dark:text-amber-300"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900/45 dark:text-blue-300",
        ].join(" ")}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--carly-text)]">
          {title}
        </p>
        <p className="mt-1 text-xs text-[var(--carly-muted)]">{subtitle}</p>
      </div>
    </div>
  );
}

export type JobOfferCardProps = {
  job: EnrichedJobCard;
  saved?: boolean;
  saveBusy?: boolean;
  onSaveToggle?: () => void | Promise<void>;
};

export function JobOfferCard({
  job,
  saved = false,
  saveBusy = false,
  onSaveToggle,
}: JobOfferCardProps) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [saveTooltipOpen, setSaveTooltipOpen] = useState(false);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const matchPoints =
    job.matchingCriteria?.map((s) => s.trim()).filter((s) => s.length > 0) ??
    [];
  const detail = job.detail;
  const description = job.description?.description;
  const avatarUrl = detail?.logo_url ?? job.logoUrl ?? null;
  const title =
    detail?.title ?? job.description?.title ?? job.title ?? "Sin título";
  const company = detail?.company ?? job.company ?? "Empresa no disponible";
  const location =
    detail?.location ?? job.description?.location ?? job.location;
  const workplace = detail?.workplace_type ?? job.insights[0] ?? null;
  const employment =
    detail?.employment_status ?? job.description?.employmentStatus ?? null;
  const listed = detail?.posted_at_text ?? job.listedText ?? null;
  const linkedInJobUrl =
    job.url?.trim() ??
    (job.id && /^\d+$/.test(job.id)
      ? `https://www.linkedin.com/jobs/view/${job.id}/`
      : null);
  const applyClicks =
    detail?.apply_clicks_count != null
      ? `${detail.apply_clicks_count.toLocaleString("es")} personas`
      : (detail?.apply_clicks_text
          ?.replace(/han hecho clic en «Solicitar»/i, "")
          .trim() ?? null);
  const createdAtText = formatLinkedInEpoch(detail?.created_at ?? null);
  const simpleApplyText = boolText(detail?.onsite_apply ?? null);

  const canSave = Boolean(job.id?.trim()) && Boolean(onSaveToggle);
  const saveTooltipLabel = saved ? "Quitar de guardados" : "Guardar oferta";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-950 sm:px-5 sm:py-5">
      {matchPoints.length > 0 ? (
        <div className="mb-4 rounded-xl border border-violet-200/90 bg-violet-50/90 px-3 py-3 dark:border-violet-800/70 dark:bg-violet-950/35">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">
            Por qué encaja con tu perfil:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-violet-950/95 marker:text-violet-600 dark:text-violet-100/95 dark:marker:text-violet-400">
            {matchPoints.map((point, i) => (
              <li key={`${point.slice(0, 48)}-${i}`}>{point}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex items-start gap-3 sm:gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logos externos sin optimización garantizada
          <img
            src={avatarUrl}
            alt=""
            className="size-12 shrink-0 rounded-xl border border-slate-100 bg-white object-contain p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:size-16"
            width={64}
            height={64}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-base font-semibold leading-snug text-slate-950 dark:text-zinc-50 sm:text-xl">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-zinc-300 sm:text-base">
            {company}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onSaveToggle ? (
            <>
              <button
                ref={saveBtnRef}
                type="button"
                aria-label={saveTooltipLabel}
                aria-pressed={saved}
                disabled={!canSave || saveBusy}
                onMouseEnter={() => setSaveTooltipOpen(true)}
                onMouseLeave={() => setSaveTooltipOpen(false)}
                onFocus={() => setSaveTooltipOpen(true)}
                onBlur={() => setSaveTooltipOpen(false)}
                onClick={() => void onSaveToggle()}
                className={cn(
                  "inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border shadow-sm transition",
                  saved
                    ? "border-blue-400/80 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950/80"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
                  (!canSave || saveBusy) && "pointer-events-none opacity-50",
                )}
              >
                <Bookmark
                  className={cn(
                    "size-[18px] shrink-0",
                    saved && "fill-current",
                  )}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
              <PointerTooltipPortal
                text={saveTooltipLabel}
                open={saveTooltipOpen}
                anchorRef={saveBtnRef}
              />
            </>
          ) : null}
          {linkedInJobUrl ? (
            <a
              href={linkedInJobUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ver oferta en LinkedIn (se abre en otra pestaña)"
              className="inline-flex h-10 w-fit shrink-0 items-center gap-2 rounded-[10px] bg-blue-600 px-4 text-xs font-semibold leading-none text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <ExternalLink
                className="size-4 shrink-0 opacity-95"
                aria-hidden
              />
              Ver oferta
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-col border-b border-slate-200 pb-4 dark:border-zinc-800 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-3">
        <StatPill
          icon={MapPin}
          label="Ubicación"
          value={location}
          tooltip={STAT_ROW_TOOLTIPS.location}
          className="border-b border-slate-200 py-3 dark:border-zinc-800 sm:border-0 sm:py-0"
        />
        <StatPill
          icon={Monitor}
          label="Modalidad"
          value={workplace}
          tooltip={STAT_ROW_TOOLTIPS.workplace}
          className="border-b border-slate-200 py-3 dark:border-zinc-800 sm:border-0 sm:py-0"
        />
        <StatPill
          icon={BriefcaseBusiness}
          label="Tipo de empleo"
          value={employment}
          tooltip={STAT_ROW_TOOLTIPS.employment}
          className="border-b border-slate-200 py-3 dark:border-zinc-800 sm:border-0 sm:py-0"
        />
        <StatPill
          icon={Calendar}
          label="Creada"
          value={createdAtText}
          tooltip={STAT_ROW_TOOLTIPS.created}
          className="border-b border-slate-200 py-3 dark:border-zinc-800 sm:border-0 sm:py-0"
        />
        <StatPill
          icon={Sparkles}
          label="Solicitud sencilla"
          value={simpleApplyText}
          tooltip={STAT_ROW_TOOLTIPS.easyApply}
          className="border-b border-slate-200 py-3 dark:border-zinc-800 sm:border-0 sm:py-0"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-blue-50/70 px-3 py-3 dark:bg-blue-950/20">
        <InfoPanel
          icon={Users}
          title={applyClicks ?? "Sin dato de clics"}
          subtitle="han hecho clic en «Solicitar»"
        />
        <InfoPanel
          icon={Clock3}
          title={
            listed ??
            formatLinkedInEpoch(detail?.posted_at_epoch ?? null) ??
            "Sin fecha"
          }
          subtitle="Publicado"
        />
      </div>

      {detail?.application_note || detail?.applicant_tracking_system ? (
        <div className="mt-4 flex gap-2.5 border-t border-slate-200 pt-4 dark:border-zinc-800">
          <Lightbulb
            className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400"
            aria-hidden
            strokeWidth={2}
          />
          <p className="min-w-0 text-sm leading-relaxed text-blue-600 dark:text-blue-400">
            {detail?.application_note ??
              `Respuestas gestionadas por ${detail?.applicant_tracking_system}`}
          </p>
        </div>
      ) : null}

      <div className="mt-4 border-t border-slate-200 pt-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium uppercase text-slate-500 dark:text-zinc-400">
            Descripción
          </p>
          {description ? (
            <button
              type="button"
              onClick={() => setDescriptionOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {descriptionOpen ? "Ver menos" : "Ver completa"}
              {descriptionOpen ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>
          ) : null}
        </div>
        {description ? (
          <div
            className={[
              "relative mt-3 overflow-hidden rounded-lg bg-slate-50 px-4 py-4 dark:bg-zinc-900/75",
              descriptionOpen ? "max-h-none" : "max-h-24",
            ].join(" ")}
          >
            <pre className="whitespace-pre-wrap font-sans text-base leading-7 text-slate-700 dark:text-zinc-300">
              {description}
            </pre>
            {!descriptionOpen ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-50 to-transparent dark:from-zinc-900" />
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            {job.descriptionError ??
              "La respuesta del detalle no incluyó texto de descripción."}
          </p>
        )}
      </div>

      {job.detailError ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
          No se pudo cargar todo el resumen de LinkedIn: {job.detailError}
        </p>
      ) : null}
    </article>
  );
}
