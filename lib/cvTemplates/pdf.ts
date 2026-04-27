"use client";

/**
 * Genera y descarga un PDF a partir de `CvData` + plantilla.
 *
 * Estrategia: renderizamos el HTML de la plantilla en un iframe oculto,
 * capturamos el `.cv-container` con html2canvas-pro y armamos un PDF jsPDF
 * recortando el canvas en segmentos con costuras en filas de poca tinta.
 *
 * Trade-off conocido: el texto del PDF queda rasterizado (no seleccionable).
 * Aceptable para v1; si se necesita texto seleccionable más adelante, se
 * puede migrar a un renderer vectorial (@react-pdf/renderer o Puppeteer en
 * el servidor) sin cambiar `CvData` ni las plantillas.
 *
 * Paginación: buscamos **costuras** por mínima “tinta” (no máx. luminancia:
 * el antialiasing deja grises que confunden). Recortamos por segmentos y
 * dibujamos cada JPEG en el PDF **sin deformar** (misma escala ancho/alto que
 * el canvas completo a 210 mm); el hueco inferior de cada A4 queda en blanco.
 */

import { renderCv } from "./registry";
import type { CvData } from "./types";

const A4_MM = { width: 210, height: 297 };
/** Ancho de renderizado del documento en CSS pixels (coincide con `max-width: 1000px` del template). */
const RENDER_WIDTH_PX = 1000;

/** Solo la columna principal (sidebar ~30% izquierda en “clásica lateral”). */
const SEAM_CONTENT_X_RATIO = 0.32;

function luminanceAt(d: Uint8ClampedArray, i: number): number {
  return 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
}

/**
 * Fila con menos tinta en [yLo, yHi]: mejor costura entre líneas.
 * Suavizado + preferencia por mínimos locales; si no hay, el mínimo global.
 */
function findBestSeamY(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  yLo: number,
  yHi: number,
  contentX0: number,
  preferenceY: number,
): number {
  const x0 = Math.max(0, Math.min(Math.floor(contentX0), width - 2));
  const w = width - x0;
  if (w <= 1 || yHi <= yLo) {
    return Math.min(height - 1, Math.max(1, Math.round(preferenceY)));
  }
  const rowCount = yHi - yLo + 1;
  const img = ctx.getImageData(x0, yLo, w, rowCount);
  const d = img.data;
  const ink = new Float64Array(rowCount);
  for (let row = 0; row < rowCount; row++) {
    let sum = 0;
    const off = row * w * 4;
    for (let col = 0; col < w; col++) {
      const i = off + col * 4;
      sum += 255 - luminanceAt(d, i);
    }
    ink[row] = sum / w;
  }
  const smooth = new Float64Array(rowCount);
  for (let row = 0; row < rowCount; row++) {
    let a = ink[row]!;
    let n = 1;
    if (row > 0) {
      a += ink[row - 1]!;
      n++;
    }
    if (row < rowCount - 1) {
      a += ink[row + 1]!;
      n++;
    }
    smooth[row] = a / n;
  }
  const prefRow = Math.max(0, Math.min(rowCount - 1, Math.round(preferenceY - yLo)));
  const localMinIdx: number[] = [];
  for (let row = 1; row < rowCount - 1; row++) {
    const v = smooth[row]!;
    if (v <= smooth[row - 1]! && v <= smooth[row + 1]!) {
      localMinIdx.push(row);
    }
  }
  let pick = prefRow;
  if (localMinIdx.length > 0) {
    localMinIdx.sort(
      (a, b) =>
        Math.abs(a - prefRow) - Math.abs(b - prefRow) ||
        smooth[a]! - smooth[b]!,
    );
    pick = localMinIdx[0]!;
  } else {
    for (let row = 1; row < rowCount; row++) {
      if (smooth[row]! < smooth[pick]!) pick = row;
    }
  }
  return Math.min(height - 1, Math.max(1, yLo + pick));
}

/** Altura en píxeles de canvas que equivale a una página A4 al ancho `width`. */
function pageSliceHeightPx(width: number): number {
  return (A4_MM.height / A4_MM.width) * width;
}

/** Lista de offsets Y (0…height) donde cortar; el último valor es siempre `height`. */
function buildPageBreakYs(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  contentX0: number,
): number[] {
  const slicePx = pageSliceHeightPx(width);
  const breaks: number[] = [0];
  let y = 0;
  /** No acortar una página por debajo de ~55% de una A4 (evita bucles raros). */
  const minStep = Math.max(80, Math.floor(slicePx * 0.55));
  /** No alargar una página más de ~15% sobre una A4. */
  const maxStep = Math.floor(slicePx * 1.12);

  while (y < height - 1) {
    const remaining = height - y;
    if (remaining <= slicePx + 2) {
      breaks.push(height);
      break;
    }
    const nominal = y + slicePx;
    const yLo = Math.max(y + minStep, Math.floor(nominal - 160));
    const yHi = Math.min(height - 2, Math.ceil(nominal + 72));
    let seam = findBestSeamY(ctx, width, height, yLo, yHi, contentX0, nominal);
    if (seam <= y) seam = Math.min(height, y + Math.floor(slicePx));
    seam = Math.min(y + maxStep, Math.max(y + minStep, seam));
    breaks.push(seam);
    y = seam;
  }
  if (breaks[breaks.length - 1] !== height) {
    breaks.push(height);
  }
  return breaks;
}

type DocumentWithFonts = Document & {
  fonts?: { ready: Promise<unknown> };
};

async function waitForIframeReady(iframe: HTMLIFrameElement): Promise<void> {
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument as DocumentWithFonts | null;
  if (!win || !doc) return;
  if (doc.readyState !== "complete") {
    await new Promise<void>((resolve) => {
      win.addEventListener("load", () => resolve(), { once: true });
    });
  }
  if (doc.fonts?.ready) {
    try {
      await doc.fonts.ready;
    } catch {
      /* noop */
    }
  }
  /** Pequeña espera para que estilos/imágenes terminen de pintarse. */
  await new Promise((r) => setTimeout(r, 80));
}

export type DownloadCvAsPdfArgs = {
  data: CvData;
  templateId: string;
  /** Nombre del archivo SIN extensión. */
  fileName: string;
};

export async function downloadCvAsPdf(args: DownloadCvAsPdfArgs): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("downloadCvAsPdf solo puede ejecutarse en el cliente.");
  }

  const html = renderCv(args.data, args.templateId);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = `${RENDER_WIDTH_PX}px`;
  iframe.style.height = "1px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) {
      throw new Error("No se pudo crear el documento de impresión.");
    }
    doc.open();
    doc.write(html);
    doc.close();

    await waitForIframeReady(iframe);

    const target = doc.querySelector<HTMLElement>(".cv-container");
    if (!target) {
      throw new Error("La plantilla no expone un contenedor `.cv-container`.");
    }

    /**
     * Estiramos `.cv-container` a un múltiplo exacto de página A4 ANTES de
     * capturar. Como es `display: flex` con `align-items: stretch` por defecto,
     * la sidebar se extiende automáticamente hasta abajo en TODAS las páginas
     * (incluida la última, donde antes quedaba un hueco blanco).
     */
    const pagePxAtRenderWidth =
      (RENDER_WIDTH_PX * A4_MM.height) / A4_MM.width;
    const naturalHeight = Math.max(target.scrollHeight, 1);
    const pages = Math.max(1, Math.ceil(naturalHeight / pagePxAtRenderWidth));
    const paddedHeight = Math.round(pages * pagePxAtRenderWidth);
    target.style.minHeight = `${paddedHeight}px`;

    /** Ajustamos el iframe para que html2canvas pueda pintar el documento entero. */
    iframe.style.height = `${paddedHeight}px`;

    /** Imports dinámicos: estas libs solo viven en el cliente y son pesadas;
     *  evitamos cargarlas en el bundle inicial de Next.js. */
    const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
      import("html2canvas-pro"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });

    const pdf = new JsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });

    const ctx2d = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx2d) {
      throw new Error("No se pudo leer el canvas del CV.");
    }

    const contentX0 = canvas.width * SEAM_CONTENT_X_RATIO;
    const breakYs = buildPageBreakYs(
      ctx2d,
      canvas.width,
      canvas.height,
      contentX0,
    );

    const imgWidthMm = A4_MM.width;

    for (let i = 0; i < breakYs.length - 1; i++) {
      if (i > 0) {
        pdf.addPage();
      }
      const y0 = breakYs[i]!;
      const y1 = breakYs[i + 1]!;
      const sliceH = Math.max(1, y1 - y0);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const pctx = pageCanvas.getContext("2d");
      if (!pctx) {
        throw new Error("No se pudo crear canvas de página.");
      }
      pctx.fillStyle = "#ffffff";
      pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pctx.drawImage(canvas, 0, y0, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const sliceUrl = pageCanvas.toDataURL("image/jpeg", 0.95);
      /** Misma escala que el documento completo a 210 mm de ancho → alto en mm proporcional (sin estirar). */
      let drawHmm = imgWidthMm * (sliceH / canvas.width);
      let drawWmm = imgWidthMm;
      if (drawHmm > A4_MM.height) {
        const s = A4_MM.height / drawHmm;
        drawHmm = A4_MM.height;
        drawWmm = imgWidthMm * s;
      }
      const xOff = (A4_MM.width - drawWmm) / 2;
      pdf.addImage(sliceUrl, "JPEG", xOff, 0, drawWmm, drawHmm);
    }

    const safeName = args.fileName.replace(/[^\w\-]+/g, "_") || "cv";
    pdf.save(`${safeName}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}
