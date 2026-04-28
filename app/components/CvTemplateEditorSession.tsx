"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  type CvData,
  type CvTemplateDefinition,
  buildPreviewHtml,
} from "@/lib/cvTemplates";
import {
  CV_PAGE_WIDTH_PX,
  stripCvPagingChromeFromDocument,
} from "@/lib/cvTemplates/layout";
import { downloadCvAsPdf } from "@/lib/cvTemplates/pdf";
import {
  attachCvIframeBlockEditor,
  CV_BLOCK_EDITOR_STYLES,
  CV_EDITOR_SHELL_STYLES,
  CV_PRINT_MATCH_STYLES,
  cvTemplateDraftStorageKey,
  type CvIframeBlockEditorApi,
} from "@/lib/cvTemplateEditor/iframeBlockEditor";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Bold,
  Download,
  Italic,
  Loader2,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Underline,
} from "lucide-react";

type CvTemplateEditorSessionProps = {
  resumeId: string;
  template: CvTemplateDefinition;
  cvData: CvData;
  fileBaseName: string;
  onClose: () => void;
};

const ZOOM_MIN = 0.38;
const ZOOM_MAX = 1.28;
/** Paso de zoom en los botones +/- (más contundente). */
const ZOOM_STEP = 0.07;
/** Rueda con Ctrl/Meta: más suave que los botones. */
const WHEEL_ZOOM_SENSITIVITY = 10;
/** Pellizco (gesturechange): atenúa cuánto del `scale` del trackpad se aplica (1 = sin atenuar). */
const PINCH_ZOOM_GAIN = 0.38;
const DEFAULT_VIEW_ZOOM = 0.62;
const PERSIST_DEBOUNCE_MS = 300;

function fullHtmlFromIframe(iframe: HTMLIFrameElement): string | null {
  const doc = iframe.contentDocument;
  const root = doc?.documentElement;
  if (!doc || !root) return null;
  stripCvPagingChromeFromDocument(doc);
  return `<!DOCTYPE html>\n${root.outerHTML}`;
}

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function execInIframe(iframe: HTMLIFrameElement | null, command: string) {
  if (!iframe?.contentDocument) return;
  const win = iframe.contentWindow;
  if (!win) return;
  win.focus();
  iframe.contentDocument.execCommand(command, false);
}

export function CvTemplateEditorSession({
  resumeId,
  template,
  cvData,
  fileBaseName,
  onClose,
}: CvTemplateEditorSessionProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const blockEditorRef = useRef<CvIframeBlockEditorApi | null>(null);
  const zoomListenersCleanupRef = useRef<(() => void) | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [docHeightPx, setDocHeightPx] = useState(1100);
  const [viewZoom, setViewZoom] = useState(DEFAULT_VIEW_ZOOM);
  const [iframeSrcDoc, setIframeSrcDoc] = useState(() => {
    try {
      return buildPreviewHtml(cvData, template.id);
    } catch (e) {
      return `<!DOCTYPE html><html><body style="font-family:system-ui;padding:24px;color:#b91c1c">${
        e instanceof Error ? e.message : "No se pudo renderizar la plantilla."
      }</body></html>`;
    }
  });

  const viewZoomRef = useRef(DEFAULT_VIEW_ZOOM);
  const pinchZoomStartRef = useRef(DEFAULT_VIEW_ZOOM);

  useEffect(() => {
    viewZoomRef.current = viewZoom;
  }, [viewZoom]);

  const clearPersistTimer = useCallback(() => {
    if (persistTimerRef.current !== null) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
  }, []);

  const persistDraftToStorage = useCallback(() => {
    const iframe = iframeRef.current;
    const html = iframe ? fullHtmlFromIframe(iframe) : null;
    if (!html?.trim()) return;
    try {
      localStorage.setItem(
        cvTemplateDraftStorageKey(resumeId, template.id),
        html,
      );
    } catch {
      toast.error("No se pudo guardar el borrador en este dispositivo.");
    }
  }, [resumeId, template.id]);

  const persistDraftRef = useRef(persistDraftToStorage);

  const flushPersistDraft = useCallback(() => {
    clearPersistTimer();
    persistDraftToStorage();
  }, [clearPersistTimer, persistDraftToStorage]);

  const schedulePersistDraft = useCallback(() => {
    clearPersistTimer();
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      persistDraftToStorage();
    }, PERSIST_DEBOUNCE_MS);
  }, [clearPersistTimer, persistDraftToStorage]);

  useEffect(() => {
    persistDraftRef.current = persistDraftToStorage;
  }, [persistDraftToStorage]);

  useEffect(() => {
    startTransition(() => {
      try {
        const fresh = buildPreviewHtml(cvData, template.id);
        const raw = localStorage.getItem(
          cvTemplateDraftStorageKey(resumeId, template.id),
        );
        if (raw?.includes("cv-container")) {
          setIframeSrcDoc(raw);
        } else {
          setIframeSrcDoc(fresh);
        }
      } catch {
        try {
          setIframeSrcDoc(buildPreviewHtml(cvData, template.id));
        } catch (e) {
          setIframeSrcDoc(
            `<!DOCTYPE html><html><body>${e instanceof Error ? e.message : "Error"}</body></html>`,
          );
        }
      }
    });
  }, [cvData, resumeId, template.id]);

  /** Altura del iframe según el documento. */
  const syncIframeLayout = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.documentElement) return;
    const h = Math.max(
      doc.documentElement.scrollHeight,
      doc.body?.scrollHeight ?? 0,
      400,
    );
    iframe.style.height = `${h}px`;
    setDocHeightPx(h);
  }, []);

  const onIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) {
      return;
    }

    stripCvPagingChromeFromDocument(doc);

    zoomListenersCleanupRef.current?.();

    blockEditorRef.current?.dispose();
    blockEditorRef.current = null;

    const root = doc.querySelector(".cv-container");
    if (root instanceof HTMLElement) {
      root.removeAttribute("contenteditable");
      root.removeAttribute("spellcheck");
    }

    doc.querySelector("style[data-carly-editor]")?.remove();
    const extra = doc.createElement("style");
    extra.setAttribute("data-carly-editor", "true");
    extra.textContent = `${CV_EDITOR_SHELL_STYLES}\n${CV_BLOCK_EDITOR_STYLES}\n${CV_PRINT_MATCH_STYLES}`;
    doc.head.appendChild(extra);

    const handleWheelZoom = (e: WheelEvent) => {
      const zoomChord =
        e.ctrlKey ||
        e.metaKey ||
        e.getModifierState?.("Control") ||
        e.getModifierState?.("Meta");
      if (!zoomChord) return;
      e.preventDefault();
      e.stopPropagation();
      const wheelNorm = Math.min(Math.abs(e.deltaY) / 140, 2.2);
      const step =
        Math.sign(e.deltaY) * ZOOM_STEP * WHEEL_ZOOM_SENSITIVITY * wheelNorm;
      setViewZoom((z) => clampZoom(z - step));
    };
    doc.addEventListener("wheel", handleWheelZoom, {
      passive: false,
      capture: true,
    });

    const rootEl = doc.documentElement;
    const onGestureStart = (ev: Event) => {
      (ev as unknown as { preventDefault?: () => void }).preventDefault?.();
      pinchZoomStartRef.current = viewZoomRef.current;
    };
    const onGestureChange = (ev: Event) => {
      const ge = ev as unknown as {
        preventDefault?: () => void;
        scale?: number;
      };
      ge.preventDefault?.();
      const s = typeof ge.scale === "number" ? ge.scale : 1;
      if (s === 1) return;
      const factor = 1 + (s - 1) * PINCH_ZOOM_GAIN;
      setViewZoom(clampZoom(pinchZoomStartRef.current * factor));
    };

    try {
      rootEl.addEventListener("gesturestart", onGestureStart, {
        passive: false,
      } as AddEventListenerOptions);
      rootEl.addEventListener("gesturechange", onGestureChange, {
        passive: false,
      } as AddEventListenerOptions);
    } catch {
      /* WebKit opcional */
    }

    zoomListenersCleanupRef.current = () => {
      doc.removeEventListener("wheel", handleWheelZoom, { capture: true });
      try {
        rootEl.removeEventListener("gesturestart", onGestureStart);
        rootEl.removeEventListener("gesturechange", onGestureChange);
      } catch {
        /* noop */
      }
      zoomListenersCleanupRef.current = null;
    };

    blockEditorRef.current = attachCvIframeBlockEditor(doc, {
      onBlockInput: schedulePersistDraft,
    });

    syncIframeLayout();
    const docWithFonts = doc as Document & {
      fonts?: { ready: Promise<unknown> };
    };
    void (async () => {
      try {
        await docWithFonts.fonts?.ready;
      } catch {
        /* ignore */
      }
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      syncIframeLayout();
    })();

    resizeObserverRef.current?.disconnect();
    const ro = new ResizeObserver(() => {
      syncIframeLayout();
    });
    ro.observe(doc.body);
    resizeObserverRef.current = ro;
  }, [schedulePersistDraft, syncIframeLayout]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      blockEditorRef.current?.dispose();
      blockEditorRef.current = null;
      zoomListenersCleanupRef.current?.();
      try {
        persistDraftRef.current();
      } catch {
        /* noop */
      }
    };
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    blockEditorRef.current?.commit();
    flushPersistDraft();
    const iframe = iframeRef.current;
    const htmlOverride = iframe ? fullHtmlFromIframe(iframe) : null;
    if (!htmlOverride?.trim()) {
      toast.error("Espera a que cargue el documento e inténtalo de nuevo.");
      return;
    }
    const toastId = `cv-pdf-editor-${template.id}`;
    setDownloading(true);
    toast.loading("Generando PDF…", { id: toastId });
    try {
      await downloadCvAsPdf({
        data: cvData,
        templateId: template.id,
        fileName: `${fileBaseName} - ${template.name}`,
        htmlOverride,
      });
      toast.success("PDF descargado", { id: toastId });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo generar el PDF.",
        { id: toastId },
      );
    } finally {
      setDownloading(false);
    }
  }, [cvData, fileBaseName, flushPersistDraft, template.id, template.name]);

  const handlePrint = useCallback(() => {
    blockEditorRef.current?.commit();
    flushPersistDraft();
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.documentElement) {
      toast.error("Espera a que cargue el documento e inténtalo de nuevo.");
      return;
    }
    const html = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
    const printWin = window.open("", "_blank");
    if (!printWin) {
      toast.error(
        "Permite ventanas emergentes para imprimir. Si ves la URL o la numeración al pie, en el diálogo de impresión desactiva «Encabezados y pies de página».",
      );
      return;
    }
    try {
      printWin.opener = null;
    } catch {
      /* noop */
    }
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.document.title = `${fileBaseName} — ${template.name}`;
    const runPrint = () => {
      try {
        printWin.focus();
        printWin.print();
      } catch {
        toast.error("No se pudo abrir el cuadro de impresión.");
      }
    };
    printWin.addEventListener(
      "afterprint",
      () => {
        try {
          printWin.close();
        } catch {
          /* noop */
        }
      },
      { once: true },
    );
    if (printWin.document.readyState === "complete") {
      requestAnimationFrame(runPrint);
    } else {
      printWin.addEventListener("load", runPrint, { once: true });
    }
  }, [fileBaseName, flushPersistDraft, template.name]);

  const fmtBtn =
    "inline-flex size-9 items-center justify-center rounded-full border border-neutral-200/90 bg-white/95 text-neutral-800 shadow-sm transition hover:bg-white hover:text-violet-700 dark:border-neutral-600 dark:bg-neutral-800/95 dark:text-neutral-100 dark:hover:bg-neutral-700 dark:hover:text-violet-200";

  const zoomBtn =
    "inline-flex size-9 items-center justify-center rounded-full border border-neutral-200/90 bg-white/95 text-neutral-800 shadow-sm transition hover:bg-white dark:border-neutral-600 dark:bg-neutral-800/95 dark:text-neutral-100";

  const scaledW = CV_PAGE_WIDTH_PX * viewZoom;
  const scaledH = docHeightPx * viewZoom;

  return (
    <div className="relative flex w-full flex-col pb-10">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-neutral-300/60 bg-[#cfd4da]/90 px-3 py-3 backdrop-blur-sm sm:px-4 dark:border-neutral-700/50 dark:bg-neutral-950/85">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              blockEditorRef.current?.commit();
              flushPersistDraft();
              syncIframeLayout();
              onClose();
            }}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border border-neutral-200/90 bg-white/95 px-3.5 text-sm font-medium text-neutral-800 shadow-sm backdrop-blur-sm transition hover:bg-white dark:border-neutral-600 dark:bg-neutral-800/95 dark:text-neutral-100 dark:hover:bg-neutral-700",
            )}
            aria-label="Volver a plantillas"
          >
            <ArrowLeft
              className="size-4 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            Volver
          </button>
          <div
            className="flex items-center gap-0.5 rounded-full border border-neutral-200/90 bg-white/95 p-1 shadow-sm backdrop-blur-sm dark:border-neutral-600 dark:bg-neutral-800/95"
            role="toolbar"
            aria-label="Formato de texto"
          >
            <button
              type="button"
              className={fmtBtn}
              aria-label="Negrita"
              title="Negrita"
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => {
                execInIframe(iframeRef.current, "bold");
              }}
            >
              <Bold className="size-4" strokeWidth={2.25} aria-hidden />
            </button>
            <button
              type="button"
              className={fmtBtn}
              aria-label="Cursiva"
              title="Cursiva"
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => {
                execInIframe(iframeRef.current, "italic");
              }}
            >
              <Italic className="size-4" strokeWidth={2.25} aria-hidden />
            </button>
            <button
              type="button"
              className={fmtBtn}
              aria-label="Subrayado"
              title="Subrayado"
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => {
                execInIframe(iframeRef.current, "underline");
              }}
            >
              <Underline className="size-4" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
          <div
            className="flex items-center gap-0.5 rounded-full border border-neutral-200/90 bg-white/95 p-1 shadow-sm backdrop-blur-sm dark:border-neutral-600 dark:bg-neutral-800/95"
            role="toolbar"
            aria-label="Zoom del CV"
          >
            <button
              type="button"
              className={zoomBtn}
              aria-label="Alejar"
              title="Alejar"
              onClick={() => {
                setViewZoom((z) => clampZoom(z - ZOOM_STEP));
              }}
            >
              <Minus className="size-4" strokeWidth={2.25} aria-hidden />
            </button>
            <span className="min-w-[3.25rem] px-1 text-center text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">
              {Math.round(viewZoom * 100)}%
            </span>
            <button
              type="button"
              className={zoomBtn}
              aria-label="Acercar"
              title="Acercar"
              onClick={() => {
                setViewZoom((z) => clampZoom(z + ZOOM_STEP));
              }}
            >
              <Plus className="size-4" strokeWidth={2.25} aria-hidden />
            </button>
            <button
              type="button"
              className={zoomBtn}
              aria-label="Restablecer zoom"
              title="Restablecer zoom"
              onClick={() => {
                setViewZoom(DEFAULT_VIEW_ZOOM);
              }}
            >
              <RotateCcw className="size-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <span className="hidden max-w-[11rem] text-[10px] leading-tight text-neutral-500 sm:inline dark:text-neutral-400">
            Pellizcar en el CV o Ctrl + rueda
          </span>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto">
          <button
            type="button"
            disabled={downloading}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => {
              handlePrint();
            }}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border border-neutral-200/90 bg-white/95 px-3.5 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-white disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800/95 dark:text-neutral-100 dark:hover:bg-neutral-700",
            )}
            aria-label="Imprimir CV"
            title="Si al imprimir ves la URL o números de página abajo: en el diálogo, Más opciones y desactiva «Encabezados y pies de página» (Chrome, Edge y similares)."
          >
            <Printer className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            Imprimir
          </button>
          <button
            type="button"
            disabled={downloading}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => {
              void handleDownloadPdf();
            }}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border border-violet-500/30 bg-violet-600 px-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-violet-500 disabled:pointer-events-none disabled:opacity-50",
            )}
            aria-label="Descargar PDF"
          >
            {downloading ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Download
                className="size-4 shrink-0"
                strokeWidth={2}
                aria-hidden
              />
            )}
            {downloading ? "Generando…" : "PDF"}
          </button>
        </div>
      </div>

      <div className="flex w-full flex-col items-center px-3 pt-2 pb-6 sm:px-5">
        <div
          className="relative shrink-0 overflow-hidden"
          style={{
            width: scaledW,
            height: scaledH,
          }}
        >
          <iframe
            key={`${resumeId}-${template.id}-${iframeSrcDoc.length}`}
            ref={iframeRef}
            title={`CV — ${template.name}`}
            sandbox="allow-same-origin allow-modals"
            scrolling="no"
            onLoad={onIframeLoad}
            className="border-0 bg-[#cfd4da] dark:bg-neutral-950"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: CV_PAGE_WIDTH_PX,
              height: docHeightPx,
              transform: `scale(${viewZoom})`,
              transformOrigin: "top left",
              display: "block",
              overflow: "hidden",
            }}
            srcDoc={iframeSrcDoc}
          />
        </div>
      </div>
    </div>
  );
}
