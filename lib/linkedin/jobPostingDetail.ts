/**
 * Detalle de un anuncio: GET /voyager/api/jobs/jobPostings/{id} — mirror job_detail.fetch_job_detail_rest
 */

import {
  assertOkLinkedIn,
  baseHeaders,
  linkedinCookiesOrThrow,
  liTrackJson,
} from "./linkedinClient";

const JOB_POSTING_URL = "https://www.linkedin.com/voyager/api/jobs/jobPostings";

function titleOrLabel(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.text === "string") {
      return o.text.trim() || null;
    }
  }
  return null;
}

function descriptionTextFromJobPosting(
  data: Record<string, unknown>,
): string | null {
  const desc = data.description;
  if (!desc || typeof desc !== "object") {
    return null;
  }
  const text = (desc as Record<string, unknown>).text;
  return typeof text === "string" ? text.trim() || null : null;
}

function detailHeaders(
  jobId: string,
  csrfToken: string,
): Record<string, string> {
  return baseHeaders(
    `https://www.linkedin.com/jobs/view/${jobId}/`,
    csrfToken,
    { "x-li-track": liTrackJson() },
  );
}

export type LinkedInJobPostingDetail = {
  jobId: string;
  title: string | null;
  location: string | null;
  employmentStatus: string | null;
  description: string | null;
  source: "rest";
};

export async function fetchLinkedInJobPostingDetail(
  jobId: string,
): Promise<LinkedInJobPostingDetail> {
  const jid = jobId.trim();
  if (!/^\d+$/.test(jid)) {
    throw new Error(`El id de oferta debe ser numérico: ${jobId}`);
  }

  const { cookieHeader, csrfToken } = linkedinCookiesOrThrow();
  const url = `${JOB_POSTING_URL}/${jid}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      ...detailHeaders(jid, csrfToken),
      Cookie: cookieHeader,
    },
    redirect: "manual",
  });
  await assertOkLinkedIn(response, url);
  const body = (await response.json()) as Record<string, unknown>;
  const data = (body.data as Record<string, unknown>) ?? {};

  return {
    jobId: jid,
    title: titleOrLabel(data.title),
    location: titleOrLabel(data.formattedLocation),
    employmentStatus: titleOrLabel(data.formattedEmploymentStatus),
    description: descriptionTextFromJobPosting(data),
    source: "rest",
  };
}
