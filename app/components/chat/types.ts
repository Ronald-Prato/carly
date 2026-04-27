export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Mientras llega el stream, el markdown se renderiza con animación ligera (como en moddo-next). */
  streamAnimate?: boolean;
};
