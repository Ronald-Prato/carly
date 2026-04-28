import type { ReactNode } from "react";
import { MyCvsLayoutClient } from "../my-cvs/MyCvsLayoutClient";

export default function JobsV2Layout({ children }: { children: ReactNode }) {
  return <MyCvsLayoutClient>{children}</MyCvsLayoutClient>;
}
