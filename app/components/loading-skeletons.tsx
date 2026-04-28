import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Alineado con cada fila de `AppSidebar` (cuadrado tipo icon-box + una línea de título). */
const CONVERSATION_SKELETON_ROWS = 7;
/** Anchuras relativas por fila para que no parezcan todas iguales. */
const TITLE_LINE_MAX_WIDTH: readonly string[] = [
  "max-w-[94%]",
  "max-w-[78%]",
  "max-w-[86%]",
  "max-w-[71%]",
  "max-w-[90%]",
  "max-w-[65%]",
  "max-w-[82%]",
];

export function ConversationListSkeleton({
  className,
  compact = false,
}: {
  className?: string;
  /** Rail solo íconos: mismo patrón que conversaciones sin título visible. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        className={cn("flex flex-col items-center px-2 py-2", className)}
        role="status"
        aria-label="Cargando conversaciones"
      >
        {Array.from({ length: CONVERSATION_SKELETON_ROWS }).map((_, index) => (
          <div
            key={index}
            className="mb-0.5 flex w-full min-w-0 justify-center px-2 py-2.5"
          >
            <Skeleton
              className="size-9 shrink-0 rounded-[10px]"
              aria-hidden
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-0", className)}
      role="status"
      aria-label="Cargando conversaciones"
    >
      {Array.from({ length: CONVERSATION_SKELETON_ROWS }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "mb-0.5 flex w-full min-w-0 items-center gap-0.5 rounded-[12px] pl-1 pr-1.5 text-sm",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5 py-2.5 pl-2 pr-0">
            <Skeleton
              className="size-9 shrink-0 rounded-[10px]"
              aria-hidden
            />
            <div className="min-w-0 flex-1 pt-px">
              <Skeleton
                className={cn(
                  "h-4 rounded-md",
                  TITLE_LINE_MAX_WIDTH[index % TITLE_LINE_MAX_WIDTH.length],
                )}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Barra superior de hoja de vida mientras carga. */
export function ResumeHeaderSkeleton() {
  return (
    <div
      className="shrink-0 border-b border-[var(--carly-border)] bg-[var(--carly-page-bg)] px-6 py-4"
      role="status"
      aria-label="Cargando hoja de vida"
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-44 max-w-full rounded-md" />
        <Skeleton className="h-3.5 w-[min(100%,20rem)] rounded-md" />
        <div className="flex flex-wrap gap-2 pt-1">
          <Skeleton className="h-8 w-28 rounded-[10px]" />
          <Skeleton className="h-8 w-32 rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}

/** Área de mensajes vacía mientras aún se resuelve el CV. */
export function ChatResumeLoadingSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col gap-3 py-1"
      role="status"
      aria-label="Cargando hoja de vida"
    >
      <Skeleton className="h-3.5 w-full rounded-md" />
      <Skeleton className="h-3.5 w-4/5 rounded-md" />
      <Skeleton className="h-3.5 w-3/5 rounded-md" />
    </div>
  );
}

/** Bloque Cuenta en la barra lateral mientras carga el usuario de Convex. */
export function AccountCardSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 rounded-[10px] border border-[var(--carly-border)] bg-[var(--carly-icon-bg)] px-3 py-3"
      role="status"
      aria-label="Cargando cuenta"
    >
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-[min(100%,12rem)] flex-1 rounded-md" />
        <Skeleton className="size-8 shrink-0 rounded-full" />
      </div>
      <Skeleton className="h-3 w-48 max-w-full rounded-md" />
      <Skeleton className="h-2.5 w-32 rounded-md opacity-80" />
    </div>
  );
}
