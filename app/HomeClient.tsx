"use client";

import { AppSidebar } from "./components/AppSidebar";
import { CarlyWordmark } from "./components/CarlyWordmark";

export function HomeClient() {
  return (
    <div className="flex h-dvh min-h-0 bg-[var(--carly-page-bg)] text-[var(--carly-text)] antialiased">
      <AppSidebar
        mode="cvs"
        activeConversationId={null}
        onSelectConversation={() => {}}
        onArchiveConversation={() => {}}
        onNewChat={() => {}}
      />
      <main className="flex min-w-0 flex-1 flex-col items-center justify-center bg-[var(--carly-page-bg)] px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <CarlyWordmark className="text-center text-5xl sm:text-6xl md:text-7xl" />
          <p className="m-0 max-w-md text-base font-medium leading-snug tracking-tight text-[var(--carly-muted)] sm:text-lg">
            Encontrándote empleo en 5, 4, 3, 2...
          </p>
        </div>
      </main>
    </div>
  );
}
