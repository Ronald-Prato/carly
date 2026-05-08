/**
 * GraphQL `TOP_CARD` + `HOW_YOU_FIT_CARD` for a job posting opened from search.
 */

import {
  baseHeaders,
  linkedinCookiesFromCredentials,
  type LinkedInSessionCredentials,
  liTrackJson,
  voyagerQueryUrl,
} from "./linkedinClient";
import { buildLinkedinLogoUrlFromCompany } from "./vectorLogo";

const GRAPHQL_URL = "https://www.linkedin.com/voyager/api/graphql";

const DEFAULT_JOB_DETAIL_SECTIONS_QUERY_ID =
  "voyagerJobsDashJobPostingDetailSections.2bf6cded247cb2f6cc7dcda5558af592";

export type LinkedInTopFitCardBlock = {
  job_id: string;
  title: string | null;
  company: string | null;
  company_id: string | null;
  company_slug: string | null;
  company_url: string | null;
  location: string | null;
  geo: {
    urn: string | null;
    country_iso_code: string | null;
    abbreviated_name: string | null;
    default_name: string | null;
  } | null;
  posted_at_text: string | null;
  posted_at_epoch: number | null;
  apply_clicks_text: string | null;
  apply_clicks_count: number | null;
  application_note: string | null;
  workplace_type: string | null;
  employment_status: string | null;
  insights: string[];
  navigation_bar_subtitle: string | null;
  saved: boolean | null;
  applied: boolean | null;
  apply_cta_text: string | null;
  onsite_apply: boolean | null;
  in_page_offsite_apply: boolean | null;
  applicant_tracking_system: string | null;
  company_apply_url: string | null;
  job_state: string | null;
  created_at: number | null;
  reposted: boolean | null;
  logo_url: string | null;
  topCardLines: string[];
  howYouFitLines: string[];
  queryIdUsed: string;
  httpOk: boolean;
  semanticOk: boolean;
  note: string | null;
  source: "graphql_top_card";
};

function textViewText(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const text = (value as Record<string, unknown>).text;
  return typeof text === "string" ? text.trim() || null : null;
}

function findIncluded(
  included: unknown[],
  typeSuffix: string,
): Record<string, unknown> | null {
  for (const item of included) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (String(record.$type ?? "").endsWith(typeSuffix)) {
      return record;
    }
  }
  return null;
}

function topFitGraphqlUrl(jobId: string, queryId: string): string {
  const variables =
    `(cardSectionTypes:List(TOP_CARD,HOW_YOU_FIT_CARD),` +
    `jobPostingUrn:urn%3Ali%3Afsd_jobPosting%3A${jobId.trim()},` +
    `includeSecondaryActionsV2:true,` +
    `jobDetailsContext:(isJobSearch:true))`;
  return voyagerQueryUrl(GRAPHQL_URL, { variables, queryId });
}

function detailHeaders(jobId: string, csrfToken: string) {
  return baseHeaders(`https://www.linkedin.com/jobs/view/${jobId}/`, csrfToken, {
    "x-li-track": liTrackJson(),
  });
}

function graphqlPayloadLooksValid(payload: Record<string, unknown>): boolean {
  const raw = payload.data as unknown;
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const d = raw as Record<string, unknown>;
    if ("status" in d && typeof d.status === "number" && d.status >= 400) {
      return false;
    }
  }
  return !(Array.isArray(payload.errors) && payload.errors.length > 0);
}

function extractIncluded(payload: Record<string, unknown>): unknown[] {
  const top = payload.included;
  if (Array.isArray(top)) {
    return top;
  }

  const d = payload.data;
  if (!d || typeof d !== "object" || Array.isArray(d)) {
    return [];
  }
  const drec = d as Record<string, unknown>;
  if (Array.isArray(drec.included)) {
    return drec.included;
  }

  const inner = drec.data;
  if (!inner || typeof inner !== "object" || Array.isArray(inner)) {
    return [];
  }
  const iInc = (inner as Record<string, unknown>).included;
  return Array.isArray(iInc) ? iInc : [];
}

function includedByUrn(included: unknown[]): Map<string, Record<string, unknown>> {
  const byUrn = new Map<string, Record<string, unknown>>();
  for (const raw of included) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      continue;
    }
    const record = raw as Record<string, unknown>;
    const urn = record.entityUrn;
    if (typeof urn === "string") {
      byUrn.set(urn, record);
    }
  }
  return byUrn;
}

function epochFromTextView(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const attrs = (value as Record<string, unknown>).attributesV2;
  if (!Array.isArray(attrs)) {
    return null;
  }
  for (const attr of attrs) {
    if (!attr || typeof attr !== "object" || Array.isArray(attr)) {
      continue;
    }
    const detail = (attr as Record<string, unknown>).detailData;
    if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
      continue;
    }
    const epoch = (detail as Record<string, unknown>).epoch;
    if (!epoch || typeof epoch !== "object" || Array.isArray(epoch)) {
      continue;
    }
    const epochAt = (epoch as Record<string, unknown>).epochAt;
    if (typeof epochAt === "number") {
      return epochAt;
    }
  }
  return null;
}

function firstHyperlinkFromTextView(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const attrs = (value as Record<string, unknown>).attributesV2;
  if (!Array.isArray(attrs)) {
    return null;
  }
  for (const attr of attrs) {
    if (!attr || typeof attr !== "object" || Array.isArray(attr)) {
      continue;
    }
    const detail = (attr as Record<string, unknown>).detailData;
    if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
      continue;
    }
    const hyperlink = (detail as Record<string, unknown>).hyperlink;
    if (typeof hyperlink === "string" && hyperlink) {
      return hyperlink;
    }
  }
  return null;
}

function parseTertiaryDescription(text: string | null): {
  location_text: string | null;
  posted_at_text: string | null;
  apply_clicks_text: string | null;
  apply_clicks_count: number | null;
  application_note: string | null;
} {
  type ParsedTertiary = {
    location_text: string | null;
    posted_at_text: string | null;
    apply_clicks_text: string | null;
    apply_clicks_count: number | null;
    application_note: string | null;
  };
  const empty: ParsedTertiary = {
    location_text: null,
    posted_at_text: null,
    apply_clicks_text: null,
    apply_clicks_count: null,
    application_note: null,
  };
  if (!text) {
    return empty;
  }

  const parts = text.split(" · ").map((part) => part.trim()).filter(Boolean);
  const out = { ...empty };
  out.location_text = parts[0] ?? null;
  out.posted_at_text = parts[1] ?? null;
  if (parts.length > 2) {
    const rest = parts.slice(2).join(" · ");
    const applyMatch = rest.match(/(\d[\d.,]*)\s+personas?.*?«Solicitar»/);
    if (applyMatch?.index !== undefined) {
      out.apply_clicks_text = applyMatch[0];
      out.apply_clicks_count = Number(applyMatch[1]?.replace(/\D/g, "") ?? 0);
      const trailing = rest.slice(applyMatch.index + applyMatch[0].length).trim();
      out.application_note = trailing || null;
    } else {
      out.application_note = rest;
    }
  }
  return out;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function extractCardRefs(payload: Record<string, unknown>): {
  top: unknown[];
  fit: unknown[];
} {
  const top: unknown[] = [];
  const fit: unknown[] = [];

  const walk = (value: unknown, depth: number) => {
    if (depth > 24 || !value || typeof value !== "object") {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, depth + 1);
      }
      return;
    }

    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (key === "topCard" || key === "topCardV2" || key === "*topCardV2") {
        top.push(child);
      } else if (key === "howYouFitCard" || key === "*howYouFitCard") {
        fit.push(child);
      }
      walk(child, depth + 1);
    }
  };

  walk(payload, 0);
  return { top, fit };
}

function resolveCardValues(
  values: unknown[],
  byUrn: Map<string, Record<string, unknown>>,
): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value === "string") {
      const resolved = byUrn.get(value);
      if (resolved && !seen.has(value)) {
        seen.add(value);
        out.push(resolved);
      }
      continue;
    }
    if (value && typeof value === "object") {
      out.push(value);
    }
  }

  return out;
}

function collectDisplayLines(values: unknown[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  const push = (value: unknown) => {
    if (typeof value !== "string") {
      return;
    }
    const text = value.replace(/\s+/g, " ").trim();
    if (
      text.length < 2 ||
      text.startsWith("urn:li:") ||
      text.startsWith("com.linkedin.") ||
      /^https?:\/\//i.test(text) ||
      seen.has(text)
    ) {
      return;
    }
    seen.add(text);
    lines.push(text);
  };

  const walk = (value: unknown, depth: number, keyHint = "") => {
    if (depth > 18 || value === null || value === undefined) {
      return;
    }
    if (typeof value === "string") {
      if (
        /text|title|subtitle|headline|description|label|caption|insight|body|message/i.test(
          keyHint,
        )
      ) {
        push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, depth + 1, keyHint);
      }
      return;
    }
    if (typeof value !== "object") {
      return;
    }

    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (key === "$type" || key === "$recipeTypes" || key === "entityUrn") {
        continue;
      }
      walk(child, depth + 1, key);
    }
  };

  for (const value of values) {
    walk(value, 0);
  }
  return lines;
}

export function parseTopFitCardsFromPayload(
  payload: Record<string, unknown>,
): Pick<LinkedInTopFitCardBlock, "topCardLines" | "howYouFitLines"> {
  const byUrn = includedByUrn(extractIncluded(payload));
  const refs = extractCardRefs(payload);
  return {
    topCardLines: collectDisplayLines(resolveCardValues(refs.top, byUrn)),
    howYouFitLines: collectDisplayLines(resolveCardValues(refs.fit, byUrn)),
  };
}

function emptyTopFitBlock(
  jobId: string,
  queryId: string,
  attrs: Pick<
    LinkedInTopFitCardBlock,
    "httpOk" | "semanticOk" | "note"
  >,
): LinkedInTopFitCardBlock {
  return {
    job_id: jobId,
    title: null,
    company: null,
    company_id: null,
    company_slug: null,
    company_url: null,
    location: null,
    geo: null,
    posted_at_text: null,
    posted_at_epoch: null,
    apply_clicks_text: null,
    apply_clicks_count: null,
    application_note: null,
    workplace_type: null,
    employment_status: null,
    insights: [],
    navigation_bar_subtitle: null,
    saved: null,
    applied: null,
    apply_cta_text: null,
    onsite_apply: null,
    in_page_offsite_apply: null,
    applicant_tracking_system: null,
    company_apply_url: null,
    job_state: null,
    created_at: null,
    reposted: null,
    logo_url: null,
    topCardLines: [],
    howYouFitLines: [],
    queryIdUsed: queryId,
    httpOk: attrs.httpOk,
    semanticOk: attrs.semanticOk,
    note: attrs.note,
    source: "graphql_top_card",
  };
}

export function parseTopCardSummaryFromPayload(
  payload: Record<string, unknown>,
  jobId: string,
): Omit<
  LinkedInTopFitCardBlock,
  "queryIdUsed" | "httpOk" | "semanticOk" | "note" | "source"
> {
  const included = extractIncluded(payload);
  const byUrn = includedByUrn(included);
  const card = findIncluded(included, "JobPostingCard") ?? {};
  const posting = findIncluded(included, "JobPosting") ?? {};
  const application = findIncluded(included, "JobSeekerApplicationDetail") ?? {};
  const saveState = findIncluded(included, "SaveState") ?? {};

  const locationUrn = posting["*location"];
  const geo =
    typeof locationUrn === "string" ? byUrn.get(locationUrn) ?? null : null;

  let company = findIncluded(included, "Company") ?? {};
  if (Object.keys(company).length === 0) {
    const logo = card.logo;
    const attrs =
      logo && typeof logo === "object" && !Array.isArray(logo)
        ? (logo as Record<string, unknown>).attributes
        : null;
    if (Array.isArray(attrs)) {
      for (const attr of attrs) {
        if (!attr || typeof attr !== "object" || Array.isArray(attr)) {
          continue;
        }
        const detail = (attr as Record<string, unknown>).detailData;
        if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
          continue;
        }
        const companyUrn = (detail as Record<string, unknown>)["*companyLogo"];
        if (typeof companyUrn === "string") {
          company = byUrn.get(companyUrn) ?? {};
          break;
        }
      }
    }
  }

  const title =
    textViewText(card.title) ??
    optionalString(posting.title) ??
    optionalString(card.jobPostingTitle);
  const companyName =
    textViewText(card.primaryDescription) ?? optionalString(company.name);
  const tertiary = textViewText(card.tertiaryDescription);
  const parsedTertiary = parseTertiaryDescription(tertiary);

  const insights: string[] = [];
  const insightResults = card.jobInsightsV2ResolutionResults;
  if (Array.isArray(insightResults)) {
    for (const result of insightResults) {
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        continue;
      }
      const view = (result as Record<string, unknown>).jobInsightViewModel;
      if (!view || typeof view !== "object" || Array.isArray(view)) {
        continue;
      }
      const descriptions = (view as Record<string, unknown>).description;
      if (!Array.isArray(descriptions)) {
        continue;
      }
      for (const description of descriptions) {
        if (
          !description ||
          typeof description !== "object" ||
          Array.isArray(description)
        ) {
          continue;
        }
        const text = textViewText(
          (description as Record<string, unknown>).text,
        );
        if (text) {
          insights.push(text);
        }
      }
    }
  }

  const companyUrn = optionalString(company.entityUrn);
  const companyId = companyUrn?.split(":").at(-1) ?? null;
  const companySlug = optionalString(company.universalName);
  const companyUrl =
    firstHyperlinkFromTextView(card.primaryDescription) ??
    (companySlug
      ? `https://www.linkedin.com/company/${encodeURIComponent(companySlug)}`
      : null);
  const cards = parseTopFitCardsFromPayload(payload);

  return {
    job_id: jobId,
    title,
    company: companyName,
    company_id: companyId,
    company_slug: companySlug,
    company_url: companyUrl,
    location:
      parsedTertiary.location_text ??
      optionalString(geo?.defaultLocalizedName),
    geo: geo
      ? {
          urn: optionalString(geo.entityUrn),
          country_iso_code: optionalString(geo.countryISOCode),
          abbreviated_name: optionalString(geo.abbreviatedLocalizedName),
          default_name: optionalString(geo.defaultLocalizedName),
        }
      : null,
    posted_at_text: parsedTertiary.posted_at_text,
    posted_at_epoch: epochFromTextView(card.tertiaryDescription),
    apply_clicks_text: parsedTertiary.apply_clicks_text,
    apply_clicks_count: parsedTertiary.apply_clicks_count,
    application_note: parsedTertiary.application_note,
    workplace_type: insights[0] ?? null,
    employment_status: insights[1] ?? null,
    insights,
    navigation_bar_subtitle: optionalString(card.navigationBarSubtitle),
    saved: optionalBoolean(saveState.saved),
    applied: optionalBoolean(application.applied),
    apply_cta_text: textViewText(application.applyCtaText),
    onsite_apply: optionalBoolean(application.onsiteApply),
    in_page_offsite_apply: optionalBoolean(application.inPageOffsiteApply),
    applicant_tracking_system: optionalString(
      application.applicantTrackingSystemName,
    ),
    company_apply_url: optionalString(application.companyApplyUrl),
    job_state: optionalString(posting.jobState),
    created_at: optionalNumber(posting.createdAt),
    reposted: optionalBoolean(posting.repostedJob),
    logo_url:
      Object.keys(company).length > 0
        ? buildLinkedinLogoUrlFromCompany(company)
        : null,
    ...cards,
  };
}

export async function fetchTopFitCardGraphql(
  jobId: string,
  session: LinkedInSessionCredentials,
): Promise<LinkedInTopFitCardBlock> {
  const jid = jobId.trim();
  const queryId =
    process.env.LINKEDIN_JOB_DETAIL_QUERY_ID ??
    DEFAULT_JOB_DETAIL_SECTIONS_QUERY_ID;

  if (!/^\d+$/.test(jid)) {
    return emptyTopFitBlock(jid, queryId, {
      httpOk: false,
      semanticOk: false,
      note: null,
    });
  }

  const url = topFitGraphqlUrl(jid, queryId);
  const { cookieHeader, csrfToken } = linkedinCookiesFromCredentials(session);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      ...detailHeaders(jid, csrfToken),
      Cookie: cookieHeader,
    },
    redirect: "manual",
  });

  const rawText = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return emptyTopFitBlock(jid, queryId, {
      httpOk: response.ok,
      semanticOk: false,
      note: "Respuesta GraphQL TOP/HOW_YOU_FIT no era JSON válido.",
    });
  }

  if (!response.ok) {
    return emptyTopFitBlock(jid, queryId, {
      httpOk: false,
      semanticOk: false,
      note: `HTTP ${response.status} al obtener TOP/HOW_YOU_FIT.`,
    });
  }

  if (!graphqlPayloadLooksValid(payload)) {
    return emptyTopFitBlock(jid, queryId, {
      httpOk: true,
      semanticOk: false,
      note:
        "LinkedIn rechazó la query TOP/HOW_YOU_FIT (`data.status` o query caducado).",
    });
  }

  const summary = parseTopCardSummaryFromPayload(payload, jid);
  const hasLines =
    summary.topCardLines.length > 0 || summary.howYouFitLines.length > 0;
  const hasSummary = Boolean(
    summary.title ||
      summary.company ||
      summary.location ||
      summary.posted_at_text ||
      summary.apply_cta_text ||
      summary.company_apply_url,
  );

  return {
    ...summary,
    queryIdUsed: queryId,
    httpOk: true,
    semanticOk: hasSummary || hasLines,
    note:
      hasSummary || hasLines
        ? null
        : "No se extrajo información de TOP/HOW_YOU_FIT.",
    source: "graphql_top_card",
  };
}
