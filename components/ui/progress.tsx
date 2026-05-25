import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  trackClassName,
  barClassName,
}: {
  value: number; // 0-100
  className?: string;
  trackClassName?: string;
  barClassName?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-zinc-100",
          trackClassName,
        )}
      >
        <div
          className={cn(
            "h-full rounded-full bg-zinc-900 transition-[width] duration-500",
            barClassName,
          )}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
