import type { ReactNode } from "react";
import { MyCvsLayoutClient } from "./MyCvsLayoutClient";

export default function MyCvsLayout({ children }: { children: ReactNode }) {
  return <MyCvsLayoutClient>{children}</MyCvsLayoutClient>;
}
