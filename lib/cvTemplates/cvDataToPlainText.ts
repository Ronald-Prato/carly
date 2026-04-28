import type {
  CvData,
  CvSection,
  EntryListItem,
  SectionShape,
} from "./types";

function lines(...parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p != null && String(p).trim() !== "").join("\n");
}

function entryItemToText(item: EntryListItem): string {
  const head = lines(
    item.headline,
    item.subheadline,
    [item.dateRange, item.location].filter(Boolean).join(" · "),
  );
  const bullets =
    item.bullets?.map((b) => `• ${b}`).join("\n") ?? "";
  const desc = item.description?.trim() ?? "";
  return lines(head, bullets, desc);
}

function sectionToText<S extends SectionShape>(section: CvSection<S>): string {
  if (section.visible === false) {
    return "";
  }
  const title = section.title.trim();
  const hint = section.semanticHint?.trim();
  const header = hint ? `${title} (${hint})` : title;
  const p = section.payload as Record<string, unknown>;

  switch (section.shape) {
    case "paragraph": {
      const text = typeof p.text === "string" ? p.text.trim() : "";
      return lines(header, text);
    }
    case "tag_list": {
      const items = Array.isArray(p.items)
        ? (p.items as unknown[]).filter((x) => typeof x === "string")
        : [];
      return lines(header, items.join(", "));
    }
    case "entry_list": {
      const items = Array.isArray(p.items) ? (p.items as EntryListItem[]) : [];
      const body = items.map((it) => entryItemToText(it)).join("\n\n");
      return lines(header, body);
    }
    case "key_value": {
      const items = Array.isArray(p.items)
        ? (p.items as { key?: string; value?: string }[])
        : [];
      const rows = items
        .map((kv) => {
          const k = kv.key?.trim() ?? "";
          const v = kv.value?.trim() ?? "";
          return k && v ? `${k}: ${v}` : k || v;
        })
        .filter(Boolean);
      return lines(header, rows.join("\n"));
    }
    case "media_grid": {
      const items = Array.isArray(p.items)
        ? (p.items as { title?: string; description?: string }[])
        : [];
      const body = items
        .map((it) =>
          lines(it.title, it.description?.trim() ?? ""),
        )
        .filter((s) => s.length > 0)
        .join("\n\n");
      return lines(header, body);
    }
    default:
      return "";
  }
}

/** Texto legible único construido solo desde `CvData` (no HTML ni `content` legacy). */
export function cvDataToPlainText(data: CvData): string {
  const b = data.basics;
  const basicsBlock = lines(
    b.name.trim(),
    b.headline,
    [b.email, b.phone, b.location].filter(Boolean).join(" · "),
    b.links
      ?.map((l) => `${l.label}${l.url ? ` — ${l.url}` : ""}`)
      .join("\n"),
  );

  const sections = data.sections
    .map((s) => sectionToText(s))
    .filter((s) => s.trim().length > 0)
    .join("\n\n---\n\n");

  return lines("=== Datos personales ===", basicsBlock, "=== CV ===", sections);
}
