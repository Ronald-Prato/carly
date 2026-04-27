/**
 * Renderers por defecto para cada shape. Una plantilla puede sobreescribir
 * cualquiera para darle un acabado propio, pero estos defaults bastan para
 * empezar y son los que usa `classicSidebar`.
 *
 * Estos renderers asumen el "lenguaje CSS" de classicSidebar (clases como
 * `.section-title`, `.main-title`, `.item`, `.list`...). Para una plantilla
 * con CSS muy distinto, se proveen renderers propios.
 */

import type { CvSection } from "./types";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const esc = escapeHtml;

export function renderParagraphMain(section: CvSection<"paragraph">): string {
  const t = section.payload.text?.trim();
  if (!t) return "";
  return `<div class="main-section">
    <div class="main-title">${esc(section.title)}</div>
    <p>${esc(t)}</p>
  </div>`;
}

export function renderTagListSidebar(section: CvSection<"tag_list">): string {
  const items = section.payload.items?.filter((s) => s.trim().length > 0) ?? [];
  if (items.length === 0) return "";
  const lis = items.map((s) => `<li>${esc(s)}</li>`).join("");
  return `<div class="section">
    <div class="section-title">${esc(section.title.toUpperCase())}</div>
    <ul class="list">${lis}</ul>
  </div>`;
}

export function renderTagListMain(section: CvSection<"tag_list">): string {
  const items = section.payload.items?.filter((s) => s.trim().length > 0) ?? [];
  if (items.length === 0) return "";
  const lis = items.map((s) => `<li>${esc(s)}</li>`).join("");
  return `<div class="main-section">
    <div class="main-title">${esc(section.title)}</div>
    <ul class="list">${lis}</ul>
  </div>`;
}

export function renderEntryListMain(section: CvSection<"entry_list">): string {
  const items = section.payload.items ?? [];
  if (items.length === 0) return "";
  const blocks = items
    .map((item) => {
      const headline = [item.headline, item.subheadline]
        .filter((s) => s && s.trim().length > 0)
        .map((s) => esc(s as string))
        .join(" — ");
      const right = item.dateRange ? `<span>${esc(item.dateRange)}</span>` : "";
      const sub = item.location
        ? `<div class="item-sub">${esc(item.location)}</div>`
        : "";
      const body = item.bullets?.length
        ? `<ul>${item.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
        : item.description
          ? `<p>${esc(item.description)}</p>`
          : "";
      return `<div class="item">
        <div class="item-header"><span>${headline}</span>${right}</div>
        ${sub}
        ${body}
      </div>`;
    })
    .join("");
  return `<div class="main-section">
    <div class="main-title">${esc(section.title)}</div>
    ${blocks}
  </div>`;
}

export function renderKeyValueSidebar(section: CvSection<"key_value">): string {
  const items = section.payload.items ?? [];
  if (items.length === 0) return "";
  const lis = items
    .map(
      (kv) =>
        `<li><strong>${esc(kv.key)}:</strong> ${esc(kv.value)}</li>`,
    )
    .join("");
  return `<div class="section">
    <div class="section-title">${esc(section.title.toUpperCase())}</div>
    <ul class="list">${lis}</ul>
  </div>`;
}

export function renderKeyValueMain(section: CvSection<"key_value">): string {
  const items = section.payload.items ?? [];
  if (items.length === 0) return "";
  const lis = items
    .map(
      (kv) =>
        `<li><strong>${esc(kv.key)}:</strong> ${esc(kv.value)}</li>`,
    )
    .join("");
  return `<div class="main-section">
    <div class="main-title">${esc(section.title)}</div>
    <ul>${lis}</ul>
  </div>`;
}

export function renderMediaGridMain(section: CvSection<"media_grid">): string {
  const items = section.payload.items ?? [];
  if (items.length === 0) return "";
  const cards = items
    .map((it) => {
      const img = it.imageUrl
        ? `<img src="${esc(it.imageUrl)}" alt="${esc(it.title)}" />`
        : "";
      const desc = it.description
        ? `<p>${esc(it.description)}</p>`
        : "";
      return `<div class="media-card">${img}<strong>${esc(it.title)}</strong>${desc}</div>`;
    })
    .join("");
  return `<div class="main-section">
    <div class="main-title">${esc(section.title)}</div>
    <div class="media-grid">${cards}</div>
  </div>`;
}

