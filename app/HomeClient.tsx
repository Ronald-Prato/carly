"use client";

import { AppShell } from "./components/AppShell";
import { CarlyWordmark } from "./components/CarlyWordmark";

export function HomeClient() {
  return (
    <AppShell
      mode="cvs"
      activeConversationId={null}
      onSelectConversation={() => {}}
      onArchiveConversation={async () => {}}
      onNewChat={() => {}}
      mainClassName="flex flex-col items-center justify-center px-4 py-8 sm:px-6"
    >
      <div className="flex max-w-full flex-col items-center gap-4 text-center">
        <CarlyWordmark className="text-center text-5xl sm:text-6xl md:text-7xl" />
        <p className="m-0 max-w-md text-base font-medium leading-snug tracking-tight text-[var(--carly-muted)] sm:text-lg">
          Encontrándote empleo en 5, 4, 3, 2...
        </p>
      </div>
    </AppShell>
  );
}
