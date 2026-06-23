import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative inline-block">
      <select
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-border-strong bg-surface pl-3 pr-8 text-sm text-fg shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-fg/10",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
    </div>
  );
}
