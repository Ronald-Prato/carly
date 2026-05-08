"use node";

import { v } from "convex/values";
import OpenAI from "openai";
import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { jobsV2ResultToLinkedInCard } from "../../lib/jobs/v2JobToCard";
import { fetchLinkedInJobPostingDetail } from "../../lib/linkedin/jobPostingDetail";
import { fetchJobsV2Search } from "../../lib/linkedin/jobsV2Search";
import {
  resolveCountry,
  type JobSearchCountryCode,
} from "../../lib/linkedin/jobSearchOptions";
import {
  fetchTopFitCardGraphql,
  type LinkedInTopFitCardBlock,
} from "../../lib/linkedin/topFitCardGraphql";
import type { LinkedInJobPostingDetail } from "../../lib/linkedin/jobPostingDetail";
import type { JobsV2SearchResult } from "../../lib/linkedin/jobsV2Search";
import type { EnrichedJobCard } from "../../lib/jobs/enrichedJobCard";
import type { LinkedInJobCard } from "../../lib/linkedin/jobsList";
import type { LinkedInSessionCredentials } from "../../lib/linkedin/linkedinClient";
import {
  getJobsMatchCacheJson,
  setJobsMatchCacheJson,
} from "../../lib/redis/jobsMatchCache";
import { linkedInSessionForAction } from "../linkedinCredentials";

const BATCH_SIZE = 10;
const MODEL = "gpt-4o-mini";
const MAX_DESC_CHARS = 4500;

const batchMatchSchema = z.object({
  matching_offers: z.array(
    z.object({
      id: z.string(),
      matchingCriteria: z.array(z.string()),
    }),
  ),
});

const MATCH_SYSTEM = `Eres Carly! una asistente experta en reclutamiento y encaje candidato‑oferta.
Recibirás el texto completo del CV de un candidato (en español u otro idioma) y hasta 10 ofertas laborales como JSON.

Tu tarea: decidir QUÉ ofertas tienen alineación real con el perfil (experiencia, habilidades técnicas, seniority, sector, ubicación/remoto donde aplique).

Responde SIEMPRE con un objeto JSON válido siguiendo el esquema indicado por el usuario. Incluye en matching_offers SOLO las ofertas donde haya coincidencias sustanciales con el CV. Omite las que estén muy desalineadas o sean muy genéricas respecto al perfil. Los ids deben copiarse exactamente del input.

matchingCriteria debe ser un array de strings en español neutro: cada string es un punto breve de coincidencia entre CV y oferta (tecnologías, experiencia, seniority, idiomas si aplica, etc.). Usa típicamente entre 2 y 6 puntos. Sin inventar información que no figure en la oferta o el CV.

Ejemplo:
["Experiencia en desarrollo web", "Conocimiento en IA", "Seniority acorde al rol"]

Si ninguna encaja bien, usa matching_offers: [].`;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

async function matchBatchWithOpenAi(
  openai: OpenAI,
  cvPlainText: string,
  batch: JobsV2SearchResult[],
): Promise<Array<{ id: string; matchingCriteria: string[] }>> {
  if (batch.length === 0) {
    return [];
  }

  const offersJson = batch.map((j) => ({
    id: j.id,
    title: j.title,
    location: j.location,
    workMode: j.type,
    description: truncate(j.description ?? "", MAX_DESC_CHARS),
  }));

  const userContent = `
Esquema de respuesta (JSON único):
{ "matching_offers": [ { "id": "<id exacto>", "matchingCriteria": ["punto 1", "punto 2"] } ] }

TEXT DEL CV:
---
${truncate(cvPlainText, 28000)}
---

OFERTAS (JSON array, máximo 10 elementos):
${JSON.stringify(offersJson, null, 2)}
`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: MATCH_SYSTEM },
      { role: "user", content: userContent },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const safe = batchMatchSchema.safeParse(parsed);
  if (!safe.success) {
    return [];
  }

  const validIds = new Set(batch.map((b) => b.id));
  return safe.data.matching_offers.filter((m) => validIds.has(m.id));
}

async function fetchJobBundle(
  card: LinkedInJobCard,
  session: LinkedInSessionCredentials,
): Promise<{
  detail: LinkedInTopFitCardBlock | null;
  description: LinkedInJobPostingDetail | null;
  detailError: string | null;
  descriptionError: string | null;
}> {
  const numericId = card.id && /^\d+$/.test(card.id) ? card.id : null;
  if (!numericId) {
    return {
      detail: null,
      description: null,
      detailError: "No hay id numérico de oferta.",
      descriptionError: "No hay id numérico de oferta.",
    };
  }

  const [vacancyResult, postingResult] = await Promise.allSettled([
    fetchTopFitCardGraphql(numericId, session),
    fetchLinkedInJobPostingDetail(numericId, session),
  ]);

  let detail: LinkedInTopFitCardBlock | null = null;
  let detailError: string | null = null;
  if (vacancyResult.status === "fulfilled") {
    detail = vacancyResult.value;
  } else {
    detailError =
      vacancyResult.reason instanceof Error
        ? vacancyResult.reason.message
        : "Vacante LinkedIn.";
  }

  let description: LinkedInJobPostingDetail | null = null;
  let descriptionError: string | null = null;
  if (postingResult.status === "fulfilled") {
    description = postingResult.value;
  } else {
    descriptionError =
      postingResult.reason instanceof Error
        ? postingResult.reason.message
        : "Descripción.";
  }

  return { detail, description, detailError, descriptionError };
}

type MatchJobsWithCvOk = { ok: true; jobs: EnrichedJobCard[] };
type MatchJobsWithCvFail = { ok: false; error: string };

const JOBS_MATCH_CACHE_PAYLOAD_VERSION = 1 as const;
type CachedJobsPayload = {
  v: typeof JOBS_MATCH_CACHE_PAYLOAD_VERSION;
  jobs: EnrichedJobCard[];
};

function parseCachedMatchedJobs(payload: unknown): EnrichedJobCard[] | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const o = payload as Record<string, unknown>;
  if (o.v !== JOBS_MATCH_CACHE_PAYLOAD_VERSION || !Array.isArray(o.jobs)) {
    return null;
  }
  return o.jobs as EnrichedJobCard[];
}

function cvPlainFailureMessage(
  reason:
    | "not_signed_in"
    | "no_resume"
    | "resume_not_found"
    | "no_structured_data"
    | "invalid_cv_data",
): string {
  switch (reason) {
    case "no_structured_data":
    case "invalid_cv_data":
      return "El CV necesita datos estructurados (CvData): completa/enriquece el CV en Carly.";
    case "no_resume":
      return "No hay hoja de vida subida.";
    case "resume_not_found":
      return "No se encontró esa hoja de vida.";
    default:
      return "Debes iniciar sesión.";
  }
}

const jobsV2SearchResultFields = {
  id: v.string(),
  title: v.string(),
  description: v.string(),
  type: v.union(v.literal("remoto"), v.literal("presencial")),
  location: v.string(),
};

type MatchJobsSearchOk = { ok: true; jobs: JobsV2SearchResult[] };
type MatchJobsSearchFail = { ok: false; error: string };

async function runMatchJobsSearchPhase(
  ctx: ActionCtx,
  args: {
    keywords: string;
    country: string;
    resumeId?: string | Id<"resumes">;
    limit?: number;
  },
): Promise<MatchJobsSearchOk | MatchJobsSearchFail> {
  const me = await ctx.runQuery(api.database.users.getCurrent, {});
  if (!me) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const resumeId =
    args.resumeId === undefined ? undefined : (args.resumeId as Id<"resumes">);

  const cv = await ctx.runQuery(api.storage.resume.getCvPlainTextForMatching, {
    resumeId,
  });

  if (!cv.ok) {
    return {
      ok: false,
      error: cvPlainFailureMessage(cv.reason),
    };
  }

  let jobs: JobsV2SearchResult[];
  try {
    const session = await linkedInSessionForAction(ctx);
    const resolved = resolveCountry(args.country.trim() || null).id;
    const limitRaw = Math.min(Math.max(Math.floor(args.limit ?? 50), 1), 100);
    jobs = await fetchJobsV2Search(
      {
        keywords: args.keywords.trim(),
        country: resolved as JobSearchCountryCode,
        limit: limitRaw,
      },
      session,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error buscando ofertas.";
    return { ok: false, error: msg };
  }

  return { ok: true, jobs };
}

async function runMatchJobsMatchPhase(
  ctx: ActionCtx,
  args: {
    resumeId?: string | Id<"resumes">;
    jobs: JobsV2SearchResult[];
  },
): Promise<MatchJobsWithCvOk | MatchJobsWithCvFail> {
  const me = await ctx.runQuery(api.database.users.getCurrent, {});
  if (!me) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const resumeId =
    args.resumeId === undefined ? undefined : (args.resumeId as Id<"resumes">);

  const cv = await ctx.runQuery(api.storage.resume.getCvPlainTextForMatching, {
    resumeId,
  });

  if (!cv.ok) {
    return {
      ok: false,
      error: cvPlainFailureMessage(cv.reason),
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: "Falta OPENAI_API_KEY en el entorno de Convex.",
    };
  }

  const openai = new OpenAI({ apiKey });
  const jobs = args.jobs;

  if (jobs.length === 0) {
    return { ok: true, jobs: [] };
  }

  const linkedInSession = await linkedInSessionForAction(ctx);

  const batches = chunk(jobs, BATCH_SIZE);
  const batchResults = await Promise.all(
    batches.map((batch) => matchBatchWithOpenAi(openai, cv.text, batch)),
  );

  const merged = new Map<string, string[]>();
  for (const rows of batchResults) {
    for (const row of rows) {
      if (!merged.has(row.id)) {
        merged.set(row.id, row.matchingCriteria);
      }
    }
  }

  const orderedMatched: Array<{ job: JobsV2SearchResult; criteria: string[] }> =
    [];
  for (const j of jobs) {
    const c = merged.get(j.id);
    if (c && c.length > 0) orderedMatched.push({ job: j, criteria: c });
  }

  if (orderedMatched.length === 0) {
    return { ok: true, jobs: [] };
  }

  const jobsOut: EnrichedJobCard[] = await Promise.all(
    orderedMatched.map(async ({ job, criteria }) => {
      const card = jobsV2ResultToLinkedInCard(job);
      const bundle = await fetchJobBundle(card, linkedInSession);
      return {
        ...card,
        ...bundle,
        matchingCriteria: criteria,
      };
    }),
  );

  return { ok: true, jobs: jobsOut };
}

async function runMatchJobsWithCv(
  ctx: ActionCtx,
  args: {
    keywords: string;
    country: string;
    resumeId?: string | Id<"resumes">;
    limit?: number;
  },
): Promise<MatchJobsWithCvOk | MatchJobsWithCvFail> {
  const identity = await ctx.auth.getUserIdentity();
  const authSubject = identity?.subject?.trim();
  if (authSubject) {
    try {
      const cacheQuery = {
        keywords: args.keywords,
        country: args.country,
        resumeId: args.resumeId,
        limit: args.limit,
      };
      const cachedRaw = await getJobsMatchCacheJson(authSubject, cacheQuery);
      const cachedJobs = parseCachedMatchedJobs(cachedRaw);
      if (cachedJobs !== null) {
        return { ok: true, jobs: cachedJobs };
      }
    } catch {
      // omitido: misma rutina si Redis falla
    }
  }

  const search = await runMatchJobsSearchPhase(ctx, args);
  if (!search.ok) {
    return search;
  }

  const matched = await runMatchJobsMatchPhase(ctx, {
    resumeId: args.resumeId,
    jobs: search.jobs,
  });

  if (matched.ok && authSubject) {
    try {
      const cacheQuery = {
        keywords: args.keywords,
        country: args.country,
        resumeId: args.resumeId,
        limit: args.limit,
      };
      const payload: CachedJobsPayload = {
        v: JOBS_MATCH_CACHE_PAYLOAD_VERSION,
        jobs: matched.jobs,
      };
      await setJobsMatchCacheJson(authSubject, cacheQuery, payload);
    } catch {
      // omitido: resultado sigue siendo válido sin caché
    }
  }

  return matched;
}

export const matchJobsWithCvSearch = action({
  args: {
    keywords: v.string(),
    country: v.string(),
    resumeId: v.optional(v.id("resumes")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => runMatchJobsSearchPhase(ctx, args),
});

export const matchJobsWithCvMatchJobs = action({
  args: {
    resumeId: v.optional(v.id("resumes")),
    jobs: v.array(v.object(jobsV2SearchResultFields)),
  },
  handler: async (ctx, args) =>
    runMatchJobsMatchPhase(ctx, {
      resumeId: args.resumeId,
      jobs: args.jobs,
    }),
});

export const matchJobsWithCv = action({
  args: {
    keywords: v.string(),
    country: v.string(),
    resumeId: v.optional(v.id("resumes")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => runMatchJobsWithCv(ctx, args),
});
