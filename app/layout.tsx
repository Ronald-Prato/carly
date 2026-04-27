import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Carly",
  description: "Next.js + Convex",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
