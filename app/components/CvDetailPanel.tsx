"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ResumeHeaderSkeleton } from "./loading-skeletons";
import { cn } from "@/lib/utils";
import { Eye, Loader2, Trash2 } from "lucide-react";

type CvDetailPanelProps = {
  resumeId: Id<"resumes"> | null;
};

const ICON_BTN =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--carly-border)] bg-[var(--carly-icon-bg)] text-[var(--carly-text)] transition hover:bg-[var(--carly-row-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--carly-primary-bg)]";

const VER_BTN =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[var(--carly-border)] bg-[var(--carly-icon-bg)] px-3 text-sm font-medium text-[var(--carly-text)] transition hover:bg-[var(--carly-row-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--carly-primary-bg)]";

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleString("es", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

function extractNameFromHtml(html: string | undefined): string | null {
  if (!html?.trim() || typeof document === "undefined") {
    return null;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const h1 = doc.querySelector("h1");
  const t = h1?.textContent?.trim();
  return t && t.length > 0 ? t : null;
}

function enrichmentLabel(
  status: "pending" | "processing" | "ready" | "error" | undefined,
) {
  switch (status) {
    case "pending":
    case "processing":
      return "Generando el resumen estructurado a partir del PDF…";
    case "ready":
      return null;
    case "error":
      return "No se pudo generar el resumen automáticamente.";
    default:
      return null;
  }
}

export function CvDetailPanel({ resumeId }: CvDetailPanelProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const detail = useQuery(
    api.storage.resume.getById,
    resumeId ? { resumeId } : "skip",
  );
  const removeResume = useMutation(api.storage.resume.remove);
  const enrichFromPdf = useAction(api.cv.enrichResume.enrichFromPdf);

  const displayName = useMemo(() => {
    if (detail == null || detail === undefined) {
      return null;
    }
    return extractNameFromHtml(detail.content) ?? detail.title;
  }, [detail]);

  const confirmDelete = useCallback(async () => {
    if (!resumeId) return;
    setDeleting(true);
    try {
      await removeResume({ resumeId });
      toast.success("Hoja de vida eliminada");
      setDeleteOpen(false);
      router.replace("/my-cvs");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo eliminar la hoja de vida.",
      );
    } finally {
      setDeleting(false);
    }
  }, [removeResume, resumeId, router]);

  const onRetryEnrich = useCallback(() => {
    if (!resumeId) return;
    void enrichFromPdf({ resumeId }).then((r) => {
      if (r && !r.ok) {
        toast.error(r.error ?? "No se pudo reintentar la extracción.");
      }
    });
  }, [enrichFromPdf, resumeId]);

  if (!resumeId) {
    return null;
  }

  if (detail === undefined) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-3 py-8 sm:px-4 sm:py-10">
        <ResumeHeaderSkeleton />
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-3 py-8 sm:px-4 sm:py-10">
        <p className="text-sm text-[var(--carly-muted)]">
          No se encontró esta hoja de vida o ya no tienes acceso.
        </p>
      </div>
    );
  }

  const enrichHint = enrichmentLabel(detail.enrichmentStatus);
  const hasHtml = Boolean(detail.content?.trim());

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-3 py-8 sm:px-4 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--carly-text)] sm:text-3xl">
            {displayName ?? detail.title}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--carly-muted)]">
            {detail.fileName} · Actualizado el {formatDate(detail.updatedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 self-start sm:pt-0.5">
          {detail.downloadUrl ? (
            <a
              href={detail.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={VER_BTN}
              aria-label="Ver PDF en una pestaña nueva"
              title="Ver"
            >
              <Eye className="size-[18px]" strokeWidth={2} aria-hidden />
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setDeleteOpen(true);
            }}
            className={cn(
              ICON_BTN,
              "text-red-600 hover:border-red-200 hover:bg-red-50 dark:text-red-400 dark:hover:border-red-900/50 dark:hover:bg-red-950/40",
            )}
            aria-label="Eliminar hoja de vida"
            title="Eliminar"
          >
            <Trash2 className="size-[18px]" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </header>

      {enrichHint ? (
        <p
          className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--carly-muted)]"
          role="status"
          aria-live="polite"
        >
          <Loader2
            className="size-4 shrink-0 animate-spin text-violet-500"
            aria-hidden
          />
          <span>
            {enrichHint}
            {detail.enrichmentStatus === "error" && detail.enrichmentError
              ? ` ${detail.enrichmentError}`
              : null}
          </span>
          {detail.enrichmentStatus === "error" ? (
            <button
              type="button"
              onClick={onRetryEnrich}
              className="font-medium text-violet-600 underline underline-offset-2 hover:text-violet-500 dark:text-violet-400"
            >
              Reintentar
            </button>
          ) : null}
        </p>
      ) : null}

      <section className="mt-10 min-w-0">
        <h2 className="text-lg font-semibold text-[var(--carly-text)] sm:text-xl">
          Resumen
        </h2>
        {hasHtml ? (
          <div
            className={cn(
              "mt-4 min-w-0 text-sm leading-relaxed text-[var(--carly-text)]",
              "[&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold",
              "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold",
              "[&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold",
              "[&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5",
              "[&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--carly-border)] [&_td]:p-2 [&_th]:border [&_th]:border-[var(--carly-border)] [&_th]:p-2",
            )}
            dangerouslySetInnerHTML={{ __html: detail.content ?? "" }}
          />
        ) : (
          <p className="mt-4 text-sm text-[var(--carly-muted)]">
            {detail.enrichmentStatus === "ready"
              ? "Aún no hay contenido de resumen disponible."
              : "El resumen aparecerá aquí cuando termine el análisis del PDF."}
          </p>
        )}
      </section>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          className="border-[var(--carly-border)] bg-[var(--carly-card-bg)] text-[var(--carly-text)] shadow-xl sm:max-w-md"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>¿Eliminar tu hoja de vida?</DialogTitle>
            <DialogDescription className="text-left text-[var(--carly-muted)]">
              Vas a borrar el PDF y el resumen asociados a tu cuenta.{" "}
              <strong className="font-medium text-[var(--carly-text)]">
                Carly necesita una hoja de vida para contextualizar el chat y
                ayudarte en la búsqueda de empleo.
              </strong>{" "}
              Sin un CV subido, el agente no podrá usar tu documento hasta que
              vuelvas a subir uno.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
              }}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="border-0 bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
              onClick={() => {
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "Eliminando…" : "Sí, eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
