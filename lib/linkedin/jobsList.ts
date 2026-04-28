/**
 * Lista de tarjetas de búsqueda LinkedIn (Voyager) — mirror de jobs_list.py
 */

import {
  assertOkLinkedIn,
  baseHeaders,
  linkedinCookiesOrThrow,
  liTrackJson,
  voyagerQueryUrl,
} from "./linkedinClient";
import {
  type JobSearchCountryCode,
  type JobSearchCountryOption,
  resolveCountry,
  sanitizeJobKeywords,
} from "./jobSearchOptions";

const JOBS_URL = "https://www.linkedin.com/voyager/api/voyagerJobsDashJobCards";

/** Valores por defecto de UI / API cuando no pasas nada. */
export const DEFAULT_JOB_SEARCH_DEFAULTS = {
  keywords: "",
  country: "co" as JobSearchCountryCode,
};

/** Construye el parámetro `query` Voyager compatible con LinkedIn Jobs. */
export function buildJobListParams(
  keywordsRaw: string,
  countryOpt: JobSearchCountryOption,
  count = 5,
  start = 0,
): Record<string, string> {
  const keywords = sanitizeJobKeywords(keywordsRaw);
  const safeCount = Math.min(Math.max(Math.floor(count), 1), 100);
  const safeStart = Math.max(Math.floor(start), 0);
  const loc = countryOpt.locationLabel;
  // Sintaxis igual a jobs_list.py: dos `)` tras el país antes de la coma (~Colombia)),…
  const query =
    "(origin:JOB_SEARCH_PAGE_OTHER_ENTRY," +
    `keywords:${keywords},` +
    `locationUnion:(seoLocation:(location:${loc})),` +
    "spellCorrectionEnabled:true)";
  return {
    decorationId:
      "com.linkedin.voyager.dash.deco.jobs.search.JobSearchCardsCollection-220",
    count: String(safeCount),
    q: "jobSearch",
    query,
    start: String(safeStart),
  };
}

function jobSearchRefererUrl(
  keywordsRaw: string,
  countryOpt: JobSearchCountryOption,
): string {
  const keywords = sanitizeJobKeywords(keywordsRaw);
  const params = new URLSearchParams();
  params.set("keywords", keywords);
  params.set("location", countryOpt.locationLabel);
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

export type JobSearchRequest = {
  keywords: string;
  country: JobSearchCountryCode;
  count: number;
  start: number;
};

const JOB_ID_RE =
  /(?:jobPosting:|fsd_jobPosting:|jobPostingCard%3A%28)(\d+)/g;

function textValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if (typeof o.text === "string") {
      return o.text;
    }
    if (o.title !== undefined) {
      return textValue(o.title);
    }
  }
  return null;
}

/** First string under keys matching `hint` (salary, posted time, etc.). */
function findStringByKeyHint(
  obj: unknown,
  hint: RegExp,
  depth = 0,
): string | null {
  if (depth > 18 || obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const r = findStringByKeyHint(x, hint, depth + 1);
      if (r) {
        return r;
      }
    }
    return null;
  }
  if (typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      if (hint.test(k)) {
        const t =
          textValue(v) ??
          (typeof v === "string" && !v.startsWith("urn:li:") ? v : null);
        if (t?.trim()) {
          return t.trim();
        }
      }
    }
    for (const v of Object.values(o)) {
      const r = findStringByKeyHint(v, hint, depth + 1);
      if (r) {
        return r;
      }
    }
  }
  return null;
}

const LOGO_URL_RE =
  /https:\/\/[^"'\s]+(?:media\.licdn\.com|\.linkedin\.com\/[^"'\s]*logo)[^"'\s]*/i;

function findLogoUrl(obj: unknown, depth = 0): string | null {
  if (depth > 16) {
    return null;
  }
  if (typeof obj === "string") {
    const m = obj.match(LOGO_URL_RE);
    return m ? m[0] : null;
  }
  if (!obj || typeof obj !== "object") {
    return null;
  }
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const u = findLogoUrl(x, depth + 1);
      if (u) {
        return u;
      }
    }
    return null;
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const u = findLogoUrl(v, depth + 1);
    if (u) {
      return u;
    }
  }
  return null;
}

/**
 * Líneas extra del mismo payload de tarjetas (insights, pies, captions),
 * sin recorrer toda la respuesta Voyager para evitar duplicados.
 */
function collectCardExtraLines(
  card: Record<string, unknown>,
  exclude: Set<string>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (s: string | null | undefined) => {
    const t = s?.trim();
    if (!t || t.length < 2) {
      return;
    }
    if (t.startsWith("urn:li:")) {
      return;
    }
    if (exclude.has(t) || seen.has(t)) {
      return;
    }
    seen.add(t);
    out.push(t);
  };

  push(textValue(card.tertiarySubtitle));

  const walkDecoratedSubtree = (obj: unknown, depth: number, path: string): void => {
    if (depth > 14 || obj === null || obj === undefined) {
      return;
    }
    const pathLower = path.toLowerCase();
    const prefer =
      /footer|insight|caption|metadata|snippet|subtitle|emphasized|decorated|pill|badge|reason|benefit|poster|subtitle/i.test(
        pathLower,
      );

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        walkDecoratedSubtree(obj[i], depth + 1, `${path}[${i}]`);
      }
      return;
    }
    if (typeof obj !== "object") {
      return;
    }
    const o = obj as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (text.length > 0 && (prefer || o.attributesV2 !== undefined)) {
      push(text);
    }
    if (typeof o.accessibilityText === "string" && prefer) {
      push(o.accessibilityText);
    }

    for (const [k, v] of Object.entries(o)) {
      walkDecoratedSubtree(v, depth + 1, `${path}.${k}`);
    }
  };

  for (const key of [
    "jobPostingFooter",
    "footerItems",
    "footer",
    "insightCards",
    "insights",
    "jobPostingInsights",
    "caption",
    "primaryDescription",
    "secondaryDescription",
  ]) {
    if (key in card) {
      walkDecoratedSubtree(card[key], 0, key);
    }
  }

  return out;
}

export type LinkedInJobCard = {
  id: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  url: string | null;
  /** Líneas extra de la tarjeta (Easy Apply, hace X días, promocionado, etc.). */
  insights: string[];
  /** Texto de sueldo / compensación si viene en la tarjeta. */
  salarySnippet: string | null;
  /** Fecha relativa o descriptor de publicación si existe. */
  listedText: string | null;
  /** URL de logo de empresa si está en el payload. */
  logoUrl: string | null;
};

function enrichCard(
  record: Record<string, unknown>,
  base: {
    id: string | null;
    title: string | null;
    company: string | null;
    location: string | null;
    url: string | null;
  },
): LinkedInJobCard {
  const exclude = new Set(
    [base.title, base.company, base.location].filter(Boolean) as string[],
  );

  const salarySnippet =
    findStringByKeyHint(
      record,
      /salary|compensation|payRange|baseSalary|pay_range/i,
    ) ?? null;

  const listedText =
    findStringByKeyHint(
      record,
      /listedAt|listed|posted|jobAge|timePosted|postedDate|createdAt/i,
    ) ?? null;

  const logoUrl = findLogoUrl(record);

  const insights = collectCardExtraLines(record, exclude)
    .filter((line) => line !== salarySnippet && line !== listedText)
    .slice(0, 12);

  return {
    ...base,
    insights,
    salarySnippet,
    listedText,
    logoUrl,
  };
}

function findJobs(payload: unknown): LinkedInJobCard[] {
  const jobs: LinkedInJobCard[] = [];
  const seen = new Set<string>();

  function walk(obj: unknown): void {
    if (obj && typeof obj === "object") {
      if (Array.isArray(obj)) {
        for (const item of obj) {
          walk(item);
        }
        return;
      }
      const record = obj as Record<string, unknown>;
      const urnish = Object.values(record)
        .filter((v) => typeof v === "string")
        .join(" ");
      if (urnish.includes("jobPosting") || urnish.includes("fsd_jobPosting")) {
        const raw = JSON.stringify(obj);
        JOB_ID_RE.lastIndex = 0;
        let jobId: string | null = null;
        let m = JOB_ID_RE.exec(raw);
        if (m) {
          jobId = m[1];
        }

        const title =
          textValue(record.title) ??
          textValue(record.jobTitle) ??
          textValue(record.headline);

        const company =
          textValue(record.companyName) ??
          textValue(record.primarySubtitle) ??
          textValue(record.subtitle);

        const location =
          textValue(record.formattedLocation) ??
          textValue(record.secondarySubtitle) ??
          textValue(record.location);

        const key = jobId ?? raw.slice(0, 300);
        if ((jobId ?? title) && !seen.has(key)) {
          seen.add(key);
          const base = {
            id: jobId,
            title,
            company,
            location,
            url: jobId
              ? `https://www.linkedin.com/jobs/view/${jobId}`
              : null,
          };
          jobs.push(enrichCard(record, base));
        }
      }
      for (const value of Object.values(record)) {
        walk(value);
      }
    }
  }

  walk(payload);
  return jobs;
}

function listHeaders(csrfToken: string, referer: string): Record<string, string> {
  return baseHeaders(referer, csrfToken, {
    "x-li-deco-include-micro-schema": "true",
    "x-li-page-instance":
      "urn:li:page:d_flagship3_search_srp_jobs;V/PjXZzNTtq6Co870M01Rg==",
    "x-li-track": liTrackJson(),
  });
}

/** Descarga tarjetas de empleos. Solo servidor — cookies desde env. */
export async function fetchLinkedInJobList(
  opts: Partial<JobSearchRequest> = {},
): Promise<LinkedInJobCard[]> {
  const countryOpt = resolveCountry(
    opts.country ?? DEFAULT_JOB_SEARCH_DEFAULTS.country,
  );
  const params = buildJobListParams(
    opts.keywords ?? "",
    countryOpt,
    opts.count,
    opts.start,
  );
  const referer = jobSearchRefererUrl(opts.keywords ?? "", countryOpt);
  const { cookieHeader, csrfToken } = linkedinCookiesOrThrow();
  const url = voyagerQueryUrl(JOBS_URL, params);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      ...listHeaders(csrfToken, referer),
      Cookie: cookieHeader,
    },
    redirect: "manual",
  });
  await assertOkLinkedIn(response, url);
  const payload = (await response.json()) as unknown;
  return findJobs(payload);
}
