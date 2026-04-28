import { NextResponse } from "next/server";
import { fetchCompanyCardGraphql } from "@/lib/linkedin/companyCardGraphql";

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
    const block = await fetchCompanyCardGraphql(jobId);
    return NextResponse.json(block);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo cargar la empresa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
