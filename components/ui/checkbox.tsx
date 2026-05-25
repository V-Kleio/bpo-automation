"use client";
import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked?: boolean | "indeterminate";
  onCheckedChange?: (v: boolean) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export function Checkbox({
  checked = false,
  onCheckedChange,
  className,
  disabled,
  ...rest
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked === "indeterminate" ? "mixed" : !!checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-white transition-colors",
        checked && "border-zinc-900 bg-zinc-900",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      {...rest}
    >
      {checked === "indeterminate" ? (
        <Minus className="h-3 w-3" strokeWidth={3} />
      ) : checked ? (
        <Check className="h-3 w-3" strokeWidth={3} />
      ) : null}
    </button>
  );
}
