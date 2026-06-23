import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-9 w-full rounded-md border border-border-strong bg-surface px-3 py-1 text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-fg/10 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[64px] w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-fg/10 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
