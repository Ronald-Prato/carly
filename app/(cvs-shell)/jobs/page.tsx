"use client";

import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel";
import { JobOfferCard } from "@/app/components/JobOfferCard";
import { useJobsSearchSession } from "../JobsSearchSession";
import { useAction, useMutation, useQuery } from "convex/react";
import type { EnrichedJobCard } from "@/lib/jobs/enrichedJobCard";
import { api } from "@/convex/_generated/api";
import {
  JOB_SEARCH_COUNTRY_OPTIONS,
  type JobSearchCountryCode,
} from "@/lib/linkedin/jobSearchOptions";
import { cn } from "@/lib/utils";
import { useCvUploadGate } from "@/lib/hooks/useCvUploadGate";

const MATCH_WIZARD_STEPS = [
  "Explorando oportunidades para ti",
  "Analizando tu perfil",
  "Buscando coincidencias",
] as const;

/** Delay aleatorio inclusivo entre 1 y 3 segundos (pasos simulados 1–2). */
function randomWizardStepMs(): number {
  return 1000 + Math.floor(Math.random() * 2001);
}

function MatchJobsWizardPanel({ phase }: { phase: 1 | 2 | 3 }) {
  return (
    <section
      className="w-full rounded-2xl border border-[var(--carly-border)] bg-[var(--carly-card-bg)] px-7 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-black/35"
      aria-labelledby="jobs-wizard-heading"
      aria-busy="true"
    >
      <p id="jobs-wizard-heading" className="sr-only">
        Progreso de búsqueda de ofertas
      </p>
      <div className="flex flex-col gap-6">
        {MATCH_WIZARD_STEPS.map((label, index) => {
          const stepNum = (index + 1) as 1 | 2 | 3;
          if (phase < stepNum) {
            return null;
          }
          const done = phase > stepNum;
          const active = phase === stepNum;
          return (
            <div
              key={stepNum}
              className={cn(
                "animate-carly-step-line flex items-center gap-3.5",
                done && "opacity-[0.72]",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border shadow-sm",
                  done
                    ? "border-emerald-500/35 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/50"
                    : "border-[var(--carly-border)] bg-[var(--carly-page-bg)] dark:border-zinc-600 dark:bg-zinc-950",
                )}
                aria-hidden
              >
                {done ? (
                  <Check
                    className="size-[18px] text-emerald-600 dark:text-emerald-400"
                    strokeWidth={2.5}
                  />
                ) : active ? (
                  <Loader2 className="size-[18px] animate-spin text-violet-600 dark:text-violet-400" />
                ) : null}
              </span>
              <p
                className={cn(
                  "text-[15px] font-semibold leading-snug tracking-tight text-[var(--carly-text)]",
                  active && "animate-carly-wizard-active-text",
                )}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function JobsCarouselStickyNav({ side }: { side: "prev" | "next" }) {
  const { scrollPrev, scrollNext, canScrollPrev, canScrollNext } =
    useCarousel();
  const isPrev = side === "prev";

  return (
    <div className="sticky top-[clamp(5rem,min(42dvh,calc(50dvh-2.25rem)),28rem)] z-30 shrink-0 self-start py-1">
      <Button
        type="button"
        variant="ghost"
        disabled={isPrev ? !canScrollPrev : !canScrollNext}
        onClick={isPrev ? scrollPrev : scrollNext}
        aria-label={isPrev ? "Oferta anterior" : "Siguiente oferta"}
        className={cn(
          "size-11 rounded-full border border-neutral-700/90 bg-neutral-950 text-white shadow-lg outline-none hover:bg-neutral-800 hover:text-white focus-visible:ring-2 focus-visible:ring-violet-500/45 dark:border-zinc-400/70 dark:bg-zinc-100 dark:text-neutral-950 dark:hover:bg-white dark:hover:text-neutral-950",
          "touch-manipulation disabled:pointer-events-none disabled:opacity-40",
        )}
      >
        {isPrev ? (
          <ChevronLeft className="size-4" aria-hidden strokeWidth={2.25} />
        ) : (
          <ChevronRight className="size-4" aria-hidden strokeWidth={2.25} />
        )}
      </Button>
    </div>
  );
}

function JobsSlideshow({
  jobs,
  savedPostingIds,
  saveBusyId,
  onToggleSave,
  onBack,
}: {
  jobs: EnrichedJobCard[];
  savedPostingIds: string[] | undefined;
  saveBusyId: string | null;
  onToggleSave: (job: EnrichedJobCard) => void | Promise<void>;
  onBack: () => void;
}) {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(1);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!api) return;
    const sync = () => {
      setCurrent(api.selectedScrollSnap() + 1);
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };
    sync();
    api.on("reInit", sync);
    api.on("select", sync);
    return () => {
      api.off("reInit", sync);
      api.off("select", sync);
    };
  }, [api]);

  const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = useCallback(() => api?.scrollNext(), [api]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-0">
      <div className="sticky top-0 z-20 flex w-full shrink-0 items-center justify-between border-b border-slate-200/70 bg-slate-100/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800/70 dark:bg-[#050506]/90 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200/80 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45 dark:text-zinc-300 dark:hover:bg-zinc-800/90 dark:hover:text-zinc-50"
        >
          <ChevronLeft
            className="size-[18px] shrink-0"
            strokeWidth={2.25}
            aria-hidden
          />
          Volver
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            aria-label="Oferta anterior"
            className="inline-flex size-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-200/80 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
          >
            <ChevronLeft className="size-4" aria-hidden strokeWidth={2.25} />
          </button>
          <span
            className="px-1 text-sm tabular-nums text-[var(--carly-muted)]"
            aria-live="polite"
          >
            {current} / {jobs.length}
          </span>
          <button
            type="button"
            onClick={scrollNext}
            disabled={!canScrollNext}
            aria-label="Siguiente oferta"
            className="inline-flex size-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-200/80 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
          >
            <ChevronRight className="size-4" aria-hidden strokeWidth={2.25} />
          </button>
        </div>
      </div>
      <Carousel
        setApi={setApi}
        opts={{
          align: "center",
          containScroll: "trimSnaps",
          loop: false,
          watchDrag: true,
        }}
        className="relative flex w-full flex-col pb-8"
      >
        <div className="flex w-full items-start gap-3 px-3 sm:gap-8 sm:px-10 lg:gap-10 lg:px-14">
          <div className="hidden sm:block">
            <JobsCarouselStickyNav side="prev" />
          </div>
          <CarouselContent
            className="-ml-0 min-w-0 flex-1"
            viewportClassName="px-1 py-6 sm:px-4 sm:py-10 lg:px-6 lg:py-12"
          >
            {jobs.map((job, i) => {
              const pid = job.id?.trim() ?? "";
              const saved = Boolean(pid && savedPostingIds?.includes(pid));
              return (
                <CarouselItem
                  key={job.id ? `${job.id}-${i}` : `row-${i}`}
                  className="pl-0"
                >
                  <div className="mx-auto flex w-full max-w-3xl justify-center">
                    <JobOfferCard
                      job={job}
                      saved={saved}
                      saveBusy={saveBusyId === pid}
                      onSaveToggle={() => void onToggleSave(job)}
                    />
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <div className="hidden sm:block">
            <JobsCarouselStickyNav side="next" />
          </div>
        </div>
      </Carousel>
    </div>
  );
}

export default function JobsPage() {
  const { accessAllowed } = useCvUploadGate();
  const matchJobsWithCvAction = useAction(
    api.jobs.matchJobsWithCv.matchJobsWithCv,
  );
  const linkedInSessionPreview = useQuery(
    api.database.sessions.getCurrentForViewer,
    {},
  );
  const savedPostingIds = useQuery(api.savedJobOffers.postingIds, {});
  const saveOffer = useMutation(api.savedJobOffers.save);
  const removeOffer = useMutation(api.savedJobOffers.remove);
  const [saveBusyId, setSaveBusyId] = useState<string | null>(null);

  const {
    keywords,
    setKeywords,
    country,
    setCountry,
    jobs,
    setJobs,
    error,
    setError,
    loading,
    setLoading,
    wizardPhase,
    setWizardPhase,
    resultsRevealKey,
    setResultsRevealKey,
    offersUnlocked,
    setOffersUnlocked,
  } = useJobsSearchSession();

  useEffect(() => {
    if (linkedInSessionPreview === undefined) {
      return;
    }
    if (linkedInSessionPreview === null) {
      console.log(
        "[/jobs] Sesión LinkedIn en Convex: no hay fila con current: true (o sin sesión en la app).",
      );
      return;
    }
    console.log("[/jobs] Sesión LinkedIn cargada desde Convex (la usa el backend):", {
      li_at: linkedInSessionPreview.liAt,
      JSESSIONID: linkedInSessionPreview.jsessionId,
    });
  }, [linkedInSessionPreview]);

  const handleToggleSave = useCallback(
    async (job: EnrichedJobCard) => {
      const id = job.id?.trim();
      if (!id) {
        return;
      }
      setSaveBusyId(id);
      try {
        if (savedPostingIds?.includes(id)) {
          await removeOffer({ linkedInPostingId: id });
        } else {
          await saveOffer({ card: job });
        }
      } finally {
        setSaveBusyId(null);
      }
    },
    [savedPostingIds, removeOffer, saveOffer],
  );

  const onSearch = useCallback(async () => {
    setError(null);
    setJobs(null);
    setOffersUnlocked(false);
    setLoading(true);
    setWizardPhase(1);

    const queryPromise = matchJobsWithCvAction({
      keywords: keywords.trim(),
      country,
      limit: 50,
    });

    const animationPromise = new Promise<void>((resolve) => {
      const delay1 = randomWizardStepMs();
      setTimeout(() => {
        setWizardPhase(2);
        setTimeout(() => {
          setWizardPhase(3);
          resolve();
        }, randomWizardStepMs());
      }, delay1);
    });

    try {
      const [queryOutcome] = await Promise.allSettled([
        queryPromise,
        animationPromise,
      ]);

      if (queryOutcome.status === "rejected") {
        setJobs(null);
        setError(
          queryOutcome.reason instanceof Error
            ? queryOutcome.reason.message
            : "Error de red",
        );
        return;
      }

      const result = queryOutcome.value;
      if (!result.ok) {
        setJobs(null);
        setError(result.error);
        return;
      }

      setJobs(result.jobs);
    } finally {
      setLoading(false);
      setWizardPhase(null);
    }
  }, [keywords, country, matchJobsWithCvAction]);

  const hasMatchesFound = jobs !== null && jobs.length > 0;
  const showOffersGate = hasMatchesFound && !offersUnlocked;
  const showJobCarousel = hasMatchesFound && offersUnlocked;
  const showWizardOverlay = loading && wizardPhase !== null;
  const showNoMatchesGate = jobs !== null && jobs.length === 0 && !loading;

  if (!accessAllowed) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 py-16">
        <p className="text-sm text-[var(--carly-muted)]">Cargando…</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col",
        hasMatchesFound || showNoMatchesGate
          ? "bg-slate-100/95 dark:bg-[#050506]"
          : "px-4 py-8 sm:px-6",
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          !(hasMatchesFound || showNoMatchesGate) && "items-center",
        )}
      >
        <div
          className={cn(
            "flex min-h-0 flex-col gap-6",
            showJobCarousel
              ? "flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain"
              : showOffersGate
                ? "w-full flex-1 items-center justify-center"
                : showNoMatchesGate
                  ? "w-full flex-1 items-center justify-center"
                  : showWizardOverlay && wizardPhase
                    ? "w-full flex-1 items-center justify-center"
                    : "w-full max-w-5xl items-stretch",
          )}
        >
          {jobs === null ? (
            showWizardOverlay && wizardPhase ? (
              <div className="flex min-h-[min(520px,calc(100dvh-11rem))] w-full flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">
                <div className="animate-carly-wizard-shell-in w-full max-w-[min(420px,calc(100%-2rem))]">
                  <MatchJobsWizardPanel phase={wizardPhase} />
                </div>
              </div>
            ) : (
              <section className="flex w-full max-w-4xl flex-col">
                <header className="flex flex-col items-center text-center">
                  <div
                    className="mb-5 flex size-[4.5rem] items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800"
                    aria-hidden
                  >
                    <Search
                      className="size-[1.85rem] text-slate-400 dark:text-zinc-500"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h1 className="text-[1.65rem] font-semibold tracking-tight text-[var(--carly-text)] sm:text-3xl">
                    Buscar ofertas con IA
                  </h1>
                  <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-[var(--carly-muted)]">
                    Encuentra oportunidades que se ajusten a tu perfil.
                  </p>
                </header>

                <div className="mt-10 rounded-2xl border border-slate-200/95 bg-[var(--carly-card-bg)] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-zinc-700/90 dark:bg-zinc-900/85 sm:p-8">
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start md:gap-0">
                    <div className="flex flex-col border-b border-slate-200 pb-8 md:border-r md:border-b-0 md:pb-0 md:pr-8 dark:border-zinc-700">
                      <label
                        htmlFor="job-keywords"
                        className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-400"
                      >
                        Puesto o palabras clave
                      </label>
                      <div className="relative mt-3">
                        <Briefcase
                          className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                          aria-hidden
                          strokeWidth={2}
                        />
                        <input
                          id="job-keywords"
                          type="text"
                          value={keywords}
                          onChange={(e) => setKeywords(e.target.value)}
                          placeholder="Ej.: react, datos, producto…"
                          autoComplete="off"
                          className="w-full rounded-xl border border-slate-200 bg-[var(--carly-page-bg)] py-3 pr-11 pl-11 text-[15px] text-[var(--carly-text)] placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-600 dark:placeholder:text-zinc-500"
                        />
                        {keywords.trim().length > 0 ? (
                          <button
                            type="button"
                            aria-label="Borrar palabras clave"
                            onClick={() => setKeywords("")}
                            className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          >
                            <X className="size-4" strokeWidth={2} />
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-[var(--carly-muted)]">
                        Ej: frontend developer, abogado junior, analista,
                        administración…
                      </p>
                    </div>

                    <div className="flex flex-col md:pl-8">
                      <label
                        htmlFor="job-country"
                        className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-400"
                      >
                        País
                      </label>
                      <div className="relative mt-3">
                        <Globe
                          className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                          aria-hidden
                          strokeWidth={2}
                        />
                        <select
                          id="job-country"
                          value={country}
                          onChange={(e) =>
                            setCountry(e.target.value as JobSearchCountryCode)
                          }
                          className="w-full appearance-none rounded-xl border border-slate-200 bg-[var(--carly-page-bg)] py-3 pr-11 pl-11 text-[15px] text-[var(--carly-text)] focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-600"
                        >
                          {JOB_SEARCH_COUNTRY_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                          aria-hidden
                          strokeWidth={2}
                        />
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-[var(--carly-muted)]">
                        Selecciona el país donde quieres buscar.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex w-full justify-end">
                  <button
                    type="button"
                    onClick={() => void onSearch()}
                    disabled={loading}
                    className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-xl bg-violet-950 px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--carly-page-bg)] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-violet-800 dark:hover:bg-violet-700 dark:focus-visible:ring-offset-zinc-950"
                  >
                    <Search
                      className="size-[18px] shrink-0 opacity-95"
                      aria-hidden
                      strokeWidth={2.25}
                    />
                    Buscar empleos
                  </button>
                </div>
              </section>
            )
          ) : null}

          {error ? (
            <p className="w-full text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          {showNoMatchesGate ? (
            <div className="animate-carly-enter-up flex w-full max-w-lg flex-col items-center px-4 text-center">
              <span className="text-2xl" aria-hidden>
                🔎
              </span>
              <p className="mt-2 text-lg font-semibold tracking-tight text-[var(--carly-text)] sm:text-xl">
                No encontramos coincidencias con tu perfil
              </p>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--carly-muted)]">
                El buscador no devolvió ofertas alineadas este mes, o el modelo
                no halló encajes con tu CV en el lote revisado. Prueba otras
                palabras clave o un país distinto y vuelve a buscar.
              </p>
              <button
                type="button"
                onClick={() => {
                  setJobs(null);
                  setOffersUnlocked(false);
                  setError(null);
                }}
                className="mt-10 inline-flex min-w-[200px] items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-[1.06] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--carly-page-bg)] dark:focus-visible:ring-offset-zinc-950"
              >
                <Sparkles
                  className="size-[18px] shrink-0 opacity-95"
                  strokeWidth={2.25}
                  aria-hidden
                />
                Nueva búsqueda
              </button>
            </div>
          ) : null}

          {showOffersGate && jobs ? (
            <div className="animate-carly-enter-up flex w-full max-w-lg flex-col items-center px-4 text-center">
              <span className="text-2xl">🎉</span>
              <p className="text-lg font-semibold tracking-tight text-[var(--carly-text)] sm:text-xl">
                Encontramos {jobs.length}{" "}
                {jobs.length === 1 ? "coincidencia" : "coincidencias"} para ti
              </p>
              <button
                type="button"
                onClick={() => {
                  setOffersUnlocked(true);
                  setResultsRevealKey((k) => k + 1);
                }}
                className="mt-8 inline-flex min-w-[200px] items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-[1.06] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--carly-page-bg)] dark:focus-visible:ring-offset-zinc-950"
              >
                <Sparkles
                  className="size-[18px] shrink-0 opacity-95"
                  strokeWidth={2.25}
                  aria-hidden
                />
                Ver ofertas
              </button>
            </div>
          ) : null}

          {showJobCarousel ? (
            <div
              key={resultsRevealKey}
              className="animate-carly-enter-up flex min-h-0 w-full flex-1 flex-col overflow-x-hidden"
            >
              <JobsSlideshow
                jobs={jobs}
                savedPostingIds={savedPostingIds}
                saveBusyId={saveBusyId}
                onToggleSave={handleToggleSave}
                onBack={() => setOffersUnlocked(false)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
