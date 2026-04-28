import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Iniciar sesión — Carly",
  description:
    "Accede a Carly con Google, GitHub o LinkedIn y deja que te ayude con tu hoja de vida.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--carly-page-bg)] text-[var(--carly-text)]">
      {children}
    </div>
  );
}
