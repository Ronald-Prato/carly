"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { JobOfferCard } from "@/app/components/JobOfferCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { EnrichedJobCard } from "@/lib/jobs/enrichedJobCard";

export default function SavedOffersPage() {
  const rows = useQuery(api.savedJobOffers.list, {});
  const removeOffer = useMutation(api.savedJobOffers.remove);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] =
    useState<EnrichedJobCard | null>(null);
  const [titleQuery, setTitleQuery] = useState("");
  const [listRef] = useAutoAnimate();

  const filteredRows = useMemo(() => {
    if (!rows) {
      return [];
    }
    const q = titleQuery.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter((row) => {
      const card = row.card as EnrichedJobCard;
      const title = (card.title ?? "").toLowerCase();
      return title.includes(q);
    });
  }, [rows, titleQuery]);

  const performRemove = useCallback(
    async (job: EnrichedJobCard) => {
      const id = job.id?.trim();
      if (!id) {
        return;
      }
      setBusyId(id);
      try {
        await removeOffer({ linkedInPostingId: id });
      } finally {
        setBusyId(null);
      }
    },
    [removeOffer],
  );

  const askRemoveSaved = useCallback((job: EnrichedJobCard) => {
    setPendingRemove(job);
  }, []);

  const confirmRemoveSaved = useCallback(async () => {
    if (!pendingRemove) {
      return;
    }
    await performRemove(pendingRemove);
    setPendingRemove(null);
  }, [performRemove, pendingRemove]);

  const pendingId = pendingRemove?.id?.trim() ?? "";
  const confirmingBusy =
    pendingId.length > 0 && busyId === pendingId;

  const loading = rows === undefined;
  const empty = rows !== undefined && rows.length === 0;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--carly-text)]">
            Ofertas guardadas
          </h1>
          <p className="mt-1 text-sm text-[var(--carly-muted)]">
            Las ofertas que guardes desde Empleos aparecerán aquí con el mismo
            detalle que en el carrusel.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--carly-muted)]">Cargando…</p>
        ) : empty ? (
          <div className="flex flex-col items-center rounded-2xl border border-[var(--carly-border)] bg-[var(--carly-card-bg)] px-6 py-14 text-center shadow-sm">
            <p className="text-lg font-semibold text-[var(--carly-text)]">
              No has guardado ofertas aún
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--carly-muted)]">
              Cuando encuentres una oferta que te interese en la búsqueda de
              empleos, pulsa el icono de marcador junto a «Ver oferta» para
              guardarla aquí.
            </p>
            <Link
              href="/jobs"
              className="mt-8 inline-flex min-w-[200px] items-center justify-center rounded-[12px] bg-[var(--carly-primary-bg)] px-6 py-3 text-sm font-semibold text-[var(--carly-primary-fg)] shadow-sm transition hover:bg-[var(--carly-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--carly-primary-bg)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--carly-page-bg)]"
            >
              Ir a Empleos
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <label className="block" htmlFor="saved-offers-search">
              <span className="sr-only">Buscar por título de oferta</span>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                  aria-hidden
                  strokeWidth={2}
                />
                <input
                  id="saved-offers-search"
                  type="search"
                  value={titleQuery}
                  onChange={(e) => setTitleQuery(e.target.value)}
                  placeholder="Buscar por título del puesto…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200 bg-[var(--carly-page-bg)] py-3 pr-11 pl-11 text-[15px] text-[var(--carly-text)] placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-600 dark:placeholder:text-zinc-500"
                />
                {titleQuery.trim().length > 0 ? (
                  <button
                    type="button"
                    aria-label="Borrar búsqueda"
                    onClick={() => setTitleQuery("")}
                    className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    <X className="size-4" strokeWidth={2} />
                  </button>
                ) : null}
              </div>
            </label>

            {filteredRows.length === 0 ? (
              <p className="text-sm text-[var(--carly-muted)]">
                No hay ofertas cuyo título coincida con «{titleQuery.trim()}».
                Prueba con otras palabras o borra la búsqueda.
              </p>
            ) : (
              <ul
                ref={listRef}
                className="flex flex-col gap-8 pb-10"
              >
                {filteredRows.map((row) => {
                  const card = row.card as EnrichedJobCard;
                  const pid = card.id?.trim() ?? "";
                  return (
                    <li key={row._id}>
                      <JobOfferCard
                        job={card}
                        saved
                        saveBusy={busyId === pid}
                        onSaveToggle={() => askRemoveSaved(card)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <Dialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemove(null);
          }
        }}
      >
        <DialogContent
          className="border-[var(--carly-border)] bg-[var(--carly-card-bg)] text-[var(--carly-text)] shadow-xl sm:max-w-md"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>
              ¿Quieres eliminar esta oferta de tus guardados?
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingRemove(null)}
              disabled={confirmingBusy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void confirmRemoveSaved()}
              disabled={confirmingBusy}
            >
              {confirmingBusy ? "Quitando…" : "Aceptar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
