"use client";
import { Mail, Layers } from "lucide-react";
import { LinkedinIcon } from "@/components/ui/icons";
import type { Channel } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ChannelFilter = Channel | "all";

interface Option {
  value: ChannelFilter;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  hint?: string;
}

const OPTIONS: Option[] = [
  { value: "all", label: "All channels", Icon: Layers },
  { value: "linkedin", label: "LinkedIn", Icon: LinkedinIcon },
  {
    value: "email",
    label: "Email",
    Icon: Mail,
    disabled: true,
    hint: "Coming soon",
  },
];

export function ChannelTabs({
  value,
  onChange,
}: {
  value: ChannelFilter;
  onChange: (v: ChannelFilter) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-zinc-100 p-0.5">
      {OPTIONS.map(({ value: v, label, Icon, disabled, hint }) => (
        <button
          key={v}
          onClick={() => !disabled && onChange(v)}
          disabled={disabled}
          title={hint}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
            value === v
              ? "bg-white text-zinc-900 shadow-sm"
              : disabled
                ? "cursor-not-allowed text-zinc-400"
                : "text-zinc-600 hover:text-zinc-900",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          {hint && (
            <span className="ml-0.5 rounded bg-zinc-200 px-1 py-px text-[9px] font-medium uppercase tracking-wider text-zinc-500">
              soon
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
