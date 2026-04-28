import type { LinkedInJobPostingDetail } from "../linkedin/jobPostingDetail";
import type { LinkedInJobCard } from "../linkedin/jobsList";
import type { LinkedInTopFitCardBlock } from "../linkedin/topFitCardGraphql";

export type ExpandedJobDetail = {
  detail: LinkedInTopFitCardBlock | null;
  description: LinkedInJobPostingDetail | null;
  detailError: string | null;
  descriptionError: string | null;
};

/** Tarjeta enriquecida tal como se muestra en el carrusel de `/jobs`. */
export type EnrichedJobCard = LinkedInJobCard &
  ExpandedJobDetail & {
    matchingCriteria?: string[];
  };
