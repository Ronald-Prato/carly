"use client";

import type { ReactNode, RefObject } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Tooltip fijado al viewport; se muestra en cuanto `open` es true (sin delay del `title` nativo). */
export function PointerTooltipPortal({
  text,
  open,
  anchorRef,
}: {
  text: string;
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const syncPosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const idealCenter = r.left + r.width / 2;
    const margin = 8;
    const clampedLeft = Math.max(margin, Math.min(vw - margin, idealCenter));
    setPos({ left: clampedLeft, top: r.top });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    syncPosition();
  }, [open, syncPosition]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => syncPosition();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, syncPosition]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        transform: "translate(-50%, calc(-100% - 10px))",
        zIndex: 10000,
      }}
      className={cn(
        "pointer-events-none w-max max-w-[min(280px,calc(100vw-2rem))]",
        "rounded-md border border-slate-700/90 bg-slate-900 px-2.5 py-1.5 text-center text-[11px] leading-snug font-normal text-white shadow-xl",
        "dark:border-zinc-600 dark:bg-zinc-800",
      )}
    >
      {text}
    </div>,
    document.body,
  );
}

type HoverTooltipProps = {
  content: string;
  children: ReactNode;
} & Omit<
  React.ComponentPropsWithoutRef<"div">,
  "children" | "title"
>;

/**
 * Envuelve un bloque y muestra `content` en un portal al pasar el foco o el ratón, sin demora.
 */
export function HoverTooltip({
  content,
  children,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...rest
}: HoverTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        ref={ref}
        {...rest}
        onMouseEnter={(e) => {
          setOpen(true);
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          setOpen(false);
          onMouseLeave?.(e);
        }}
        onFocus={(e) => {
          setOpen(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setOpen(false);
          onBlur?.(e);
        }}
      >
        {children}
      </div>
      <PointerTooltipPortal text={content} open={open} anchorRef={ref} />
    </>
  );
}
