import { NextResponse } from "next/server";
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
    const detail = await fetchLinkedInJobPostingDetail(jobId);
    return NextResponse.json(detail);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo cargar el detalle.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
