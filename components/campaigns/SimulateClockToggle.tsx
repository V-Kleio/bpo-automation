"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { startTimeEngine, stopTimeEngine, setSpeed } from "@/lib/mock/time-engine";
import { Button } from "@/components/ui/button";
import { Play, Pause, FastForward, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function SimulateClockToggle() {
  const { running, speed, simulatedTime } = useStore((s) => s.clock);
  const campaignsCount = useStore((s) => s.campaigns.length);

  // Stop the engine when the user navigates away to avoid stray intervals.
  useEffect(
    () => () => {
      if (running) stopTimeEngine();
    },
    // intentionally only on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 shadow-sm">
      <Button
        variant={running ? "danger" : "success"}
        size="sm"
        onClick={() => {
          if (running) stopTimeEngine();
          else startTimeEngine();
        }}
        disabled={campaignsCount === 0}
      >
        {running ? (
          <>
            <Pause className="h-3.5 w-3.5" />
            Pause
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5" />
            Simulate
          </>
        )}
      </Button>

      <div className="flex items-center gap-0.5 rounded-md bg-zinc-100 p-0.5">
        {([1, 5, 10] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={cn(
              "inline-flex h-6 items-center justify-center rounded px-2 text-[11px] font-semibold transition-colors",
              speed === s
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900",
            )}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 border-l border-zinc-200 pl-2 text-[11px] text-zinc-500">
        <Clock
          className={cn(
            "h-3 w-3",
            running && "text-emerald-500 animate-pulse",
          )}
        />
        <span className="tabular-nums">{formatSim(simulatedTime)}</span>
        {running && (
          <FastForward className="h-3 w-3 text-emerald-500" />
        )}
      </div>
    </div>
  );
}

function formatSim(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
