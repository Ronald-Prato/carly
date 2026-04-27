"use node";

import { v } from "convex/values";
import OpenAI from "openai";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { parseCvExtraction } from "../../lib/cvTemplates/schema";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const DEFAULT_CV_MODEL = "gpt-5.4-mini";
const DEFAULT_TEMPLATE_ID = "classic-sidebar";

/**
 * Extrae el CV en DOS partes en una sola llamada:
 *
 *   { data: CvData, summary: <string Markdown> }
 *
 * - `data` es la fuente de verdad estructurada (basics + sections con shapes).
 * - `summary` es un documento libre en Markdown puro, pensado para verse como
 *   una página de Notion. Sin HTML, sin frontmatter, sin code fences envolventes.
 *
 * El render visual (PDF, plantillas) usa `data`. La pestaña "Resumen" muestra
 * `summary` directamente como Markdown.
 */
const CV_SYSTEM = `Eres un extractor estructurador de currículums. Recibes un PDF (con
capacidad de comprensión visual: texto, columnas, tablas, iconos, banderas, firmas) y devuelves
EXCLUSIVAMENTE un objeto JSON válido con esta forma exacta:

{
  "data":   <CvData estructurado, ver abajo>,
  "summary": <string en Markdown, ver abajo>
}

Sin preámbulo, sin envolver en bloques de código, sin texto fuera del JSON.

============================
PARTE 1: "data" (CvData)
============================
{
  "basics": {
    "name": string,
    "headline": string?,
    "email": string?,
    "phone": string?,
    "location": string?,
    "photoUrl": string?,
    "links": [{ "label": string, "url": string? }]?
  },
  "sections": [
    {
      "id": string,
      "shape": "paragraph" | "tag_list" | "entry_list" | "key_value" | "media_grid",
      "title": string,
      "semanticHint": string?,
      "payload": <según shape>
    }
  ]
}

PAYLOAD POR SHAPE:
- paragraph:  { "text": string }
- tag_list:   { "items": string[] }
- entry_list: { "items": [
    { "headline": string,
      "subheadline": string?,
      "dateRange": string?,
      "location": string?,
      "bullets": string[]?,
      "description": string? }
  ] }
- key_value:  { "items": [{ "key": string, "value": string }] }
- media_grid: { "items": [{ "title": string, "description": string?, "imageUrl": string? }] }

REGLAS PARA "data":
- Mantén el idioma original del CV en TODOS los textos.
- Conserva el "title" tal y como aparece en el documento.
- Elige la "shape" según la FORMA visual del bloque, no su semántica:
    · Texto continuo en párrafo → paragraph.
    · Lista plana de etiquetas o ítems cortos → tag_list.
    · Lista de entradas con cargo/título/fecha/bullets → entry_list.
    · Pares clave/valor → key_value.
    · Lista con imágenes/fotos asociadas → media_grid.
- No inventes empleos, fechas ni cifras. Si algo no se lee con claridad, omítelo.
- Si una sección no encaja, usa "entry_list" como fallback antes que "paragraph".
- "id" único por sección, en kebab-case.

============================
PARTE 2: "summary" (Markdown)
============================
Documento Markdown PURO (CommonMark + GFM) que resuma el CV en estilo "página de Notion":
agradable de leer como documento, no como ficha técnica.

REQUISITOS:
- SOLO Markdown. NUNCA HTML, ni etiquetas <div>, <span>, <br>, etc.
- NO envolver en code fences (\`\`\`).
- NO incluir CSS, ni front-matter YAML, ni JSON dentro.
- Idioma: el del CV. No traduzcas.
- Estructura recomendada (adapta nombres de secciones al idioma del CV):

  # Nombre completo
  *Titular profesional*

  Contacto: email · teléfono · ubicación · enlaces relevantes

  ## Sobre mí
  Párrafo de introducción / perfil profesional, en prosa.

  ## Experiencia
  ### Cargo — Empresa
  *Fechas · Ubicación*
  - Logro / responsabilidad
  - Logro / responsabilidad

  ### (siguiente experiencia)
  ...

  ## Educación
  ### Título — Institución
  *Fechas*
  Notas relevantes (opcional)

  ## Skills
  - Skill A
  - Skill B
  - ...

  ## Idiomas
  - Idioma — Nivel

  ## (otras secciones que aparezcan en el CV: Proyectos, Certificaciones, Voluntariado…)

REGLAS DEL SUMMARY:
- Usa h1 (#) UNA vez para el nombre, h2 (##) para secciones, h3 (###) para entradas.
- Negritas con ** **, cursivas con * *. Nada de subrayado.
- Listas con "-" (no asteriscos).
- Línea en blanco entre bloques.
- No repitas información trivialmente: el summary debe leerse de corrido como una página, no como una tabla.
- No inventes datos que no estén en el PDF.

Devuelve EXCLUSIVAMENTE el objeto JSON con las dos claves.`;

const CV_USER = `Devuelve el JSON con { data, summary } en el idioma del PDF.`;

function stripCodeFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return s;
}

export const enrichFromPdf = action({
  args: { resumeId: v.id("resumes") },
  handler: async (ctx, args) => {
    const me = await ctx.runQuery(api.database.users.getCurrent, {});
    if (!me) {
      return { ok: false as const, error: "Debes iniciar sesión." };
    }
    const source = await ctx.runQuery(api.storage.resume.getByIdForEnrichment, {
      resumeId: args.resumeId,
    });
    if (!source) {
      return { ok: false as const, error: "No se encontró la hoja de vida." };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      const msg = "Falta OPENAI_API_KEY en el entorno de Convex.";
      await ctx.runMutation(internal.cv.enrichmentState.applyError, {
        resumeId: args.resumeId,
        userId: me._id,
        errorMessage: msg,
      });
      return { ok: false as const, error: msg };
    }

    const model = (process.env.OPENAI_CV_MODEL ?? DEFAULT_CV_MODEL).trim();

    await ctx.runMutation(internal.cv.enrichmentState.setProcessing, {
      resumeId: args.resumeId,
      userId: me._id,
    });

    try {
      const res = await fetch(source.downloadUrl);
      if (!res.ok) {
        throw new Error("No se pudo descargar el PDF desde el almacenamiento.");
      }
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_PDF_BYTES) {
        throw new Error("El PDF supera el tamaño máximo permitido para análisis.");
      }
      const b64 = Buffer.from(ab).toString("base64");
      const pdfDataUrl = `data:application/pdf;base64,${b64}`;
      const openai = new OpenAI({ apiKey });

      const completion = await openai.chat.completions.create({
        model,
        max_completion_tokens: 16000,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CV_SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "file",
                file: {
                  file_data: pdfDataUrl,
                  filename: source.fileName || "cv.pdf",
                },
              },
              { type: "text", text: CV_USER },
            ],
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      if (typeof raw !== "string" || !raw.trim()) {
        throw new Error("El modelo no devolvió un JSON utilizable.");
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(stripCodeFences(raw));
      } catch {
        throw new Error("La respuesta del modelo no es JSON válido.");
      }

      let extracted;
      try {
        extracted = parseCvExtraction(parsedJson);
      } catch (e) {
        const msg =
          e instanceof Error
            ? `JSON con forma inesperada: ${e.message}`
            : "JSON con forma inesperada.";
        throw new Error(msg);
      }

      await ctx.runMutation(internal.cv.enrichmentState.applySuccess, {
        resumeId: args.resumeId,
        userId: me._id,
        /** `content` ahora es Markdown puro (estilo página de Notion).
         *  El render visual con plantillas se hace bajo demanda desde `data`. */
        content: extracted.summary,
        data: extracted.data,
        templateId: DEFAULT_TEMPLATE_ID,
      });
      return { ok: true as const };
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Error desconocido al enriquecer la hoja de vida.";
      await ctx.runMutation(internal.cv.enrichmentState.applyError, {
        resumeId: args.resumeId,
        userId: me._id,
        errorMessage: message,
      });
      return { ok: false as const, error: message };
    }
  },
});
