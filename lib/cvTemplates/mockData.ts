/**
 * Datos de ejemplo para vistas previas en el catálogo. Mismo dataset usado
 * en todas las plantillas para que el usuario pueda compararlas a igualdad
 * de contenido.
 */

import type { CvData } from "./types";

export const MOCK_CV_DATA: CvData = {
  basics: {
    name: "María González Ruiz",
    headline: "Ingeniera de software senior",
    email: "maria.gonzalez@email.com",
    phone: "+34 612 345 678",
    location: "Barcelona, España",
    links: [
      { label: "linkedin.com/in/mariagonzalez" },
      { label: "github.com/mgonzalez" },
    ],
  },
  sections: [
    {
      id: "summary",
      shape: "paragraph",
      title: "Perfil",
      semanticHint: "summary",
      payload: {
        text: "Más de 8 años construyendo productos web escalables. Me enfoco en arquitectura frontend, rendimiento y experiencias de equipo claras. He liderado migraciones a React y mejoras de Core Web Vitals en entornos ágiles.",
      },
    },
    {
      id: "skills",
      shape: "tag_list",
      title: "Skills",
      semanticHint: "skills",
      payload: {
        items: [
          "TypeScript",
          "React",
          "Node.js",
          "Diseño de APIs",
          "PostgreSQL",
          "CI/CD",
        ],
      },
    },
    {
      id: "languages",
      shape: "tag_list",
      title: "Idiomas",
      semanticHint: "languages",
      payload: {
        items: ["Español — Nativo", "Inglés — C1", "Catalán — C1"],
      },
    },
    {
      id: "experience",
      shape: "entry_list",
      title: "Experiencia",
      semanticHint: "experience",
      payload: {
        items: [
          {
            headline: "Staff Software Engineer",
            subheadline: "Acme Labs",
            dateRange: "2021 — presente",
            location: "Barcelona, España (Remoto)",
            bullets: [
              "Lideré el rediseño del dashboard principal (+40% retención en el primer trimestre).",
              "Mentoría a 4 desarrolladoras; definición de estándares de código y revisiones.",
              "Integración con APIs de terceros y observabilidad (OpenTelemetry).",
            ],
          },
          {
            headline: "Senior Frontend Engineer",
            subheadline: "Globex",
            dateRange: "2018 — 2021",
            bullets: [
              "Migración progresiva del monolito a una SPA basada en React + GraphQL.",
              "Mejora de Core Web Vitals: LCP de 4.1s a 1.8s en mobile.",
            ],
          },
        ],
      },
    },
    {
      id: "highlights",
      shape: "entry_list",
      title: "Reconocimientos",
      semanticHint: "highlights",
      payload: {
        items: [
          {
            headline: "Premio a la excelencia técnica 2024",
            description:
              "Iniciativa de reducción de latencia en el checkout, con impacto medible en conversión.",
          },
        ],
      },
    },
  ],
};
