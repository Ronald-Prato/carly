import { redirect } from "next/navigation";
import { HomeClient } from "./HomeClient";
import { AGENT_PATH } from "@/lib/routes";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ conv?: string }>;
}) {
  const { conv } = await searchParams;
  if (conv) {
    redirect(`${AGENT_PATH}?conv=${encodeURIComponent(conv)}`);
  }
  return <HomeClient />;
}
