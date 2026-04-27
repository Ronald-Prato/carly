"use node";

import { v } from "convex/values";
import OpenAI from "openai";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const DEFAULT_CV_MODEL = "gpt-5.4-mini";

const CV_SYSTEM = `Eres un extractor estructurador de currículums. Analizas el PDF de la hoja de vida
(incluido con capacidad de comprensión visual: texto, columnas, tablas, iconos, banderas o firmas) y
produces UNA ÚNICA salida: HTML semántico.

Idioma del contenido (obligatorio):
- Detecta el idioma en el que está redactada la hoja de vida (p. ej. español, inglés, francés, alemán,
  italiano, portugués, catalán, etc.). Si hay varios idiomas mezclados, respeta el idioma de cada bloque
  tal como aparece en el documento.
- TODO el HTML que generes —incluidos títulos de sección, encabezados (h1–h3), pies de tabla, viñetas,
  etiquetas de campos, rótulos de columnas y cualquier texto visible en la plantilla— debe estar en
  ESE MISMO idioma (o en el idioma correspondiente a cada parte en un CV bilingüe). No traduzcas al
  español ni a otro idioma distinto del del documento salvo que el propio PDF ya mezcle idiomas de
  forma equivalente.
- No generes rúbricas genéricas en un idioma fijo (p. ej. "Work experience", "Education") si el
  original dice otra cosa en otro idioma: copia o refleja la redacción del PDF en el idioma correcto.

Requisitos del HTML:
- Formato inspirado en Europass/CV europeo: secciones claras (identificación, experiencia, educación,
  competencias, idiomas, si aparecen) usando etiquetas como section, h1–h3, p, ul, li, table solo si
  mejora la legibilidad.
- Incluye TODA la información de contacto y personal visible: nombre completo, dirección(es), correo(s),
  teléfono(s) u otros canales, nacionalidad o fecha de nacimiento SOLO si figuran en el documento
  (no inventes).
- No inventes empleos, fechas, titulaciones ni cifras: si algo no se lee con seguridad, omítelo o
  indícalo brevemente en el MISMO idioma del documento con una breve marca del estilo "(ilegible)" o
  la fórmula natural equivalente en ese idioma.
- No uses Markdown. No envuelvas el HTML en comillas explicativas. Sin preámbulo ni cierre: solo
  el fragmento HTML.`;

const CV_USER = `Devuelve exclusivamente un fragmento HTML (sin <!DOCTYPE> ni <html> envolvente) que
represente fielmente el CV del PDF, en estilo Europass. El bloque debe reflejar el idioma del PDF en
cuerpo de texto, encabezados y títulos de sección alineados con el original. Incluye nombres, direcciones
y teléfonos tal como constan en la hoja de vida.`;

function sanitizeExtractedHtml(raw: string): string {
  let html = raw.trim();
  if (html.startsWith("```")) {
    html = html
      .replace(/^```(?:html)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
  if (/<\s*script/i.test(html)) {
    html = html.replace(
      /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi,
      "",
    );
  }
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return html;
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

    const model = (
      process.env.OPENAI_CV_MODEL ?? DEFAULT_CV_MODEL
    ).trim();

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
      /** OpenAI exige un data URL completo, no solo el base64 crudo. */
      const pdfDataUrl = `data:application/pdf;base64,${b64}`;
      const openai = new OpenAI({ apiKey });

      const completion = await openai.chat.completions.create({
        model,
        max_completion_tokens: 16000,
        temperature: 0.1,
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
        throw new Error("El modelo no devolvió HTML utilizable.");
      }
      const content = sanitizeExtractedHtml(raw);
      if (!content) {
        throw new Error("El HTML resultante quedó vacío tras la validación.");
      }

      await ctx.runMutation(internal.cv.enrichmentState.applySuccess, {
        resumeId: args.resumeId,
        userId: me._id,
        content,
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
