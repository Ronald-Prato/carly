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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CvTemplateCatalogCard } from "./CvTemplateCatalogCard";
import { ResumeHeaderSkeleton } from "./loading-skeletons";
import { cn } from "@/lib/utils";
import {
  type CvData,
  type CvTemplateDefinition,
  buildMockPreviewHtml,
  CV_TEMPLATE_CATALOG,
  isLiveTemplate,
} from "@/lib/cvTemplates";
import { downloadCvAsPdf } from "@/lib/cvTemplates/pdf";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

const TAB_TRIGGER_CLASS =
  "rounded-none px-4 py-2.5 text-base font-medium text-neutral-500 transition-colors data-active:text-neutral-900 dark:text-neutral-400 dark:data-active:text-white data-active:after:h-[3px] data-active:after:rounded-none data-active:after:bg-neutral-900 dark:data-active:after:bg-white";

export function CvDetailPanel({ resumeId }: CvDetailPanelProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [templatePreview, setTemplatePreview] = useState<{
    title: string;
    html: string;
  } | null>(null);
  const [pdfTemplateId, setPdfTemplateId] = useState<string | null>(null);

  /**
   * Render síncrono: la plantilla es código TS puro, no un fetch a un .html.
   * Si hay error en una plantilla (mock corrupto, etc.), la omitimos del
   * mapa y la card mostrará el placeholder.
   */
  const filledPreviewById = useMemo(() => {
    const out: Record<string, string> = {};
    for (const t of CV_TEMPLATE_CATALOG) {
      if (!isLiveTemplate(t)) continue;
      try {
        out[t.id] = buildMockPreviewHtml(t.id);
      } catch {
        /* noop */
      }
    }
    return out;
  }, []);

  const detail = useQuery(
    api.storage.resume.getById,
    resumeId ? { resumeId } : "skip",
  );
  const removeResume = useMutation(api.storage.resume.remove);
  const enrichFromPdf = useAction(api.cv.enrichResume.enrichFromPdf);

  const displayName = useMemo(() => {
    if (!detail) return null;
    const fromData =
      (detail.data as CvData | null | undefined)?.basics?.name?.trim() ?? "";
    if (fromData.length > 0) return fromData;
    return detail.title;
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

  const openTemplatePreview = useCallback(
    (template: CvTemplateDefinition) => {
      if (!isLiveTemplate(template)) {
        toast.info("Esta plantilla estará disponible pronto.");
        return;
      }
      try {
        const html =
          filledPreviewById[template.id] ?? buildMockPreviewHtml(template.id);
        setTemplatePreview({ title: template.name, html });
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "No se pudo cargar la vista previa de la plantilla.",
        );
      }
    },
    [filledPreviewById],
  );

  /** Datos estructurados del CV; null mientras enriquecimiento no termina o si es legado. */
  const cvData = (detail?.data as CvData | null | undefined) ?? null;

  const applyTemplateAndDownload = useCallback(
    async (template: CvTemplateDefinition) => {
      if (!isLiveTemplate(template)) {
        toast.info("Esta plantilla estará disponible pronto.");
        return;
      }
      if (!cvData) {
        toast.error(
          "Tu CV aún no tiene datos estructurados. Espera a que termine el análisis o vuelve a subir el PDF.",
        );
        return;
      }
      const baseName = (detail?.title ?? "cv").trim() || "cv";
      setPdfTemplateId(template.id);
      const toastId = `cv-pdf-${template.id}`;
      toast.loading("Generando PDF…", { id: toastId });
      try {
        await downloadCvAsPdf({
          data: cvData,
          templateId: template.id,
          fileName: `${baseName} - ${template.name}`,
        });
        toast.success("PDF descargado", { id: toastId });
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "No se pudo generar el PDF.",
          { id: toastId },
        );
      } finally {
        setPdfTemplateId(null);
      }
    },
    [cvData, detail?.title],
  );

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
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-3 py-8 sm:px-4 sm:py-10">
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

      <Tabs defaultValue="resumen" className="mt-8 flex min-h-0 flex-1 flex-col gap-3">
        <TabsList
          className="h-auto self-start gap-0 border-0 bg-transparent p-0"
          variant="line"
        >
          <TabsTrigger value="resumen" className={TAB_TRIGGER_CLASS}>
            Resumen
          </TabsTrigger>
          <TabsTrigger value="plantillas" className={TAB_TRIGGER_CLASS}>
            Plantillas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-2 min-w-0 flex-1">
          {hasHtml ? (
            <article
              className={cn(
                "mx-auto min-w-0 max-w-[760px] px-1 sm:px-2",
                "text-[15px] leading-7 text-[var(--carly-text)]",
                /* Notion-ish typography */
                "[&_h1]:mt-2 [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight",
                "[&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
                "[&_h2]:border-b [&_h2]:border-[var(--carly-border)] [&_h2]:pb-1",
                "[&_h3]:mt-5 [&_h3]:mb-1 [&_h3]:text-[15px] [&_h3]:font-semibold",
                "[&_p]:my-2",
                "[&_em]:text-[var(--carly-muted)] [&_em]:not-italic",
                "[&_strong]:font-semibold",
                "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul_li]:my-1",
                "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol_li]:my-1",
                "[&_a]:text-blue-600 [&_a]:underline-offset-2 hover:[&_a]:underline dark:[&_a]:text-blue-400",
                "[&_hr]:my-6 [&_hr]:border-[var(--carly-border)]",
                "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--carly-border)] [&_blockquote]:pl-4 [&_blockquote]:text-[var(--carly-muted)]",
                "[&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] dark:[&_code]:bg-neutral-800",
                "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse",
                "[&_th]:border [&_th]:border-[var(--carly-border)] [&_th]:p-2 [&_th]:text-left",
                "[&_td]:border [&_td]:border-[var(--carly-border)] [&_td]:p-2",
              )}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                /** No habilitamos rehype-raw a propósito: el modelo tiene
                 *  prohibido emitir HTML, y queremos que cualquier "<…>"
                 *  accidental se muestre como texto, no se interprete. */
              >
                {detail.content ?? ""}
              </ReactMarkdown>
            </article>
          ) : (
            <p className="text-sm text-[var(--carly-muted)]">
              {detail.enrichmentStatus === "ready"
                ? "Aún no hay contenido de resumen disponible."
                : "El resumen aparecerá aquí cuando termine el análisis del PDF."}
            </p>
          )}
        </TabsContent>

        <TabsContent value="plantillas" className="mt-2 min-w-0 flex-1">
          <div
            className={cn(
              "rounded-2xl border border-neutral-200/80 bg-neutral-50/80 p-5 sm:p-8",
              "dark:border-neutral-800 dark:bg-neutral-900/40",
            )}
          >
            <p className="mb-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              Elige una plantilla para ver una vista previa con datos de ejemplo.
              Pronto podrás aplicar tu CV a la plantilla que elijas.
            </p>
            <ul
              className={cn(
                "grid gap-x-5 gap-y-8",
                CV_TEMPLATE_CATALOG.length === 1
                  ? "mx-auto max-w-md grid-cols-1"
                  : "grid-cols-2 lg:grid-cols-4",
              )}
            >
              {CV_TEMPLATE_CATALOG.map((t) => (
                <li key={t.id} className="min-w-0">
                  <CvTemplateCatalogCard
                    template={t}
                    srcDoc={filledPreviewById[t.id] ?? null}
                    onPreview={() => {
                      openTemplatePreview(t);
                    }}
                    onUse={() => {
                      void applyTemplateAndDownload(t);
                    }}
                    isGeneratingPdf={pdfTemplateId === t.id}
                    canUse={cvData !== null}
                  />
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={templatePreview !== null}
        onOpenChange={(open) => {
          if (!open) setTemplatePreview(null);
        }}
      >
        <DialogContent
          className={cn(
            "grid max-h-[92vh] w-[calc(100%-1.5rem)] max-w-[min(calc(100vw-1.5rem),1140px)] overflow-hidden border-[var(--carly-border)] bg-[var(--carly-card-bg)] p-0 text-[var(--carly-text)] shadow-xl",
            /** Sustituye el `sm:max-w-sm` por defecto del diálogo para respetar el ancho del template (~1000px). */
            "sm:max-w-[min(calc(100vw-2rem),1140px)] lg:max-w-[min(calc(100vw-3rem),1200px)]",
          )}
          showCloseButton
        >
          <div className="border-b border-[var(--carly-border)] px-4 py-3 sm:px-6">
            <DialogHeader className="gap-1 text-left">
              <DialogTitle>Vista previa: {templatePreview?.title}</DialogTitle>
              <DialogDescription className="text-[var(--carly-muted)]">
                Datos de ejemplo; la aplicación a tu CV llegará en un siguiente paso.
              </DialogDescription>
            </DialogHeader>
          </div>
          {templatePreview ? (
            <div className="min-h-0 bg-[#eaeaea]">
              <iframe
                title={`Plantilla ${templatePreview.title}`}
                sandbox=""
                className="block h-[min(82vh,1100px)] w-full border-0"
                srcDoc={templatePreview.html}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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
