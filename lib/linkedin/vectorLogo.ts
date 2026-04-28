/** Extrae una URL pública de `com.linkedin.common.VectorImage` (Voyager). */

function joinLinkedinVectorUrl(rootUrl: string, segment: string): string {
  if (segment.startsWith("/")) {
    return `${rootUrl.replace(/\/+$/, "")}${segment}`;
  }
  return `${rootUrl}${segment}`;
}

export function logoUrlFromVectorImage(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const o = data as Record<string, unknown>;
  let rootRaw = typeof o.rootUrl === "string" ? o.rootUrl.trim() : null;
  if (!rootRaw) {
    return null;
  }
  const arts = Array.isArray(o.artifacts) ? o.artifacts : [];

  let bestW = -1;
  let bestUrl: string | null = null;
  const consider = (url: string, w: unknown) => {
    const ww = typeof w === "number" ? w : Number(w) || 0;
    const u = url.trim();
    if (!u.includes("media.licdn.com") && !u.includes("linkedin.com")) {
      return;
    }
    if (ww >= bestW) {
      bestW = ww;
      bestUrl = u;
    }
  };

  for (const a of arts) {
    if (!a || typeof a !== "object") {
      continue;
    }
    const ar = a as Record<string, unknown>;
    const seg = ar.fileIdentifyingUrlPathSegment;
    const w = ar.width ?? 0;
    if (typeof seg !== "string") {
      continue;
    }
    if (/^https?:\/\//.test(seg)) {
      consider(seg, w);
    } else {
      consider(joinLinkedinVectorUrl(rootRaw, seg), w);
    }
  }

  return bestUrl;
}

/**
 * Igual que `build_linkedin_logo_url` en el scraper Python: elige el artifact
 * de mayor `width` y concatena `rootUrl` + `fileIdentifyingUrlPathSegment`.
 */
export function buildLinkedinLogoUrlFromCompany(
  company: Record<string, unknown>,
): string | null {
  const logo = company.logoResolutionResult;
  if (!logo || typeof logo !== "object") {
    return null;
  }
  const lr = logo as Record<string, unknown>;
  const vector = lr.vectorImage;
  return logoUrlFromVectorImage(vector);
}

/** Recorre un subárbol buscando `vectorImage`, `companyLogo`, `logo`. */
export function findBestLogoUrlInTree(obj: unknown, depth = 0): string | null {
  if (depth > 42 || obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const u = findBestLogoUrlInTree(x, depth + 1);
      if (u) {
        return u;
      }
    }
    return null;
  }
  if (typeof obj !== "object") {
    return null;
  }
  const o = obj as Record<string, unknown>;

  const tryVector = (v: unknown) => logoUrlFromVectorImage(v);

  const direct =
    tryVector(o.vectorImage) ??
    tryVector(o.logo) ??
    logoUrlFromTreeMaybeResolution(o.logoResolutionResult ?? o.logoResult);
  if (direct) {
    return direct;
  }

  for (const v of Object.values(o)) {
    const u = findBestLogoUrlInTree(v, depth + 1);
    if (u) {
      return u;
    }
  }
  return null;
}

function logoUrlFromTreeMaybeResolution(val: unknown): string | null {
  if (!val || typeof val !== "object") {
    return null;
  }
  return findBestLogoUrlInTree(val, 22);
}
