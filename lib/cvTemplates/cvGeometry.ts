/** Ancho lógico del CV en px (plantilla, editor, captura PDF). */
export const CV_PAGE_WIDTH_PX = 1000;

const A4_W_MM = 210;
const A4_H_MM = 297;

/** Alto en px de una hoja A4 vertical a la escala `widthPx`. */
export function cvSheetHeightPx(widthPx: number = CV_PAGE_WIDTH_PX): number {
  return (A4_H_MM / A4_W_MM) * widthPx;
}
