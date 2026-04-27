"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AddNewCvPanel } from "../components/AddNewCvPanel";
import { api } from "@/convex/_generated/api";

/**
 * /my-cvs — Sin CV: bloque de subida. Con al menos un CV: redirección a /my-cvs/[id]
 * (por defecto el más reciente) para no duplicar la vista.
 */
export default function MyCvsIndexPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const list = useQuery(
    api.storage.resume.list,
    isSignedIn ? {} : "skip",
  );

  useEffect(() => {
    if (!isSignedIn || list === undefined) {
      return;
    }
    if (list.length > 0) {
      router.replace(`/my-cvs/${list[0]._id}`, { scroll: false });
    }
  }, [isSignedIn, list, router]);

  if (list === undefined) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--carly-muted)]">
        Cargando…
      </div>
    );
  }

  if (list.length > 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--carly-muted)]">
        Cargando…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-3 py-6 sm:px-4">
      <AddNewCvPanel centered />
    </div>
  );
}
