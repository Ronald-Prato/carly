import { fetchLinkedInJobPostingDetail } from "./jobPostingDetail";
import { type LinkedInJobCard, fetchLinkedInJobList } from "./jobsList";
import type { JobSearchCountryCode } from "./jobSearchOptions";
import type { LinkedInSessionCredentials } from "./linkedinClient";
import {
  type LinkedInTopFitCardBlock,
  fetchTopFitCardGraphql,
} from "./topFitCardGraphql";

export type JobsV2SearchRequest = {
  keywords: string;
  country: JobSearchCountryCode;
  limit?: number;
};

export type JobsV2SearchResult = {
  id: string;
  title: string;
  description: string;
  type: "remoto" | "presencial";
  location: string;
};

const DEFAULT_JOBS_V2_LIMIT = 50;

function normalizeEpochMs(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value < 10_000_000_000 ? value * 1000 : value;
}

function relativeDateFromText(
  text: string | null | undefined,
  now: Date,
): number | null {
  if (!text) {
    return null;
  }

  const lower = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/\b(hoy|today|just now|ahora)\b/.test(lower)) {
    return now.getTime();
  }
  if (/\b(ayer|yesterday)\b/.test(lower)) {
    return now.getTime() - 24 * 60 * 60 * 1000;
  }

  const match = lower.match(
    /(\d+)\s*(minuto|minutos|minute|minutes|min|hora|horas|hour|hours|dia|dias|day|days|semana|semanas|week|weeks|mes|meses|month|months)\b/,
  );
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "";
  if (!Number.isFinite(amount)) {
    return null;
  }

  const day = 24 * 60 * 60 * 1000;
  const multipliers: Array<[RegExp, number]> = [
    [/^(minuto|minutos|minute|minutes|min)$/, 60 * 1000],
    [/^(hora|horas|hour|hours)$/, 60 * 60 * 1000],
    [/^(dia|dias|day|days)$/, day],
    [/^(semana|semanas|week|weeks)$/, 7 * day],
    [/^(mes|meses|month|months)$/, 30 * day],
  ];
  const found = multipliers.find(([pattern]) => pattern.test(unit));
  return found ? now.getTime() - amount * found[1] : null;
}

function isInCurrentMonth(epochMs: number | null, now: Date): boolean {
  if (epochMs == null) {
    return false;
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  return epochMs >= start && epochMs < end;
}

function publishedAtMs(
  card: LinkedInJobCard,
  summary: LinkedInTopFitCardBlock | null,
  now: Date,
): number | null {
  return (
    normalizeEpochMs(summary?.posted_at_epoch) ??
    normalizeEpochMs(summary?.created_at) ??
    relativeDateFromText(summary?.posted_at_text ?? card.listedText, now)
  );
}

function normalizeWorkType(
  card: LinkedInJobCard,
  summary: LinkedInTopFitCardBlock | null,
): JobsV2SearchResult["type"] {
  const haystack = [
    summary?.workplace_type,
    summary?.navigation_bar_subtitle,
    ...card.insights,
    ...(summary?.insights ?? []),
    ...(summary?.topCardLines ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /remot|remote|home office|desde casa|teletrabajo/.test(haystack)
    ? "remoto"
    : "presencial";
}

async function readJobV2(
  card: LinkedInJobCard,
  now: Date,
  session: LinkedInSessionCredentials,
): Promise<JobsV2SearchResult | null> {
  const numericId = card.id && /^\d+$/.test(card.id) ? card.id : null;
  if (!numericId) {
    return null;
  }

  const [summary, posting] = await Promise.all([
    fetchTopFitCardGraphql(numericId, session).catch(() => null),
    fetchLinkedInJobPostingDetail(numericId, session).catch(() => null),
  ]);

  const postedAt = publishedAtMs(card, summary, now);
  if (!isInCurrentMonth(postedAt, now)) {
    return null;
  }

  return {
    id: numericId,
    title: summary?.title ?? posting?.title ?? card.title ?? "Sin título",
    description: posting?.description ?? "",
    type: normalizeWorkType(card, summary),
    location: summary?.location ?? posting?.location ?? card.location ?? "",
  };
}

export async function fetchJobsV2Search(
  request: JobsV2SearchRequest,
  session: LinkedInSessionCredentials,
): Promise<JobsV2SearchResult[]> {
  const limit = Math.min(
    Math.max(Math.floor(request.limit ?? DEFAULT_JOBS_V2_LIMIT), 1),
    100,
  );
  const cards = await fetchLinkedInJobList(
    {
      keywords: request.keywords,
      country: request.country,
      count: limit,
    },
    session,
  );
  const now = new Date();
  const enriched = await Promise.all(
    cards.slice(0, limit).map((card) => readJobV2(card, now, session)),
  );
  return enriched.filter((job): job is JobsV2SearchResult => job !== null);
}
