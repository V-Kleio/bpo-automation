"use client";
import { RotateCcw, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export function TopBar() {
  const reset = useStore((s) => s.resetDemo);
  const logs = useStore((s) => s.logs);
  const recent = logs.slice(0, 5);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-zinc-200 bg-white/95 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-medium text-zinc-700">
          Indonesia BPO Outreach Automation
        </h1>
        <span className="text-[10px] font-semibold uppercase tracking-wider rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-700">
          Demo
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button className="relative rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
            <Bell className="h-4 w-4" />
            {recent.length > 0 && (
              <span className="absolute right-1 top-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            )}
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (confirm("Reset all demo data to seed state?")) reset();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Demo
        </Button>
      </div>
    </header>
  );
}
