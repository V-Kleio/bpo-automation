"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  /** Body text or rich content describing the consequence. */
  description?: ReactNode;
  /** Confirm button label. Default "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Default "Cancel". */
  cancelLabel?: string;
  /** Style the confirm button as destructive (red). Default false. */
  destructive?: boolean;
}

interface DialogState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Hook for a styled, promise-based confirmation dialog — a drop-in replacement
 * for the native `confirm()`. Returns a `confirm()` function that resolves to
 * `true`/`false`, plus the dialog element to render somewhere in the tree:
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   // ...
 *   if (await confirm({ title: "Delete?", destructive: true })) { ... }
 *   return <>{confirmDialog}{children}</>;
 */
export function useConfirm(): [
  (opts: ConfirmOptions) => Promise<boolean>,
  ReactNode,
] {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      setState((s) => {
        s?.resolve(ok);
        return null;
      });
    },
    [],
  );

  // Esc cancels, Enter confirms while the dialog is open.
  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter") close(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  const dialog = state ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      onClick={() => close(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {state.destructive && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900">
              {state.title}
            </h2>
            {state.description && (
              <div className="mt-1 text-xs leading-relaxed text-zinc-600">
                {state.description}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => close(false)}>
            {state.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={state.destructive ? "danger" : "primary"}
            size="sm"
            onClick={() => close(true)}
            autoFocus
          >
            {state.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return [confirm, dialog];
}
