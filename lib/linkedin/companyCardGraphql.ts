/**
 * GraphQL `COMPANY_CARD` (equivalente a `python main.py get_job_v2 --jobid`).
 * Misma queryId que `JOB_DESCRIPTION_CARD` pero `cardSectionTypes=List(COMPANY_CARD)`.
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

/** Mismo default que `job_detail.DEFAULT_GRAPHQL_QUERY_ID` en Python. */
const DEFAULT_JOB_DETAIL_SECTIONS_QUERY_ID =
  "voyagerJobsDashJobPostingDetailSections.2bf6cded247cb2f6cc7dcda5558af592";

export type LinkedInCompanyCardSummary = {
  company_name: string | null;
  industry: string | null;
  employee_count_range: string | null;
  followers: number | null;
  description: string | null;
  linkedin_url: string | null;
  logo_url: string | null;
};

export type LinkedInCompanyCardBlock = {
  summary: LinkedInCompanyCardSummary | null;
  queryIdUsed: string;
  httpOk: boolean;
  semanticOk: boolean;
  note: string | null;
};

function graphqlPayloadLooksValid(payload: Record<string, unknown>): boolean {
  const raw = payload.data as unknown;
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const d = raw as Record<string, unknown>;
    if ("status" in d && typeof d.status === "number" && d.status >= 400) {
      return false;
    }
  }
  const topErr = payload.errors;
  if (Array.isArray(topErr) && topErr.length > 0) {
    return false;
  }
  return true;
}

function companyCardGraphqlUrl(jobId: string, queryId: string): string {
  const variables =
    `(cardSectionTypes:List(COMPANY_CARD),` +
    `jobPostingUrn:urn%3Ali%3Afsd_jobPosting%3A${jobId.trim()},` +
    `includeSecondaryActionsV2:true)`;
  /** En Python `get_job_v2` NO envía `includeWebMetadata`. */
  return voyagerQueryUrl(GRAPHQL_URL, { variables, queryId });
}

function detailHeaders(jobId: string, csrfToken: string) {
  return baseHeaders(`https://www.linkedin.com/jobs/view/${jobId}/`, csrfToken, {
    "x-li-track": liTrackJson(),
  });
}

function findCompanyEntity(
  included: unknown[],
): Record<string, unknown> | null {
  for (const raw of included) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      continue;
    }
    const o = raw as Record<string, unknown>;
    const t = String(o.$type ?? "");
    if (t.endsWith(".organization.Company")) {
      return o;
    }
  }
  return null;
}

function resolveIndustryName(
  included: unknown[],
  company: Record<string, unknown>,
): string | null {
  const rawTax = company["*industryV2Taxonomy"] ?? company.industryV2Taxonomy;
  const urn =
    typeof rawTax === "string"
      ? rawTax
      : Array.isArray(rawTax) && rawTax.length > 0
        ? String(rawTax[0])
        : null;
  if (!urn) {
    return null;
  }
  for (const raw of included) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      continue;
    }
    const o = raw as Record<string, unknown>;
    const t = String(o.$type ?? "");
    if (!t.includes("IndustryV2")) {
      continue;
    }
    if (String(o.entityUrn ?? "") === urn && typeof o.name === "string") {
      return o.name.trim();
    }
  }
  return null;
}

function resolveFollowerCount(
  included: unknown[],
  company: Record<string, unknown>,
): number | null {
  const fsUrn = company["*followingState"];
  if (typeof fsUrn === "string") {
    for (const raw of included) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        continue;
      }
      const o = raw as Record<string, unknown>;
      if (
        String(o.entityUrn ?? "") === fsUrn &&
        typeof o.followerCount === "number"
      ) {
        return o.followerCount;
      }
    }
  }

  for (const raw of included) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      continue;
    }
    const o = raw as Record<string, unknown>;
    const t = String(o.$type ?? "");
    if (t.includes("FollowingState") && typeof o.followerCount === "number") {
      return o.followerCount;
    }
  }
  return null;
}

/** Voyager a veces pone `included` en raíz; otras, bajo `data` / `data.data`. */
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
  const dInc = drec.included;
  if (Array.isArray(dInc)) {
    return dInc;
  }

  const inner = drec.data;
  if (!inner || typeof inner !== "object" || Array.isArray(inner)) {
    return [];
  }
  const iInc = (inner as Record<string, unknown>).included;
  return Array.isArray(iInc) ? iInc : [];
}

function employeeCountRangeText(company: Record<string, unknown>): string | null {
  const r = company.employeeCountRange;
  if (!r || typeof r !== "object") {
    return null;
  }
  const rg = r as Record<string, unknown>;
  const start = rg.start;
  const end = rg.end;
  if (typeof start === "number" && typeof end === "number") {
    return `${start}-${end}`;
  }
  return null;
}

function linkedinCompanyUrl(company: Record<string, unknown>): string | null {
  const name = typeof company.universalName === "string" ? company.universalName.trim() : "";
  if (!name) {
    return null;
  }
  return `https://www.linkedin.com/company/${encodeURIComponent(name)}`;
}

export function parseCompanySummaryFromIncluded(
  includedRaw: unknown,
): LinkedInCompanyCardSummary | null {
  if (!Array.isArray(includedRaw) || includedRaw.length === 0) {
    return null;
  }
  const company = findCompanyEntity(includedRaw);
  if (!company) {
    return null;
  }

  const cn =
    typeof company.name === "string" ? company.name.trim() : null;
  const description =
    typeof company.description === "string" ? company.description.trim() : null;
  const industry = resolveIndustryName(includedRaw, company);
  const followers = resolveFollowerCount(includedRaw, company);
  const employee_count_range = employeeCountRangeText(company);
  const logo_url = buildLinkedinLogoUrlFromCompany(company);
  const linkedin_url = linkedinCompanyUrl(company);

  return {
    company_name: cn,
    industry,
    employee_count_range,
    followers,
    description,
    linkedin_url,
    logo_url,
  };
}

/** Respuesta COMPANY_CARD desde `/voyager/api/graphql`; sin `includeWebMetadata` (Python). */
export async function fetchCompanyCardGraphql(
  jobId: string,
  session: LinkedInSessionCredentials,
): Promise<LinkedInCompanyCardBlock> {
  const jid = jobId.trim();
  const queryId =
    process.env.LINKEDIN_JOB_DETAIL_QUERY_ID ??
    DEFAULT_JOB_DETAIL_SECTIONS_QUERY_ID;

  if (!/^\d+$/.test(jid)) {
    return {
      summary: null,
      queryIdUsed: queryId,
      httpOk: false,
      semanticOk: false,
      note: null,
    };
  }

  const url = companyCardGraphqlUrl(jid, queryId);
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
    return {
      summary: null,
      queryIdUsed: queryId,
      httpOk: response.ok,
      semanticOk: false,
      note: "Respuesta GraphQL COMPANY_CARD no era JSON válido.",
    };
  }

  if (!response.ok) {
    return {
      summary: null,
      queryIdUsed: queryId,
      httpOk: false,
      semanticOk: false,
      note: `HTTP ${response.status} al obtener COMPANY_CARD.`,
    };
  }

  if (!graphqlPayloadLooksValid(payload)) {
    return {
      summary: null,
      queryIdUsed: queryId,
      httpOk: true,
      semanticOk: false,
      note:
        'LinkedIn rechazó la query COMPANY_CARD (`data.status` o query caducado). Actualiza `LINKEDIN_JOB_DETAIL_QUERY_ID`.',
    };
  }

  const included = extractIncluded(payload);
  const summary = parseCompanySummaryFromIncluded(included);

  let note: string | null = null;
  if (!summary) {
    note =
      included.length === 0
        ? "included vacío para COMPANY_CARD."
        : 'No apareció la entidad `organization.Company` en included.';
  }

  return {
    summary,
    queryIdUsed: queryId,
    httpOk: true,
    semanticOk: true,
    note,
  };
}
