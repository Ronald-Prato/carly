/** LinkedIn Voyager URL encoding, cookies, and headers — mirrors linkedin_client.py */

/** Fallback si no hay env (equivalente a linkedin_client._DEFAULT_* en Python). */
const DEFAULT_LI_AT =
  "AQEDASiQXN8DlWIrAAABncvY_C0AAAGd7-WALU0AOLj_NMEqrNQs2V4YkydZMePeCzP9ggizFyUBJvq27dZKqc6-8aKc1-aLtIuy2iOqQoXbNvHm4ighn1jmcf86JxEHrE_Fvq4bxaObTdS38QDtY-MT";

const DEFAULT_JSESSIONID = "ajax:5776593099345541695";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

const EXTRA_SAFE = "(),:";

/** Same intent as Python urllib.parse.quote(s, safe="(),:"). */
export function quoteVoyagerValue(s: string): string {
  let result = "";
  for (let i = 0; i < s.length; ) {
    const head = s[i]!;
    if (
      head === "%" &&
      i + 2 < s.length &&
      /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))
    ) {
      result += s.slice(i, i + 3).toUpperCase();
      i += 3;
      continue;
    }
    const c = head;
    i += 1;
    const unreservedLetter =
      (c >= "A" && c <= "Z") ||
      (c >= "a" && c <= "z") ||
      (c >= "0" && c <= "9");
    const neverQuoted = c === "_" || c === "." || c === "-" || c === "~";
    if (unreservedLetter || neverQuoted || EXTRA_SAFE.includes(c)) {
      result += c;
    } else {
      for (const b of new TextEncoder().encode(c)) {
        result += `%${b.toString(16).toUpperCase().padStart(2, "0")}`;
      }
    }
  }
  return result;
}

export function voyagerQueryUrl(
  baseUrl: string,
  params: Record<string, string | number | boolean>,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    parts.push(`${key}=${quoteVoyagerValue(String(value))}`);
  }
  return `${baseUrl}?${parts.join("&")}`;
}

function liAt(): string {
  return (
    process.env.LINKEDIN_LI_AT ?? process.env.LI_AT ?? DEFAULT_LI_AT
  );
}

export function jsessionId(): string {
  return (
    process.env.LINKEDIN_JSESSIONID ??
    process.env.JSESSIONID ??
    DEFAULT_JSESSIONID
  );
}

/** LinkedIn Cookie header plus CSRF (`ajax:…`). Env opcional; por defecto mismos valores que el scraper Python. */
export function linkedinCookiesOrThrow(): { cookieHeader: string; csrfToken: string } {
  const lat = liAt();
  const jid = jsessionId();
  if (!lat || !jid) {
    throw new Error(
      "Faltan LINKEDIN_LI_AT/LI_AT o LINKEDIN_JSESSIONID/JSESSIONID.",
    );
  }
  const jidForCookie = jid.startsWith('"') ? jid : `"${jid}"`;
  const cookieHeader = `li_at=${encodeURIComponent(lat)}; JSESSIONID=${jidForCookie}`;
  return { cookieHeader, csrfToken: jid };
}

export function liTrackJson(
  clientVersion = "1.13.43773",
  mpVersion = "1.13.43773",
): string {
  return JSON.stringify({
    clientVersion,
    mpVersion,
    osName: "web",
    timezoneOffset: -5,
    timezone: "America/Bogota",
    deviceFormFactor: "DESKTOP",
    mpName: "voyager-web",
  });
}

export function baseHeaders(
  referer: string,
  csrfToken: string,
  extra?: Record<string, string>,
): Record<string, string> {
  const h: Record<string, string> = {
    Host: "www.linkedin.com",
    Accept: "application/vnd.linkedin.normalized+json+2.1",
    "accept-language": "es-ES,es;q=0.9,en;q=0.8",
    "csrf-token": csrfToken,
    Origin: "https://www.linkedin.com",
    Referer: referer,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "User-Agent": USER_AGENT,
    "x-restli-protocol-version": "2.0.0",
    "x-li-lang": "es_ES",
  };
  if (extra) {
    Object.assign(h, extra);
  }
  return h;
}

export async function assertOkLinkedIn(response: Response, url: string): Promise<void> {
  const code = response.status;
  if (code >= 301 && code <= 308) {
    const loc = response.headers.get("location") ?? "?";
    throw new Error(`Redirección (${code}) → ${loc}. Sesión/cookies probablemente inválidas.`);
  }
  if (!response.ok) {
    const snippet = (await response.text()).slice(0, 2000);
    throw new Error(
      `${response.status} ${response.statusText} para ${url}. Inicio del cuerpo: ${JSON.stringify(snippet)}`,
    );
  }
}
