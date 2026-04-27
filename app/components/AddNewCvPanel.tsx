"use client";

import { useAction, useMutation } from "convex/react";
import { useCallback, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Progress } from "@/components/ui/progress";
import { Check, FileText, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type AddNewCvPanelProps = {
  onUploaded?: (resumeId: Id<"resumes">) => void;
  /**
   * `true` (default): título, texto e input centrados (vista vacía a pantalla completa).
   * `false`: bloque bajo un detalle, alineado al inicio.
   */
  centered?: boolean;
};

type Phase = "idle" | "fileReady" | "processing";

type LogLine = { id: string; text: string; done: boolean };

function validatePdf(file: File): string | null {
  if (file.type !== "application/pdf") {
    return "Solo se admiten archivos PDF.";
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return "El archivo debe ser un PDF (extensión .pdf).";
  }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AddNewCvPanel({
  onUploaded,
  centered = true,
}: AddNewCvPanelProps) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const enrichProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generateUploadUrl = useMutation(api.storage.resume.generateUploadUrl);
  const saveAfterUpload = useMutation(api.storage.resume.saveAfterUpload);
  const enrichFromPdf = useAction(api.cv.enrichResume.enrichFromPdf);

  const [phase, setPhase] = useState<Phase>("idle");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const dragCounter = useRef(0);

  const clearEnrichProgressTimer = useCallback(() => {
    if (enrichProgressRef.current) {
      clearInterval(enrichProgressRef.current);
      enrichProgressRef.current = null;
    }
  }, []);

  const appendLog = useCallback((text: string) => {
    setLogLines((prev) => {
      const markDone = prev.map((l) => ({ ...l, done: true }));
      return [
        ...markDone,
        { id: `${Date.now()}-${text}`, text, done: false },
      ];
    });
  }, []);

  const resetFlow = useCallback(() => {
    setPhase("idle");
    setPendingFile(null);
    setError(null);
    setIsBusy(false);
    setProgress(0);
    setLogLines([]);
    clearEnrichProgressTimer();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [clearEnrichProgressTimer]);

  const setFileFromUser = useCallback(
    (file: File) => {
      const v = validatePdf(file);
      if (v) {
        setError(v);
        setPendingFile(null);
        setPhase("idle");
        toast.error("Archivo no válido", { description: v });
        return;
      }
      setError(null);
      setPendingFile(file);
      setPhase("fileReady");
    },
    [],
  );

  const onCancel = useCallback(() => {
    if (isBusy) return;
    resetFlow();
  }, [isBusy, resetFlow]);

  const runUploadAndEnrich = useCallback(
    async (file: File) => {
      setIsBusy(true);
      setProgress(0);
      setLogLines([]);
      setPhase("processing");
      setError(null);
      const toastId = "cv-import";

      try {
        appendLog("Preparando envío…");
        setProgress(8);
        await new Promise((r) => setTimeout(r, 200));

        appendLog("Subiendo archivo a la nube…");
        setProgress(22);
        const postUrl = await generateUploadUrl();
        setProgress(32);
        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/pdf" },
          body: file,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Error al subir el archivo");
        }
        setProgress(44);
        const json = (await res.json()) as { storageId: string };

        appendLog("Guardando en tu cuenta…");
        setProgress(52);
        const newId = await saveAfterUpload({
          storageId: json.storageId as Id<"_storage">,
          fileName: file.name,
        });
        onUploaded?.(newId);
        router.replace(`/my-cvs/${newId}`);

        appendLog("Generando CV digital (Europass) y leyendo el PDF…");
        setProgress(58);

        clearEnrichProgressTimer();
        enrichProgressRef.current = setInterval(() => {
          setProgress((p) => (p < 90 ? p + 1 : p));
        }, 350);

        toast.loading("Procesando tu hoja de vida…", { id: toastId });
        const enrich = await enrichFromPdf({ resumeId: newId });
        clearEnrichProgressTimer();
        setProgress(100);
        appendLog("Listo. Tu CV está guardado.");

        if (enrich?.ok) {
          toast.success("Hoja de vida importada con éxito", {
            id: toastId,
            description: "PDF guardado y CV digital (HTML) generado correctamente.",
          });
        } else {
          toast.warning("PDF guardado; aviso de análisis", {
            id: toastId,
            description:
              enrich?.error ??
              "No se pudo generar el HTML automáticamente. Puedes reintentar desde el detalle.",
          });
        }
        resetFlow();
      } catch (err) {
        clearEnrichProgressTimer();
        const message =
          err instanceof Error
            ? err.message
            : "No se pudo subir la hoja de vida.";
        toast.dismiss(toastId);
        setError(message);
        toast.error("Error al subir", { description: message });
        setProgress(0);
        setLogLines([]);
        setPhase("fileReady");
        setPendingFile(file);
      } finally {
        setIsBusy(false);
      }
    },
    [
      appendLog,
      clearEnrichProgressTimer,
      enrichFromPdf,
      generateUploadUrl,
      onUploaded,
      resetFlow,
      router,
      saveAfterUpload,
    ],
  );

  const onSubmit = useCallback(() => {
    if (!pendingFile || isBusy) return;
    void runUploadAndEnrich(pendingFile);
  }, [isBusy, pendingFile, runUploadAndEnrich]);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      setFileFromUser(f);
    },
    [setFileFromUser],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      if (isBusy) return;
      const { files } = e.dataTransfer;
      if (!files?.length) return;
      const f = Array.from(files).find(
        (x) =>
          x.type === "application/pdf" || x.name.toLowerCase().endsWith(".pdf"),
      );
      if (!f) {
        setError("Solo se admiten archivos PDF.");
        toast.error("Formato no admitido", {
          description: "Arrastra o elige un archivo .pdf",
        });
        return;
      }
      setFileFromUser(f);
    },
    [isBusy, setFileFromUser],
  );

  if (phase === "processing") {
    return (
      <div
        className={cn(
          "mx-auto flex w-full max-w-lg flex-col px-5 py-6 sm:px-6 sm:py-8",
          centered ? "items-center text-center" : "items-stretch text-left",
        )}
      >
        <div
          className={cn(
            "w-full max-w-md rounded-2xl border border-[var(--carly-border)] bg-[var(--carly-card-bg)] p-6 shadow-sm",
            centered ? "mx-auto" : "",
          )}
        >
          <div className="mb-1 flex items-center justify-center gap-2 text-[var(--carly-text)] sm:justify-start">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--carly-icon-border)] bg-[var(--carly-icon-bg)] text-violet-600 dark:text-violet-400">
              <Loader2 className="size-4 animate-spin" strokeWidth={2.5} aria-hidden />
            </span>
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
              Importando hoja de vida
            </h2>
          </div>
          <p className="mt-1 text-left text-sm text-[var(--carly-muted)]">
            Puedes seguir el progreso aquí. No cierres la pestaña.
          </p>
          <div className="mt-5 w-full min-w-0 max-w-full">
            <div className="w-full min-w-0">
              <Progress
                value={progress}
                max={100}
                className="w-full min-w-0 !flex-nowrap"
              />
            </div>
            <p className="mt-2 text-right text-xs tabular-nums text-muted-foreground">
              {Math.round(progress)}%
            </p>
          </div>
          <ul
            className="mt-4 max-h-56 space-y-2.5 overflow-y-auto text-left text-sm"
            role="log"
            aria-live="polite"
          >
            {logLines.map((line) => (
              <li
                key={line.id}
                className="flex items-start gap-2.5 text-[var(--carly-text)]"
              >
                <span className="mt-0.5 shrink-0" aria-hidden>
                  {line.done ? (
                    <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Loader2 className="size-4 animate-spin text-violet-500" />
                  )}
                </span>
                <span
                  className={cn(
                    "leading-snug",
                    line.done
                      ? "text-[var(--carly-muted)]"
                      : "font-medium text-[var(--carly-text)]",
                  )}
                >
                  {line.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-lg flex-col px-5 py-6 sm:px-6 sm:py-8",
        centered ? "items-center text-center" : "items-stretch text-left",
      )}
    >
      <div
        className={cn(
          "mb-1 flex flex-col items-center gap-2 text-[var(--carly-text)]",
          centered
            ? "w-full max-w-md flex-col sm:max-w-none sm:flex-row sm:justify-center"
            : "flex-col",
        )}
      >
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--carly-icon-border)] bg-[var(--carly-icon-bg)] text-violet-600 dark:text-violet-400">
          <Plus className="size-4" strokeWidth={2.5} aria-hidden />
        </span>
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
          Agregar hoja de vida
        </h2>
      </div>
      <p
        className={cn(
          "mb-6 text-sm leading-relaxed text-[var(--carly-muted)]",
          centered ? "sm:max-w-lg" : "max-w-none",
        )}
      >
        Sube un PDF o arrastra el archivo aquí. Luego confirma con
        <span className="whitespace-nowrap"> «Subir»</span>.
      </p>

      {phase === "fileReady" && pendingFile && !isBusy ? (
        <div
          className={cn(
            "mb-4 w-full max-w-md rounded-2xl border border-[var(--carly-border)] bg-[var(--carly-card-bg)] p-4 text-left shadow-sm",
            centered ? "mx-auto" : "",
          )}
        >
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--carly-icon-border)] bg-[var(--carly-icon-bg)] text-violet-600 dark:text-violet-400">
              <FileText className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--carly-text)]">
                {pendingFile.name}
              </p>
              <p className="text-xs text-[var(--carly-muted)]">
                {formatFileSize(pendingFile.size)} · listo para importar
              </p>
            </div>
          </div>
          <div
            className={cn(
              "mt-4 flex flex-wrap items-center gap-2",
              centered ? "justify-center sm:justify-end" : "justify-end",
            )}
          >
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-10 min-w-[6rem] items-center justify-center rounded-[10px] border border-[var(--carly-border)] bg-[var(--carly-icon-bg)] px-4 text-sm font-medium text-[var(--carly-text)] transition hover:bg-[var(--carly-row-hover)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="inline-flex min-h-10 min-w-[6rem] items-center justify-center rounded-[10px] bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500"
            >
              Subir
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "w-full",
          phase === "fileReady" && pendingFile && !isBusy ? "hidden" : "block",
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={onFileChange}
          disabled={isBusy}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-[var(--carly-card-bg)] px-4 py-12 text-center text-sm font-medium text-[var(--carly-text)] transition",
            isDragging
              ? "border-violet-500 bg-violet-50/80 dark:border-violet-400 dark:bg-violet-950/40"
              : "border-[var(--carly-border)]",
            isBusy || (phase === "fileReady" && pendingFile)
              ? "pointer-events-none hidden"
              : "hover:border-violet-400/80 hover:bg-[var(--carly-row-hover)]",
          )}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="shrink-0 text-violet-500"
            aria-hidden
          >
            <path d="M12 3v12M8 11l4 4 4-4" />
            <path d="M4 20h16" />
          </svg>
          {isDragging ? "Suelta el PDF aquí" : "Elegir PDF o arrastrar"}
        </label>
        {error ? (
          <p
            className="mt-3 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
