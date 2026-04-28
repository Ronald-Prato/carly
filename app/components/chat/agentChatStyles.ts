/** Estilos del panel de chat (grises neutros; tokens en `globals.css`). */

export const agentScrollSurface =
  "[scrollbar-color:var(--carly-agent-scroll-thumb)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[var(--carly-agent-scroll-thumb)] [&::-webkit-scrollbar-thumb:hover]:bg-[var(--carly-agent-scroll-thumb-hover)]";

/** Tipografía Markdown compartida (chat asistente y usuario): jerarquía clara y aire entre bloques */
export const agentChatMarkdownProse =
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-[var(--carly-agent-link)] [&_a]:underline-offset-2 hover:[&_a]:underline [&_blockquote]:my-[0.85em] [&_blockquote]:border-l-[3px] [&_blockquote]:border-[var(--carly-agent-blockquote-border)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--carly-agent-text-muted)] [&_code]:rounded-[5px] [&_code]:border [&_code]:border-[var(--carly-agent-code-border)] [&_code]:bg-[var(--carly-agent-code-bg)] [&_code]:px-[0.35em] [&_code]:py-[0.1em] [&_code]:font-mono [&_code]:text-[0.92em] [&_code]:text-[var(--carly-agent-code-text)] [&_h1]:mt-[1em] [&_h1]:mb-[0.55em] [&_h1]:text-[1.55rem] [&_h1]:font-semibold [&_h1]:leading-[1.25] [&_h1]:tracking-tight [&_h1]:text-[var(--carly-agent-text)] [&_h2]:mt-[0.95em] [&_h2]:mb-[0.5em] [&_h2]:text-[1.35rem] [&_h2]:font-semibold [&_h2]:leading-[1.28] [&_h2]:tracking-tight [&_h2]:text-[var(--carly-agent-text)] [&_h3]:mt-[0.85em] [&_h3]:mb-[0.45em] [&_h3]:text-[1.2rem] [&_h3]:font-semibold [&_h3]:leading-[1.32] [&_h3]:text-[var(--carly-agent-text)] [&_h4]:mt-[0.8em] [&_h4]:mb-[0.4em] [&_h4]:text-[1.08rem] [&_h4]:font-semibold [&_h4]:leading-[1.35] [&_h4]:text-[var(--carly-agent-text)] [&_h5]:mt-[0.75em] [&_h5]:mb-[0.35em] [&_h5]:text-[1rem] [&_h5]:font-semibold [&_h6]:mt-[0.7em] [&_h6]:mb-[0.35em] [&_h6]:text-[0.95rem] [&_h6]:font-semibold [&_hr]:my-[1.1em] [&_hr]:border-[var(--carly-agent-blockquote-border)] [&_li]:my-[0.35em] [&_li]:text-[15px] [&_li]:leading-[1.72] [&_li]:pl-[0.2em] [&_ol]:my-[0.85em] [&_ol]:list-decimal [&_ol]:pl-[1.5em] [&_p]:my-[0.8em] [&_p]:text-[15px] [&_p]:leading-[1.72] [&_strong]:font-semibold [&_ul]:my-[0.85em] [&_ul]:list-disc [&_ul]:pl-[1.5em] [&_em]:italic [&_table]:my-[0.85em] [&_table]:w-full [&_table]:border-collapse [&_table]:text-[15px] [&_th]:border [&_th]:border-[var(--carly-agent-code-border)] [&_th]:bg-[color-mix(in_srgb,var(--carly-agent-code-bg)_85%,transparent)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-[var(--carly-agent-code-border)] [&_td]:px-2 [&_td]:py-1 [&_thead]:border [&_thead]:border-[var(--carly-agent-code-border)] [&_thead]:bg-[var(--carly-agent-code-bg)]";

export const agentMessageAssistant =
  "assistant-markdown w-full max-w-full self-start rounded-none border-0 bg-transparent p-0 text-[15px] leading-[1.72] text-[var(--carly-agent-text)] motion-safe:transition-[opacity,transform,box-shadow] motion-safe:duration-200 motion-safe:ease-out " +
  agentChatMarkdownProse;

/** Markdown en burbuja usuario: `text-left` dentro de la bubble (la fila alinea la bubble con `justify-end` en ChatMessage). */
export const agentMessageUser =
  agentChatMarkdownProse +
  " min-w-0 w-full max-w-full text-left [&_blockquote]:border-l-[3px] [&_blockquote]:border-r-0 [&_blockquote]:pl-3 [&_blockquote]:pr-0 [&_p]:!my-0 [&_p+p]:mt-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full";

export const agentMessageAssistantStreaming = "opacity-95";
