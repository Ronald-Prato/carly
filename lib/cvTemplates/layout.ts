/**
 * Utilidades de layout del CV en el editor. La geometría compartida con el PDF
 * está en `cvGeometry.ts`.
 */

/** Clases legadas de la paginación multi-hoja (por si queda HTML en localStorage). */
const LEGACY_MAIN_PAGER_CLASS = "carly-main-pager";
const LEGACY_SHEET_CLASS = "carly-sheet";
const LEGACY_SHEET_INNER_CLASS = "carly-sheet-inner";

/**
 * Quita restos de la paginación antigua (hojas apiladas) y deja un `.main` plano.
 * También limpia clases/estilos en `.cv-container` asociados a esa vista.
 */
export function stripCvPagingChromeFromDocument(doc: Document): void {
  const pager = doc.querySelector(`.main.${LEGACY_MAIN_PAGER_CLASS}`);
  if (pager) {
    const collected: HTMLElement[] = [];
    for (const sheet of pager.querySelectorAll(
      `:scope > .${LEGACY_SHEET_CLASS}`,
    )) {
      const inner = sheet.querySelector(
        `:scope > .${LEGACY_SHEET_INNER_CLASS}`,
      );
      if (!inner) continue;
      for (const child of [...inner.children]) {
        if (child instanceof HTMLElement) collected.push(child);
      }
    }
    const main = doc.createElement("div");
    main.className = "main";
    for (const c of collected) {
      main.appendChild(c);
    }
    pager.replaceWith(main);
  }

  const root = doc.querySelector<HTMLElement>(".cv-container");
  if (root) {
    root.classList.remove("carly-paged");
    root.style.removeProperty("min-height");
    root.style.removeProperty("--cv-sheet-h");
  }
}

export { CV_PAGE_WIDTH_PX, cvSheetHeightPx } from "./cvGeometry";
