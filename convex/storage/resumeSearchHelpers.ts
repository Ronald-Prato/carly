/** Plain-text extraction and keyword-window search for stored resume HTML (no vectors). */

export type ResumeSearchMatchMode = "any" | "all";

export type ResumeSearchOk = {
  ok: true;
  resumeTitle: string;
  enrichmentStatus: string | null;
  downloadUrl: string | null;
  plainTextLength: number;
  snippets: { text: string; matchedTerms: string[] }[];
  matchedTerms: string[];
  missingTerms: string[];
  truncated: boolean;
  matchMode: ResumeSearchMatchMode;
};

export type ResumeSearchErr =
  | { ok: false; reason: "no_resume" }
  | {
      ok: false;
      reason: "content_not_ready";
      resumeTitle: string;
      enrichmentStatus: string | null;
      downloadUrl: string | null;
    }
  | { ok: false; reason: "empty_terms" };

const MIN_TERM_LEN = 2;
const MAX_TERM_LEN = 200;

export const resumeSearchDefaults = {
  contextChars: 150,
  maxSnippets: 15,
  mergeGap: 40,
  maxOccurrencesPerTerm: 25,
  maxTotalChars: 12_000,
} as const;

export function htmlToPlainText(html: string): string {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<\/(p|div|tr|h[1-6]|li|section|table|thead|tbody|td|th)>/gi, " ");
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/gi, " ");
  s = s.replace(/&amp;/gi, "&");
  s = s.replace(/&lt;/gi, "<");
  s = s.replace(/&gt;/gi, ">");
  s = s.replace(/&quot;/gi, '"');
  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : "";
  });
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, h) => {
    const code = parseInt(h, 16);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : "";
  });
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function findAllOccurrences(
  haystackLower: string,
  needleLower: string,
  max: number,
): number[] {
  if (needleLower.length === 0) return [];
  const out: number[] = [];
  let from = 0;
  while (out.length < max) {
    const i = haystackLower.indexOf(needleLower, from);
    if (i === -1) break;
    out.push(i);
    from = i + Math.max(1, needleLower.length);
  }
  return out;
}

type Interval = { start: number; end: number; termsLower: Set<string> };

function mergeIntervals(intervals: Interval[], mergeGap: number): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  let cur: Interval = {
    start: sorted[0]!.start,
    end: sorted[0]!.end,
    termsLower: new Set(sorted[0]!.termsLower),
  };
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (n.start <= cur.end + mergeGap) {
      cur.end = Math.max(cur.end, n.end);
      for (const t of n.termsLower) cur.termsLower.add(t);
    } else {
      out.push(cur);
      cur = { start: n.start, end: n.end, termsLower: new Set(n.termsLower) };
    }
  }
  out.push(cur);
  return out;
}

function canonicalTermForLower(
  lower: string,
  originals: Map<string, string>,
): string {
  return originals.get(lower) ?? lower;
}

export type ResumeSearchPlainResult =
  | { ok: false; reason: "empty_terms" }
  | {
      ok: true;
      snippets: { text: string; matchedTerms: string[] }[];
      matchedTerms: string[];
      missingTerms: string[];
      truncated: boolean;
      matchMode: ResumeSearchMatchMode;
    };

/**
 * Keyword windows over plain text (case-insensitive substring match).
 */
export function searchResumePlainText(
  plain: string,
  rawTerms: string[],
  options: {
    matchMode: ResumeSearchMatchMode;
    contextChars?: number;
    maxSnippets?: number;
    mergeGap?: number;
    maxOccurrencesPerTerm?: number;
    maxTotalChars?: number;
  },
): ResumeSearchPlainResult {
  const contextChars = options.contextChars ?? resumeSearchDefaults.contextChars;
  const maxSnippets = options.maxSnippets ?? resumeSearchDefaults.maxSnippets;
  const mergeGap = options.mergeGap ?? resumeSearchDefaults.mergeGap;
  const maxOccurrencesPerTerm =
    options.maxOccurrencesPerTerm ?? resumeSearchDefaults.maxOccurrencesPerTerm;
  const maxTotalChars = options.maxTotalChars ?? resumeSearchDefaults.maxTotalChars;

  const originals = new Map<string, string>();
  const seenLower = new Set<string>();
  for (const raw of rawTerms) {
    const t = raw.trim();
    if (t.length < MIN_TERM_LEN || t.length > MAX_TERM_LEN) continue;
    const low = t.toLowerCase();
    if (seenLower.has(low)) continue;
    seenLower.add(low);
    originals.set(low, t);
  }
  const termsLower = Array.from(originals.keys());
  if (termsLower.length === 0) {
    return { ok: false, reason: "empty_terms" };
  }

  const plainLower = plain.toLowerCase();
  const matchedLower = new Set<string>();
  for (const low of termsLower) {
    if (findAllOccurrences(plainLower, low, 1).length > 0) {
      matchedLower.add(low);
    }
  }
  const missingTerms = termsLower
    .filter((low) => !matchedLower.has(low))
    .map((low) => canonicalTermForLower(low, originals));
  const matchedTerms = termsLower
    .filter((low) => matchedLower.has(low))
    .map((low) => canonicalTermForLower(low, originals));

  const intervals: Interval[] = [];
  for (const low of termsLower) {
    const positions = findAllOccurrences(
      plainLower,
      low,
      maxOccurrencesPerTerm,
    );
    const needleLen = low.length;
    for (const start of positions) {
      const end = start + needleLen;
      intervals.push({
        start: Math.max(0, start - contextChars),
        end: Math.min(plain.length, end + contextChars),
        termsLower: new Set([low]),
      });
    }
  }

  if (intervals.length === 0) {
    return {
      ok: true,
      snippets: [],
      matchedTerms,
      missingTerms,
      truncated: false,
      matchMode: options.matchMode,
    };
  }

  const merged = mergeIntervals(intervals, mergeGap);
  const capped = merged.slice(0, maxSnippets);
  let truncated = merged.length > maxSnippets;

  const snippets: { text: string; matchedTerms: string[] }[] = [];
  let totalChars = 0;

  for (const iv of capped) {
    let text = plain.slice(iv.start, iv.end);
    if (iv.start > 0) text = "…" + text;
    if (iv.end < plain.length) text = text + "…";
    const matchedTermsForSnippet = Array.from(iv.termsLower)
      .map((low) => canonicalTermForLower(low, originals))
      .sort();

    if (totalChars + text.length > maxTotalChars) {
      const room = maxTotalChars - totalChars;
      if (room > 24) {
        const body = text.slice(0, room - 1) + "…";
        snippets.push({ text: body, matchedTerms: matchedTermsForSnippet });
      }
      truncated = true;
      break;
    }
    snippets.push({ text, matchedTerms: matchedTermsForSnippet });
    totalChars += text.length;
  }

  return {
    ok: true,
    snippets,
    matchedTerms,
    missingTerms,
    truncated,
    matchMode: options.matchMode,
  };
}
