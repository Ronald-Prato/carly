/**
 * Must match the model used in `app/api/chat/route.ts`
 * (`OPENAI_CHAT_MODEL` or `NEXT_PUBLIC_OPENAI_CHAT_MODEL` on the client).
 */
export const CARLY_DEFAULT_CHAT_MODEL = "gpt-5.4-nano";

export function getClientChatModel(): string {
  if (typeof process === "undefined") return CARLY_DEFAULT_CHAT_MODEL;
  return process.env.NEXT_PUBLIC_OPENAI_CHAT_MODEL ?? CARLY_DEFAULT_CHAT_MODEL;
}
