import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";
import { resolveCountry } from "../linkedin/jobSearchOptions";

/** Versión del esquema de claves (cambiar si cambias el formato). */
const CACHE_PREFIX = "carly:jobs-match:v2";
export const JOBS_MATCH_CACHE_TTL_SECONDS = 60 * 60;

export type JobsMatchCacheQueryInput = {
  keywords: string;
  country: string;
  resumeId?: string | null;
  limit?: number;
};

type Backend =
  | { mode: "tcp"; client: IORedis }
  | { mode: "rest"; client: UpstashRedis };

/** `undefined`: not resolved yet. First resolution wins for process lifetime. */
let singleton: Backend | null | undefined;

function resolveBackend(): Backend | null {
  if (singleton !== undefined) {
    return singleton;
  }

  const tcpUrl = process.env.REDIS_URL?.trim();
  if (tcpUrl) {
    singleton = {
      mode: "tcp",
      client: new IORedis(tcpUrl, {
        maxRetriesPerRequest: 2,
      }),
    };
    return singleton;
  }

  const restUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (restUrl && token) {
    singleton = {
      mode: "rest",
      client: new UpstashRedis({ url: restUrl, token }),
    };
    return singleton;
  }

  singleton = null;
  return null;
}

/**
 * Texto que el usuario usa para buscar: Unicode estable, espacios colapsados,
 * sin marcadores típicos invisibles. Luego se codifica para la clave Redis.
 */
export function normalizeKeywordsForCache(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Límite alineado con `runMatchJobsSearchPhase`. */
function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(Math.floor(limit ?? 50), 1), 100);
}

/**
 * Fragmento estable para Redis: mismo uid puede tener varias entradas
 * (consulta codificada, país, límite, CV opcional).
 * Ej. keywords `"Frontend senior"` → segmento tipo `Frontend%20senior` (solo esa parte viene de encodeURIComponent del texto normalizado).
 */
export function jobsMatchCacheKey(
  authSubject: string,
  query: JobsMatchCacheQueryInput,
): string {
  const kwEnc = encodeURIComponent(normalizeKeywordsForCache(query.keywords));
  const countryId = resolveCountry(query.country.trim() || null).id;
  const countryEnc = encodeURIComponent(countryId);
  const lim = clampLimit(query.limit);
  const resumeEnc = encodeURIComponent((query.resumeId ?? "").trim());
  return `${CACHE_PREFIX}:${authSubject}:kw:${kwEnc}:c:${countryEnc}:l:${lim}:r:${resumeEnc}`;
}

export async function getJobsMatchCacheJson(
  authSubject: string,
  query: JobsMatchCacheQueryInput,
): Promise<unknown | null> {
  const backend = resolveBackend();
  if (!backend) {
    return null;
  }
  const key = jobsMatchCacheKey(authSubject, query);

  if (backend.mode === "tcp") {
    const raw = await backend.client.get(key);
    if (raw == null) {
      return null;
    }
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }

  const raw = await backend.client.get<string | Record<string, unknown>>(key);
  if (raw == null) {
    return null;
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  return raw as unknown;
}

export async function setJobsMatchCacheJson(
  authSubject: string,
  query: JobsMatchCacheQueryInput,
  payload: unknown,
): Promise<void> {
  const backend = resolveBackend();
  if (!backend) {
    return;
  }
  const key = jobsMatchCacheKey(authSubject, query);
  const body = JSON.stringify(payload);

  if (backend.mode === "tcp") {
    await backend.client.set(
      key,
      body,
      "EX",
      JOBS_MATCH_CACHE_TTL_SECONDS,
    );
    return;
  }

  await backend.client.set(key, body, {
    ex: JOBS_MATCH_CACHE_TTL_SECONDS,
  });
}
