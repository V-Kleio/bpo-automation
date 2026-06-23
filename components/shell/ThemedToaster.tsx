"use client";
import { Toaster } from "sonner";
import { useTheme } from "@/lib/hooks/use-theme";

/** Sonner toaster that follows the app theme. */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      theme={resolvedTheme}
      toastOptions={{ style: { fontSize: "13px" } }}
    />
  );
}
