type CarlyWordmarkProps = {
  className?: string;
};

export function CarlyWordmark({ className }: CarlyWordmarkProps) {
  return (
    <span
      className={[
        "inline-block bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 bg-clip-text font-semibold tracking-tight text-transparent",
        className ?? "",
      ].join(" ")}
      aria-label="Carly"
    >
      Carly
    </span>
  );
}
