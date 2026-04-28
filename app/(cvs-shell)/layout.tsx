import type { ReactNode } from "react";
import { MyCvsLayoutClient } from "../my-cvs/MyCvsLayoutClient";
import { JobsSearchSessionProvider } from "./JobsSearchSession";

/**
 * Agrupa rutas que comparten el shell lateral y persisten estado de Empleos
 * (keywords, resultados, carrusel) al navegar a Guardadas y volver sin recargar.
 */
export default function CvsShellLayout({ children }: { children: ReactNode }) {
  return (
    <MyCvsLayoutClient>
      <JobsSearchSessionProvider>{children}</JobsSearchSessionProvider>
    </MyCvsLayoutClient>
  );
}
