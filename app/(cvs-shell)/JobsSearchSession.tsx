"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import type { EnrichedJobCard } from "@/lib/jobs/enrichedJobCard";
import { DEFAULT_JOB_SEARCH_DEFAULTS } from "@/lib/linkedin/jobsList";
import type { JobSearchCountryCode } from "@/lib/linkedin/jobSearchOptions";

export type JobsSearchSessionState = {
  keywords: string;
  setKeywords: Dispatch<SetStateAction<string>>;
  country: JobSearchCountryCode;
  setCountry: Dispatch<SetStateAction<JobSearchCountryCode>>;
  jobs: EnrichedJobCard[] | null;
  setJobs: Dispatch<SetStateAction<EnrichedJobCard[] | null>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  wizardPhase: 1 | 2 | 3 | null;
  setWizardPhase: Dispatch<SetStateAction<1 | 2 | 3 | null>>;
  resultsRevealKey: number;
  setResultsRevealKey: Dispatch<SetStateAction<number>>;
  offersUnlocked: boolean;
  setOffersUnlocked: Dispatch<SetStateAction<boolean>>;
};

const JobsSearchSessionContext =
  createContext<JobsSearchSessionState | null>(null);

export function JobsSearchSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [keywords, setKeywords] = useState("");
  const [country, setCountry] = useState<JobSearchCountryCode>(
    DEFAULT_JOB_SEARCH_DEFAULTS.country,
  );
  const [jobs, setJobs] = useState<EnrichedJobCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wizardPhase, setWizardPhase] = useState<1 | 2 | 3 | null>(null);
  const [resultsRevealKey, setResultsRevealKey] = useState(0);
  const [offersUnlocked, setOffersUnlocked] = useState(false);

  const value = useMemo(
    (): JobsSearchSessionState => ({
      keywords,
      setKeywords,
      country,
      setCountry,
      jobs,
      setJobs,
      error,
      setError,
      loading,
      setLoading,
      wizardPhase,
      setWizardPhase,
      resultsRevealKey,
      setResultsRevealKey,
      offersUnlocked,
      setOffersUnlocked,
    }),
    [
      keywords,
      country,
      jobs,
      error,
      loading,
      wizardPhase,
      resultsRevealKey,
      offersUnlocked,
    ],
  );

  return (
    <JobsSearchSessionContext.Provider value={value}>
      {children}
    </JobsSearchSessionContext.Provider>
  );
}

export function useJobsSearchSession(): JobsSearchSessionState {
  const ctx = useContext(JobsSearchSessionContext);
  if (!ctx) {
    throw new Error(
      "useJobsSearchSession debe usarse dentro de JobsSearchSessionProvider",
    );
  }
  return ctx;
}
