import { NextResponse } from "next/server";
import { fetchTopFitCardGraphql } from "@/lib/linkedin/topFitCardGraphql";

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
    const block = await fetchTopFitCardGraphql(jobId);
    return NextResponse.json(block);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudo cargar la información de la vacante.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
