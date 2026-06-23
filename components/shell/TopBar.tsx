"use client";
import { RotateCcw, Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useSidebar } from "@/components/shell/sidebar-context";
import { useStore } from "@/lib/store";

export function TopBar() {
  const reset = useStore((s) => s.resetDemo);
  const logs = useStore((s) => s.logs);
  const recent = logs.slice(0, 5);
  const { setMobileOpen } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/95 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-fg-muted hover:bg-surface-2 hover:text-fg md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-medium text-fg">
          Indonesia BPO Outreach Automation
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="relative">
          <button className="relative rounded-md p-2 text-fg-muted hover:bg-surface-2 hover:text-fg">
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
            if (confirm("Clear all local data and start fresh?")) reset();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
    </header>
  );
}
