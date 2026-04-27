/**
 * API pública del sistema de plantillas, expuesta a la UI.
 *
 * El sistema interno vive en `lib/cvTemplates/`. Aquí solo re-exportamos lo
 * que necesita la UI (catálogo, render para preview, tipos) más algunos
 * helpers de transición que mantienen el contrato anterior estable.
 */

import { CV_TEMPLATES, renderCv } from "./cvTemplates/registry";
import { MOCK_CV_DATA } from "./cvTemplates/mockData";
import type { CvData, CvTemplate } from "./cvTemplates/types";

export type { CvData, CvTemplate } from "./cvTemplates/types";

/** Wireframes decorativos para plantillas aún no implementadas. */
export type CvWireframeKind =
  | "minimal"
  | "creative"
  | "timeline"
  | "functional"
  | "academic"
  | "tech"
  | "executive";

export type CvTemplateDefinition = {
  id: string;
  name: string;
  description: string;
  /** Placeholder visual cuando la plantilla aún no es renderizable. */
  wireframe?: CvWireframeKind;
};

/** Catálogo en orden de presentación. Todas son "live" si tienen una `CvTemplate` registrada. */
export const CV_TEMPLATE_CATALOG: CvTemplateDefinition[] = CV_TEMPLATES.map(
  (t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }),
);

/** Una plantilla es "live" si está registrada y, por tanto, renderizable. */
export function isLiveTemplate(t: CvTemplateDefinition): boolean {
  return CV_TEMPLATES.some((tpl) => tpl.id === t.id);
}

/** HTML listo para vista previa con datos de ejemplo. */
export function buildMockPreviewHtml(templateId: string): string {
  return renderCv(MOCK_CV_DATA, templateId);
}

/** Render real con datos del usuario. Lanza si la plantilla no existe. */
export function buildPreviewHtml(
  data: CvData,
  templateId: string,
): string {
  return renderCv(data, templateId);
}
