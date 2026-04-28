"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { CvDetailPanel } from "../../components/CvDetailPanel";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Detalle de la hoja de vida en el área principal: misma cáscara (layout) que
 * el listado, URL reflejada en /my-cvs/[cvId] sin recargar el shell.
 */
export default function MyCvsDetailPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const params = useParams();
  const raw = String(params.cvId ?? "");
  const list = useQuery(
    api.storage.resume.list,
    isSignedIn ? {} : "skip",
  );

  const resumeId = raw as Id<"resumes">;
  const isKnown =
    list !== undefined && list.some((r) => r._id === raw);

  useEffect(() => {
    if (!isSignedIn || list === undefined) {
      return;
    }
    if (list.length === 0) {
      router.replace("/my-cvs", { scroll: false });
      return;
    }
    if (!list.some((r) => r._id === raw)) {
      router.replace(`/my-cvs/${list[0]._id}`, { scroll: false });
    }
  }, [isSignedIn, list, raw, router]);

  if (list === undefined || (list.length > 0 && !isKnown)) {
    return (
      <div className="flex min-h-[50vh] w-full flex-1 items-center justify-center text-sm text-[var(--carly-muted)]">
        Cargando…
      </div>
    );
  }

  if (list.length === 0) {
    return null;
  }

  return (
    <div className="relative flex w-full min-w-0 flex-col">
      <CvDetailPanel resumeId={resumeId} />
    </div>
  );
}
