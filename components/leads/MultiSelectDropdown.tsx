"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface MultiSelectDropdownProps<T extends string> {
  label: string;
  options: MultiSelectOption<T>[];
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
  icon?: React.ReactNode;
  align?: "left" | "right";
}

export function MultiSelectDropdown<T extends string>({
  label,
  options,
  selected,
  onChange,
  icon,
  align = "left",
}: MultiSelectDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(v: T) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  }

  function clear() {
    onChange(new Set());
  }

  const active = selected.size > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg",
          active && "border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-900 hover:bg-blue-100 dark:bg-blue-900/40",
        )}
      >
        {icon}
        <span>{label}</span>
        {active && (
          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
            {selected.size}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-fg-subtle transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full z-30 mt-1 min-w-[14rem] rounded-md border border-border bg-surface p-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {options.map((opt) => {
            const checked = selected.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-2"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-strong bg-surface text-primary-fg",
                    checked && "border-primary bg-primary",
                  )}
                >
                  {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            );
          })}
          {active && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={clear}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-fg-muted hover:bg-surface-2"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
