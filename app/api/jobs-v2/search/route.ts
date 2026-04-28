import { NextResponse } from "next/server";
import { fetchJobsV2Search } from "@/lib/linkedin/jobsV2Search";
import { resolveCountry } from "@/lib/linkedin/jobSearchOptions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keywords = searchParams.get("keywords") ?? "";
    const countryParam = searchParams.get("country");
    const country = resolveCountry(countryParam).id;

    const jobs = await fetchJobsV2Search({ keywords, country, limit: 50 });
    return NextResponse.json({ jobs });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudo obtener la lista de empleos v2.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
