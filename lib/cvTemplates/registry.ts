/**
 * Registro de plantillas activas + funciones de render de alto nivel.
 *
 * Para añadir una plantilla nueva:
 *   1. Crear `lib/cvTemplates/<nombre>.ts` exportando un `CvTemplate`.
 *   2. Importarla aquí y añadirla a `CV_TEMPLATES`.
 *
 * No hay que tocar el schema, ni los renderers de shapes, ni los datos del CV.
 */

import { classicSidebarTemplate } from "./classicSidebar";
import type { CvData, CvTemplate } from "./types";

export const CV_TEMPLATES: CvTemplate[] = [classicSidebarTemplate];

export function getTemplate(templateId: string): CvTemplate | null {
  return CV_TEMPLATES.find((t) => t.id === templateId) ?? null;
}

/** Render del CV completo: `data` + plantilla → documento HTML. */
export function renderCv(data: CvData, templateId: string): string {
  const tpl = getTemplate(templateId);
  if (!tpl) {
    throw new Error(`Plantilla desconocida: ${templateId}`);
  }
  return tpl.render(data);
}
