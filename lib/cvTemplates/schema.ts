/**
 * Validación runtime de CvData con Zod.
 *
 * El extractor de OpenAI puede devolver JSON con shape ligeramente desviado;
 * este validador es **tolerante**: deja `payload` como objeto libre porque la
 * unión discriminada por shape no es expresable de forma limpia en JSON Schema
 * sin verbosidad excesiva. Los renderers de `shapes.ts` ya manejan campos
 * faltantes con fallbacks (no lanzan).
 */

import { z } from "zod";
import type { CvData } from "./types";

/**
 * Helpers tolerantes: los modelos LLM suelen devolver `null` para campos
 * opcionales en lugar de omitirlos. Los normalizamos a `undefined` para que
 * el resto del código (renderers, tipos) trabaje con un único caso ausente.
 */
const optionalString = z
  .string()
  .nullish()
  .transform((v) => (v == null || v === "" ? undefined : v));

const optionalBoolean = z
  .boolean()
  .nullish()
  .transform((v) => (v == null ? undefined : v));

const LinkSchema = z.object({
  label: z.string(),
  url: optionalString,
});

const BasicsSchema = z.object({
  name: z.string().min(1),
  headline: optionalString,
  email: optionalString,
  phone: optionalString,
  location: optionalString,
  photoUrl: optionalString,
  links: z
    .array(LinkSchema)
    .nullish()
    .transform((v) => (v == null ? undefined : v)),
});

const SectionShapeSchema = z.enum([
  "paragraph",
  "tag_list",
  "entry_list",
  "key_value",
  "media_grid",
]);

const SectionSchema = z.object({
  id: z.string().min(1),
  shape: SectionShapeSchema,
  title: z.string().min(1),
  semanticHint: optionalString,
  visible: optionalBoolean,
  /** Payload tipado por shape; aceptamos objeto libre y validamos en render. */
  payload: z.record(z.string(), z.unknown()),
});

export const CvDataSchema = z.object({
  basics: BasicsSchema,
  sections: z.array(SectionSchema),
});

export function parseCvData(input: unknown): CvData {
  /** Zod parse aplica narrowing; el cast a CvData es seguro porque payload
   *  acepta cualquier shape y los renderers son tolerantes a campos ausentes. */
  return CvDataSchema.parse(input) as CvData;
}

/**
 * Wrapper que devuelve el extractor: la fuente de verdad estructurada
 * (`data`) más un resumen libre en Markdown (`summary`). El summary se
 * guarda tal cual en `resumes.content` para vista tipo "página de Notion".
 */
export const CvExtractionSchema = z.object({
  data: CvDataSchema,
  summary: z.string().min(1),
});

export type CvExtraction = z.infer<typeof CvExtractionSchema>;

export function parseCvExtraction(input: unknown): {
  data: CvData;
  summary: string;
} {
  const r = CvExtractionSchema.parse(input);
  return { data: r.data as CvData, summary: r.summary };
}
