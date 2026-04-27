/**
 * Modelo de datos para CVs en Carly.
 *
 * IDEA NÚCLEO: separamos QUÉ dice el CV (datos estructurados) de CÓMO se ve
 * (plantillas). Los datos viven aquí; cada plantilla los renderiza a HTML
 * sin saber nada de la profesión del usuario.
 *
 * El "alfabeto" de secciones es pequeño y cerrado (`SectionShape`). El nombre
 * humano de cada sección es libre (`title`), y la semántica opcional vive en
 * `semanticHint` para usos inteligentes (ranking de IA, iconos, etc.).
 */

/** Identidad y contacto: lo único que TODO CV tiene, sin importar la profesión. */
export type CvBasics = {
  name: string;
  /** Rol o titular profesional ("Frontend Developer", "Chef ejecutivo"). */
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  /** Foto opcional; las plantillas pueden ignorarla. */
  photoUrl?: string;
  /** Enlaces externos (LinkedIn, GitHub, portafolio, etc.). */
  links?: Array<{ label: string; url?: string }>;
};

export type ParagraphPayload = { text: string };

export type TagListPayload = { items: string[] };

export type EntryListItem = {
  /** Línea principal: cargo, título académico, nombre del proyecto/platillo. */
  headline: string;
  /** Línea secundaria: empresa, institución, sello, marca. */
  subheadline?: string;
  /** Rango temporal libre ("2021 — presente", "2018"). */
  dateRange?: string;
  location?: string;
  /** Bullets de logros / responsabilidades / detalles. */
  bullets?: string[];
  /** Texto continuo cuando no hay bullets. */
  description?: string;
};

export type EntryListPayload = { items: EntryListItem[] };

export type KeyValuePayload = {
  items: Array<{ key: string; value: string }>;
};

export type MediaGridItem = {
  title: string;
  description?: string;
  imageUrl?: string;
};

export type MediaGridPayload = { items: MediaGridItem[] };

/** Alfabeto cerrado de formas visuales. Cubre el ~95% de CVs reales. */
export type SectionShape =
  | "paragraph"
  | "tag_list"
  | "entry_list"
  | "key_value"
  | "media_grid";

export type SectionPayloadByShape = {
  paragraph: ParagraphPayload;
  tag_list: TagListPayload;
  entry_list: EntryListPayload;
  key_value: KeyValuePayload;
  media_grid: MediaGridPayload;
};

export type CvSection<S extends SectionShape = SectionShape> = {
  /** ID estable, usado para referenciar overrides desde variantes (por oferta). */
  id: string;
  shape: S;
  /** Título humano tal y como aparece en el CV ("Skills", "Platillos propios"). */
  title: string;
  /** Pista semántica opcional: "experience", "skills", "signature_dishes"... */
  semanticHint?: string;
  visible?: boolean;
  payload: SectionPayloadByShape[S];
};

export type CvData = {
  basics: CvBasics;
  sections: CvSection[];
};

/**
 * Una plantilla es, en esencia, una función que toma `CvData` y devuelve
 * un documento HTML completo. Cada plantilla decide internamente cómo
 * compone zonas, qué shapes muestra dónde y qué CSS usa. Los datos del CV
 * son los mismos para todas las plantillas.
 */
export type CvTemplate = {
  id: string;
  name: string;
  description: string;
  /** Render principal: `CvData` → documento HTML completo. */
  render: (data: CvData) => string;
};
