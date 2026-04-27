"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { EnsureConvexUser } from "./components/EnsureConvexUser";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
}

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <EnsureConvexUser>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </EnsureConvexUser>
      </ConvexProviderWithClerk>
    </ThemeProvider>
  );
}
