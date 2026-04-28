import type { LinkedInJobCard } from "../linkedin/jobsList";
import type { JobsV2SearchResult } from "../linkedin/jobsV2Search";

/** Convierte resultado de jobs v2 en tarjeta mínima compatible con `/jobs`. */
export function jobsV2ResultToLinkedInCard(
  j: JobsV2SearchResult,
): LinkedInJobCard {
  const insights =
    j.type === "remoto"
      ? (["Remoto"] as string[])
      : (["Presencial / híbrido"] as string[]);
  return {
    id: j.id,
    title: j.title,
    company: null,
    location: j.location,
    url: `https://www.linkedin.com/jobs/view/${j.id}/`,
    insights,
    salarySnippet: null,
    listedText: null,
    logoUrl: null,
  };
}
