/**
 * Países para `seoLocation` en búsqueda Voyager.
 * Orden: Colombia siempre primero, resto de América Latina y el Caribe (CELAC) A–Z en español,
 * luego Estados Unidos y España.
 */
export const JOB_SEARCH_COUNTRY_OPTIONS = [
  { id: "co", label: "🇨🇴 Colombia", locationLabel: "Colombia" },
  { id: "ag", label: "🇦🇬 Antigua y Barbuda", locationLabel: "Antigua and Barbuda" },
  { id: "ar", label: "🇦🇷 Argentina", locationLabel: "Argentina" },
  { id: "bs", label: "🇧🇸 Bahamas", locationLabel: "Bahamas" },
  { id: "bb", label: "🇧🇧 Barbados", locationLabel: "Barbados" },
  { id: "bz", label: "🇧🇿 Belice", locationLabel: "Belize" },
  { id: "bo", label: "🇧🇴 Bolivia", locationLabel: "Bolivia" },
  { id: "br", label: "🇧🇷 Brasil", locationLabel: "Brazil" },
  { id: "cl", label: "🇨🇱 Chile", locationLabel: "Chile" },
  { id: "cr", label: "🇨🇷 Costa Rica", locationLabel: "Costa Rica" },
  { id: "cu", label: "🇨🇺 Cuba", locationLabel: "Cuba" },
  { id: "dm", label: "🇩🇲 Dominica", locationLabel: "Dominica" },
  { id: "ec", label: "🇪🇨 Ecuador", locationLabel: "Ecuador" },
  { id: "sv", label: "🇸🇻 El Salvador", locationLabel: "El Salvador" },
  { id: "gd", label: "🇬🇩 Granada", locationLabel: "Grenada" },
  { id: "gt", label: "🇬🇹 Guatemala", locationLabel: "Guatemala" },
  { id: "gy", label: "🇬🇾 Guyana", locationLabel: "Guyana" },
  { id: "ht", label: "🇭🇹 Haití", locationLabel: "Haiti" },
  { id: "hn", label: "🇭🇳 Honduras", locationLabel: "Honduras" },
  { id: "jm", label: "🇯🇲 Jamaica", locationLabel: "Jamaica" },
  { id: "mx", label: "🇲🇽 México", locationLabel: "Mexico" },
  { id: "ni", label: "🇳🇮 Nicaragua", locationLabel: "Nicaragua" },
  { id: "pa", label: "🇵🇦 Panamá", locationLabel: "Panama" },
  { id: "py", label: "🇵🇾 Paraguay", locationLabel: "Paraguay" },
  { id: "pe", label: "🇵🇪 Perú", locationLabel: "Peru" },
  { id: "do", label: "🇩🇴 República Dominicana", locationLabel: "Dominican Republic" },
  {
    id: "kn",
    label: "🇰🇳 San Cristóbal y Nieves",
    locationLabel: "Saint Kitts and Nevis",
  },
  {
    id: "vc",
    label: "🇻🇨 San Vicente y las Granadinas",
    locationLabel: "Saint Vincent and the Grenadines",
  },
  { id: "lc", label: "🇱🇨 Santa Lucía", locationLabel: "Saint Lucia" },
  { id: "sr", label: "🇸🇷 Surinam", locationLabel: "Suriname" },
  { id: "tt", label: "🇹🇹 Trinidad y Tobago", locationLabel: "Trinidad and Tobago" },
  { id: "uy", label: "🇺🇾 Uruguay", locationLabel: "Uruguay" },
  { id: "ve", label: "🇻🇪 Venezuela", locationLabel: "Venezuela" },
  { id: "us", label: "🇺🇸 Estados Unidos", locationLabel: "United States" },
  { id: "es", label: "🇪🇸 España", locationLabel: "Spain" },
] as const;

export type JobSearchCountryCode =
  (typeof JOB_SEARCH_COUNTRY_OPTIONS)[number]["id"];

export type JobSearchCountryOption = (typeof JOB_SEARCH_COUNTRY_OPTIONS)[number];

export function resolveCountry(code: string | null): JobSearchCountryOption {
  const c = code?.trim().toLowerCase();
  const found =
    JOB_SEARCH_COUNTRY_OPTIONS.find((o) => o.id === c) ??
    JOB_SEARCH_COUNTRY_OPTIONS[0];
  return found;
}

/** Evita caracteres que rompen la gramática del `query` Voyager (sobre todo `,`). */
export function sanitizeJobKeywords(raw: string): string {
  return raw
    .trim()
    .replace(/[,;]+/g, " ")
    .replace(/\s+/g, " ");
}
