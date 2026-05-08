import { NextResponse } from "next/server";

import {
  convexJwtFromClerk,
  linkedInSessionForNextHandler,
} from "@/lib/convex/linkedinSessionForNext";
import { fetchLinkedInJobPostingDetail } from "@/lib/linkedin/jobPostingDetail";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  if (!jobId || !/^\d+$/.test(jobId.trim())) {
    return NextResponse.json(
      { error: "Se requiere un id de oferta numérico." },
      { status: 400 },
    );
  }

  try {
    const token = await convexJwtFromClerk();
    if (!token) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para cargar el detalle." },
        { status: 401 },
      );
    }
    const session = await linkedInSessionForNextHandler(token);
    const detail = await fetchLinkedInJobPostingDetail(jobId, session);
    return NextResponse.json(detail);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo cargar el detalle.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
