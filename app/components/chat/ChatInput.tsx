"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "@/app/lib/cn";

type ChatInputProps = {
  onSend: (message: string) => void;
  disabled?: boolean;
  /** Centrado vertical como coding-agent-hardness cuando no hay mensajes. */
  centered?: boolean;
  placeholder?: string;
};

const MIN_ROWS = 1;
const MAX_ROWS = 10;

export function ChatInput({
  onSend,
  disabled = false,
  centered = false,
  placeholder = "Pregúntale a Carly sobre tu hoja de vida…",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const styles = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 22;
    const verticalPadding =
      Number.parseFloat(styles.paddingTop) +
      Number.parseFloat(styles.paddingBottom);
    const verticalBorder =
      Number.parseFloat(styles.borderTopWidth) +
      Number.parseFloat(styles.borderBottomWidth);
    const maxHeight = lineHeight * MAX_ROWS + verticalPadding + verticalBorder;
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [message]);

  function send() {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div
      className={cn(
        "motion-composer-shell z-10 mx-auto flex w-full max-w-[900px] flex-col gap-1.5 px-5 pb-4 pt-3",
        centered &&
          "absolute top-[48%] left-1/2 max-w-[min(720px,calc(100%-48px))] -translate-x-1/2 -translate-y-1/2 border-t-0 pt-0",
      )}
    >
      <form
        onSubmit={onSubmit}
        className="relative m-0 flex w-full flex-col gap-1 rounded-xl border border-[var(--carly-agent-composer-border)] bg-[var(--carly-agent-composer-bg)] py-1 pl-2 pr-1.5 pt-1.5 shadow-[inset_0_0_0_1px_var(--carly-agent-composer-inset)] motion-safe:transition-[border-color,box-shadow] motion-safe:duration-200"
        onMouseDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("button") || target === textareaRef.current) return;
          queueMicrotask(() => textareaRef.current?.focus());
        }}
      >
        <label htmlFor="carly-chat-input" className="sr-only">
          Escribe un mensaje
        </label>
        <textarea
          id="carly-chat-input"
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={MIN_ROWS}
          autoComplete="off"
          className="min-h-10 w-full resize-none border-0 bg-transparent px-3 pt-2 pb-2 font-[inherit] text-[15px] leading-[1.45] text-[var(--carly-agent-text)] placeholder:text-[var(--carly-agent-text-muted)] placeholder:opacity-70 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
        />
        <div className="m-0 mt-0 flex items-end justify-between gap-1.5 pb-px pl-1 pr-0.5">
          <span className="min-w-0 flex-1 text-[11px] text-[var(--carly-agent-text-muted)] sm:text-xs">
            Enter envía · Shift+Enter nueva línea
          </span>
          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className="ml-auto inline-grid h-[30px] w-[30px] flex-none shrink-0 cursor-pointer place-items-center self-end rounded-full border-0 bg-[var(--carly-agent-send-bg)] p-0 text-[var(--carly-agent-send-fg)] motion-safe:transition-[background-color,transform] motion-safe:duration-150 hover:enabled:bg-[var(--carly-agent-send-hover)] active:enabled:scale-95 disabled:cursor-not-allowed disabled:opacity-[0.42]"
            aria-label="Enviar mensaje"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-[15px] w-[15px]"
              aria-hidden
            >
              <path
                d="M10 15V5M5.75 9.25 10 5l4.25 4.25"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
