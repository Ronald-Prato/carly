"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

const MY_CVS_PATH = "/my-cvs";

/**
 * Agente, Empleos y Ofertas guardadas solo accesibles con sesión y al menos un CV.
 * Si no aplica, redirige a `/my-cvs`.
 */
export function useCvUploadGate() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const resumeList = useQuery(
    api.storage.resume.list,
    isSignedIn ? {} : "skip",
  );

  useEffect(() => {
    if (!isSignedIn) {
      router.replace(MY_CVS_PATH);
      return;
    }
    if (resumeList === undefined) return;
    if (resumeList.length === 0) router.replace(MY_CVS_PATH);
  }, [isSignedIn, resumeList, router]);

  const accessAllowed =
    isSignedIn &&
    resumeList !== undefined &&
    resumeList.length > 0;

  return { accessAllowed, resumeList };
}
