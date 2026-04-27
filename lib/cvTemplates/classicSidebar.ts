/**
 * Plantilla "Clásica lateral": dos columnas, sidebar oscura con contacto y
 * datos compactos, columna principal con resumen y experiencia.
 *
 * El CSS proviene del archivo original `public/cv-templates/1.html` y se
 * preserva al 100% para mantener la identidad visual. Lo único que cambia
 * es que ya no es un HTML estático con placeholders, sino una función que
 * compone el documento desde `CvData`.
 */

import {
  escapeHtml,
  renderEntryListMain,
  renderKeyValueMain,
  renderKeyValueSidebar,
  renderMediaGridMain,
  renderParagraphMain,
  renderTagListMain,
  renderTagListSidebar,
} from "./shapes";
import type {
  CvBasics,
  CvData,
  CvSection,
  CvTemplate,
  SectionShape,
} from "./types";

const esc = escapeHtml;

export const CLASSIC_SIDEBAR_STYLES = `
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
}
body {
  background: #eaeaea;
  padding: 30px;
}
.cv-container {
  display: flex;
  max-width: 1000px;
  margin: auto;
  background: white;
  min-height: 297mm;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
}
.sidebar {
  width: 30%;
  background: #1f2a36;
  color: white;
  padding: 30px 20px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.profile { text-align: center; }
.profile img {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 15px;
}
.name { font-size: 22px; font-weight: 600; margin-bottom: 5px; }
.role { font-size: 14px; color: #9aa6b2; }
.section { margin-top: 10px; }
.section-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 6px;
}
.list { list-style: none; font-size: 14px; line-height: 1.6; }
.list li { margin-bottom: 6px; }
.main { width: 70%; padding: 35px 35px; }
.main-section { margin-bottom: 35px; }
.main-title { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
.item { margin-bottom: 20px; }
.item-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 4px;
}
.item-sub { font-size: 14px; color: #666; margin-bottom: 8px; }
.item ul, .main-section > ul { padding-left: 18px; }
.item li, .main-section > ul li { margin-bottom: 6px; line-height: 1.5; }
p { line-height: 1.6; color: #333; }
.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.media-card {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  line-height: 1.4;
}
.media-card img {
  width: 100%;
  height: 110px;
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 8px;
}
.media-card strong { display: block; margin-bottom: 4px; }
.hidden { display: none; }
`.trim();

/**
 * Shapes que viven en sidebar (compactas, etiquetas/listas cortas).
 * El resto se renderiza en la columna principal automáticamente.
 */
const SIDEBAR_SHAPES: SectionShape[] = ["tag_list", "key_value"];

function renderBasicsSidebar(basics: CvBasics): string {
  const photo = basics.photoUrl
    ? `<img src="${esc(basics.photoUrl)}" alt="${esc(basics.name)}" />`
    : "";
  const name = basics.name ? `<div class="name">${esc(basics.name)}</div>` : "";
  const role = basics.headline
    ? `<div class="role">${esc(basics.headline)}</div>`
    : "";
  const profile = `<div class="profile">${photo}${name}${role}</div>`;

  const contactItems: string[] = [];
  if (basics.phone) contactItems.push(`<li>${esc(basics.phone)}</li>`);
  if (basics.email) contactItems.push(`<li>${esc(basics.email)}</li>`);
  if (basics.location) contactItems.push(`<li>${esc(basics.location)}</li>`);
  for (const link of basics.links ?? []) {
    const text = link.url ? `${link.label}: ${link.url}` : link.label;
    if (text.trim().length > 0) contactItems.push(`<li>${esc(text)}</li>`);
  }
  const contact = contactItems.length
    ? `<div class="section">
        <div class="section-title">CONTACT</div>
        <ul class="list">${contactItems.join("")}</ul>
      </div>`
    : "";

  return `${profile}${contact}`;
}

function renderSection(section: CvSection, zone: "sidebar" | "main"): string {
  if (section.visible === false) return "";
  switch (section.shape) {
    case "paragraph":
      return renderParagraphMain(section as CvSection<"paragraph">);
    case "tag_list":
      return zone === "sidebar"
        ? renderTagListSidebar(section as CvSection<"tag_list">)
        : renderTagListMain(section as CvSection<"tag_list">);
    case "entry_list":
      return renderEntryListMain(section as CvSection<"entry_list">);
    case "key_value":
      return zone === "sidebar"
        ? renderKeyValueSidebar(section as CvSection<"key_value">)
        : renderKeyValueMain(section as CvSection<"key_value">);
    case "media_grid":
      return renderMediaGridMain(section as CvSection<"media_grid">);
    default:
      return "";
  }
}

function renderClassicSidebar(data: CvData): string {
  const sidebarSections = data.sections
    .filter((s) => SIDEBAR_SHAPES.includes(s.shape))
    .map((s) => renderSection(s, "sidebar"))
    .filter((s) => s.length > 0)
    .join("\n");

  /** Todo lo que no está marcado para sidebar cae en la columna principal:
   *  así nunca perdemos una sección aunque sea de un shape nuevo. */
  const mainSections = data.sections
    .filter((s) => !SIDEBAR_SHAPES.includes(s.shape))
    .map((s) => renderSection(s, "main"))
    .filter((s) => s.length > 0)
    .join("\n");

  const sidebarHtml = `<div class="sidebar">
    ${renderBasicsSidebar(data.basics)}
    ${sidebarSections}
  </div>`;

  const mainHtml = `<div class="main">${mainSections}</div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(data.basics.name || "CV")}</title>
    <style>${CLASSIC_SIDEBAR_STYLES}</style>
  </head>
  <body>
    <div class="cv-container">
      ${sidebarHtml}
      ${mainHtml}
    </div>
  </body>
</html>`;
}

export const classicSidebarTemplate: CvTemplate = {
  id: "classic-sidebar",
  name: "Clásica lateral",
  description:
    "Dos columnas: barra oscura con contacto, habilidades e idiomas; cuerpo principal con perfil y experiencia.",
  render: renderClassicSidebar,
};
