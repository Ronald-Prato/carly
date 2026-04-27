"use client";

import { api } from "../../convex/_generated/api";
import { Authenticated, useMutation } from "convex/react";
import type { ReactNode } from "react";
import { useEffect } from "react";

function StoreCurrentUser() {
  const store = useMutation(api.database.users.storeCurrent);

  useEffect(() => {
    void store();
  }, [store]);

  return null;
}

export function EnsureConvexUser({ children }: { children: ReactNode }) {
  return (
    <>
      <Authenticated>
        <StoreCurrentUser />
      </Authenticated>
      {children}
    </>
  );
}
