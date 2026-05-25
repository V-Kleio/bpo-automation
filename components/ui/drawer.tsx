"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: "right" | "left";
  width?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
}

export function Drawer({
  open,
  onClose,
  children,
  side = "right",
  width = "max-w-2xl",
  title,
  description,
}: DrawerProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" style={{ pointerEvents: "auto" }}>
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative ml-auto h-full w-full bg-white shadow-xl flex flex-col",
          width,
          side === "left" && "ml-0 mr-auto",
        )}
        style={{
          animation: "slideIn 200ms ease-out",
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-lg font-semibold text-zinc-900 truncate">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-zinc-500">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(${side === "right" ? "100%" : "-100%"}); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
