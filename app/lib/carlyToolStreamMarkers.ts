/** Marcadores en el stream de texto para registrar llamadas a herramientas (no visibles al modelo si se eliminan antes de persistir). */

const STX = "\u0002";
const CARLY_TOOL_FRAME = `${STX}CARLY_TOOL${STX}`;

const MARKER_RE = new RegExp(`${STX}CARLY_TOOL${STX}([^${STX}]*)${STX}`, "g");

export type CarlyStreamSegment =
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string };

/** Divide el contenido del asistente en texto y entradas de log de herramientas (durante el stream). */
export function segmentsFromAssistantContent(
  content: string,
): CarlyStreamSegment[] {
  const segments: CarlyStreamSegment[] = [];
  let last = 0;
  MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER_RE.exec(content)) !== null) {
    if (m.index > last) {
      const t = content.slice(last, m.index);
      if (t.length > 0) {
        segments.push({ kind: "text", text: t });
      }
    }
    try {
      const j = JSON.parse(m[1] ?? "{}") as { n?: unknown };
      if (typeof j.n === "string" && j.n.length > 0) {
        segments.push({ kind: "tool", name: j.n });
      }
    } catch {
      /* ignore */
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    const t = content.slice(last);
    if (t.length > 0) {
      segments.push({ kind: "text", text: t });
    }
  }
  return segments;
}

export function encodeCarlyToolMarker(toolName: string): string {
  const payload = JSON.stringify({ n: toolName });
  return `${CARLY_TOOL_FRAME}${payload}${STX}`;
}

export function stripCarlyToolMarkers(text: string): string {
  return text.replace(MARKER_RE, "");
}

/** Etiquetas cortas en español para el log en la conversación. */
export function getCarlyToolLogLabel(toolName: string): string {
  switch (toolName) {
    case "search_resume_by_keywords":
      return "Buscaste en tu CV";
    case "fetch_user_resume_record":
      return "Consultaste tu CV";
    case "update_conversation_resume_draft":
      return "Se actualizó tu CV";
    default:
      return `Ejecutaste la tarea «${toolName}»`;
  }
}

/** Nombre interno de la herramienta desde un `RunItem` del SDK (evento `tool_called`). */
export function toolCallNameFromRunStreamItem(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  if (o.type !== "tool_call_item") return null;
  const raw = o.rawItem;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.type === "function_call" && typeof r.name === "string") {
    return r.name;
  }
  const content = r.content;
  if (!Array.isArray(content)) return null;
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const p = part as Record<string, unknown>;
    if (p.type === "function_call" && typeof p.name === "string") {
      return p.name;
    }
    if (p.type === "hosted_tool_call" && typeof p.name === "string") {
      return p.name;
    }
  }
  return null;
}
