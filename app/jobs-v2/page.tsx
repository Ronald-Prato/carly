"use client";

import { useCallback, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DEFAULT_JOB_SEARCH_DEFAULTS } from "@/lib/linkedin/jobsList";
import {
  JOB_SEARCH_COUNTRY_OPTIONS,
  type JobSearchCountryCode,
} from "@/lib/linkedin/jobSearchOptions";

export default function JobsV2Page() {
  const searchJobsV2 = useAction(api.jobs.jobsV2Search.searchJobsV2);
  const [keywords, setKeywords] = useState("");
  const [country, setCountry] = useState<JobSearchCountryCode>(
    DEFAULT_JOB_SEARCH_DEFAULTS.country,
  );
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSearch = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await searchJobsV2({
        keywords: keywords.trim(),
        country,
        limit: 50,
      });
      if (!result.ok) {
        setResultCount(null);
        setError(result.error);
        return;
      }

      console.log("jobs-v2 final jobs (Convex)", result.jobs);
      setResultCount(result.jobs.length);
    } catch (e) {
      setResultCount(null);
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [keywords, country, searchJobsV2]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col px-4 py-8 sm:px-6">
      <div className="flex flex-1 flex-col items-center">
        <div className="flex w-full max-w-5xl flex-col items-stretch gap-6">
          <div className="bg-carly-agent flex w-full flex-col gap-4 rounded-xl border border-[var(--carly-border)] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="job-v2-keywords"
                className="text-xs font-medium uppercase tracking-wide text-[var(--carly-label)]"
              >
                Palabras clave
              </label>
              <input
                id="job-v2-keywords"
                type="search"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Ej. backend golang, ingeniero datos..."
                className="rounded-[10px] border border-[var(--carly-border)] bg-[var(--carly-page-bg)] px-3 py-2.5 text-sm text-[var(--carly-text)] placeholder:text-[var(--carly-muted)] focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="job-v2-country"
                className="text-xs font-medium uppercase tracking-wide text-[var(--carly-label)]"
              >
                País
              </label>
              <select
                id="job-v2-country"
                value={country}
                onChange={(e) =>
                  setCountry(e.target.value as JobSearchCountryCode)
                }
                className="rounded-[10px] border border-[var(--carly-border)] bg-[var(--carly-page-bg)] px-3 py-2.5 text-sm text-[var(--carly-text)] focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
              >
                {JOB_SEARCH_COUNTRY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-[var(--carly-muted)]">
              Filtro activo: publicadas este mes.
            </p>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void onSearch()}
              disabled={loading}
              className="inline-flex min-w-[160px] items-center justify-center rounded-[10px] bg-[var(--carly-primary-bg)] px-8 py-3 text-sm font-semibold text-[var(--carly-primary-fg)] shadow-sm transition hover:bg-[var(--carly-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Buscando 50 ofertas..." : "Buscar"}
            </button>
          </div>

          {error ? (
            <p className="w-full text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          {resultCount !== null && !error ? (
            <p className="text-center text-sm text-[var(--carly-muted)]">
              Array final en consola: {resultCount} ofertas de este mes.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
