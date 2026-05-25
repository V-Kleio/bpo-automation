import { cn } from "@/lib/utils";

export function ScoreGauge({
  score,
  size = 120,
  label = "Priority Score",
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, score));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - v / 100);

  const tone =
    v >= 80
      ? { ring: "#16a34a", text: "text-emerald-700" }
      : v >= 65
      ? { ring: "#2563eb", text: "text-blue-700" }
      : v >= 50
      ? { ring: "#d97706", text: "text-amber-700" }
      : { ring: "#dc2626", text: "text-red-700" };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e4e4e7"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={tone.ring}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold tabular-nums", tone.text)}>
            {v}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            / 100
          </span>
        </div>
      </div>
      <span className="mt-2 text-xs font-medium text-zinc-600">{label}</span>
    </div>
  );
}
