import { NextResponse } from "next/server";

import {
  convexJwtFromClerk,
  linkedInSessionForNextHandler,
} from "@/lib/convex/linkedinSessionForNext";
import { fetchLinkedInJobList } from "@/lib/linkedin/jobsList";
import { resolveCountry } from "@/lib/linkedin/jobSearchOptions";

export async function GET(request: Request) {
  try {
    const token = await convexJwtFromClerk();
    if (!token) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para buscar ofertas." },
        { status: 401 },
      );
    }
    const session = await linkedInSessionForNextHandler(token);

    const { searchParams } = new URL(request.url);
    const keywords = searchParams.get("keywords") ?? "";
    const countryParam = searchParams.get("country");
    const country = resolveCountry(countryParam).id;

    const jobs = await fetchLinkedInJobList({ keywords, country }, session);
    return NextResponse.json({ jobs });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo obtener la lista de empleos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
