/**
 * Edición por bloques dentro del documento del iframe (doble clic).
 * Los selectores siguen el HTML que generan `classicSidebar` + `shapes`.
 */

export const CV_EDITABLE_BLOCK_SELECTOR = [
  ".cv-container .profile .name",
  ".cv-container .profile .role",
  ".cv-container .section-title",
  ".cv-container .main-title",
  ".cv-container .list > li",
  ".cv-container .main-section > p",
  ".cv-container .main-section > ul:not(.list) > li",
  ".cv-container .item-sub",
  ".cv-container .item-header span",
  ".cv-container .item ul > li",
  ".cv-container .item > p",
  ".cv-container .media-card strong",
  ".cv-container .media-card p",
].join(", ");

/**
 * Quita el “marco” gris claro del body de la plantilla (p. ej. #eaeaea + padding)
 * para que solo se vea la hoja `.cv-container` sobre el fondo del editor.
 */
export const CV_EDITOR_SHELL_STYLES = `
  html, body {
    background: transparent !important;
    padding: 0 !important;
    margin: 0 !important;
    min-height: 100%;
  }
`.trim();

export const CV_BLOCK_EDITOR_STYLES = `
  .carly-editable-block {
    cursor: text;
    border-radius: 2px;
    transition: background-color 0.12s ease, box-shadow 0.12s ease;
  }
  .carly-editable-block:hover {
    box-shadow: inset 0 0 0 1px rgba(124, 58, 237, 0.35);
    background-color: rgba(124, 58, 237, 0.04);
  }
  .carly-block-editing {
    outline: 2px solid rgb(124, 58, 237) !important;
    outline-offset: 2px;
    background-color: rgba(255, 255, 255, 0.98) !important;
    min-height: 1.25em;
  }
`.trim();

/**
 * Impresión: hoja tipo **carta** (US Letter 8.5"×11"), sin márgenes de página
 * (sangrado al borde físico) y ancho del CV al 100% del área imprimible.
 */
export const CV_PRINT_MATCH_STYLES = `
@page {
  margin: 0;
  size: 8.5in 11in;
}

@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    background: #ffffff !important;
    padding: 0 !important;
    margin: 0 !important;
    min-height: 0 !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
  }
  .cv-container {
    display: flex !important;
    flex-direction: row !important;
    align-items: stretch !important;
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
    min-height: 0 !important;
    margin: 0 !important;
    background: #ffffff !important;
    box-shadow: none !important;
  }
  .sidebar {
    width: 30% !important;
    flex: 0 0 30% !important;
    max-width: 30% !important;
    min-width: 0 !important;
    background: #1f2a36 !important;
    color: #ffffff !important;
    padding: 30px 20px !important;
  }
  .main {
    width: 70% !important;
    flex: 0 0 70% !important;
    max-width: 70% !important;
    min-width: 0 !important;
    padding: 35px 35px !important;
    box-sizing: border-box !important;
  }
  .item-header {
    display: flex !important;
    flex-wrap: nowrap !important;
    justify-content: space-between !important;
    align-items: flex-start !important;
    gap: 12px !important;
  }
  .item-header > span:first-child {
    flex: 1 1 auto !important;
    min-width: 0 !important;
  }
  .item-header > span:last-child {
    flex: 0 0 auto !important;
    white-space: nowrap !important;
  }
  .carly-editable-block,
  .carly-block-editing {
    box-shadow: none !important;
    outline: none !important;
    background-color: transparent !important;
  }
}
`.trim();

export type CvIframeBlockEditorApi = {
  /** Confirma el texto editado y cierra el modo edición (p. ej. al salir del editor). */
  commit: () => void;
  /** Restaura el HTML previo al doble clic y cierra. */
  cancel: () => void;
  /** Quita listeners y cancela edición activa. */
  dispose: () => void;
  /** Elemento en edición, si hay. */
  getActive: () => HTMLElement | null;
};

export function attachCvIframeBlockEditor(
  doc: Document,
  options: {
    /** Se llama al editar texto (input) o al confirmar un bloque; útil para persistir con debounce. */
    onBlockInput?: () => void;
  },
): CvIframeBlockEditorApi {
  let activeEl: HTMLElement | null = null;

  const onBlockInput = () => {
    options.onBlockInput?.();
  };

  const markBlocks = () => {
    for (const el of doc.querySelectorAll<HTMLElement>(CV_EDITABLE_BLOCK_SELECTOR)) {
      if (!doc.body.contains(el)) continue;
      if (el.closest(".carly-skip-editable")) continue;
      el.classList.add("carly-editable-block");
    }
  };

  const clearEditingClass = () => {
    for (const el of doc.querySelectorAll(".carly-editable-block")) {
      el.classList.remove("carly-editable-block");
    }
  };

  const onBlurCommit = () => {
    if (!activeEl) return;
    activeEl.removeEventListener("blur", onBlurCommit);
    commitInternal();
  };

  const cancelInternal = (restore: boolean) => {
    if (!activeEl) return;
    activeEl.removeEventListener("input", onBlockInput);
    activeEl.removeEventListener("blur", onBlurCommit);
    if (restore && activeEl.dataset.carlyHtmlSnapshot !== undefined) {
      activeEl.innerHTML = activeEl.dataset.carlyHtmlSnapshot;
    }
    delete activeEl.dataset.carlyHtmlSnapshot;
    activeEl.removeAttribute("contenteditable");
    activeEl.removeAttribute("spellcheck");
    activeEl.classList.remove("carly-block-editing");
    activeEl = null;
  };

  const commitInternal = () => {
    if (!activeEl) return;
    activeEl.removeEventListener("input", onBlockInput);
    activeEl.removeEventListener("blur", onBlurCommit);
    delete activeEl.dataset.carlyHtmlSnapshot;
    activeEl.removeAttribute("contenteditable");
    activeEl.removeAttribute("spellcheck");
    activeEl.classList.remove("carly-block-editing");
    activeEl = null;
    options.onBlockInput?.();
  };

  const beginEdit = (el: HTMLElement) => {
    if (activeEl === el) return;
    if (activeEl && activeEl !== el) {
      commitInternal();
    }
    activeEl = el;
    activeEl.dataset.carlyHtmlSnapshot = activeEl.innerHTML;
    activeEl.setAttribute("contenteditable", "true");
    activeEl.setAttribute("spellcheck", "true");
    activeEl.classList.add("carly-block-editing");
    activeEl.focus();
    const win = doc.defaultView;
    const sel = win?.getSelection();
    if (sel) {
      const range = doc.createRange();
      range.selectNodeContents(activeEl);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    activeEl.addEventListener("input", onBlockInput);
    activeEl.addEventListener("blur", onBlurCommit);
  };

  const onDblClick = (e: MouseEvent) => {
    const t = e.target as Node | null;
    if (!t || t.nodeType !== Node.ELEMENT_NODE) return;
    const hit = (t as HTMLElement).closest<HTMLElement>(CV_EDITABLE_BLOCK_SELECTOR);
    if (!hit || !doc.body.contains(hit)) return;
    if (hit.closest(".carly-skip-editable")) return;
    e.preventDefault();
    e.stopPropagation();
    beginEdit(hit);
  };

  /** Clic fuera del bloque activo (p. ej. fondo del CV): sin blur fiable, cerramos en captura. */
  const onDocMouseDown = (e: MouseEvent) => {
    if (!activeEl) return;
    const t = e.target as Node | null;
    if (!t || activeEl.contains(t)) return;
    commitInternal();
  };

  /** Clic en la UI del padre (toolbar): el iframe pierde foco; asegura cierre si blur no llegó. */
  const onIframeWindowBlur = () => {
    commitInternal();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && activeEl) {
      e.preventDefault();
      e.stopPropagation();
      commitInternal();
    }
  };

  markBlocks();
  doc.body.addEventListener("dblclick", onDblClick, true);
  doc.addEventListener("mousedown", onDocMouseDown, true);
  doc.addEventListener("keydown", onKeyDown, true);
  const win = doc.defaultView;
  win?.addEventListener("blur", onIframeWindowBlur);

  return {
    getActive: () => activeEl,
    commit: () => {
      commitInternal();
    },
    cancel: () => {
      cancelInternal(true);
    },
    dispose: () => {
      doc.body.removeEventListener("dblclick", onDblClick, true);
      doc.removeEventListener("mousedown", onDocMouseDown, true);
      doc.removeEventListener("keydown", onKeyDown, true);
      win?.removeEventListener("blur", onIframeWindowBlur);
      cancelInternal(true);
      clearEditingClass();
    },
  };
}

export function cvTemplateDraftStorageKey(
  resumeId: string,
  templateId: string,
): string {
  return `carly.cvTemplateDraft:${resumeId}:${templateId}`;
}
