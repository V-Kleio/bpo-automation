"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type Panel = {
  /** Panel content. */
  content: ReactNode;
  /**
   * Fixed starting width in px for a resizable side panel, or `null` for a
   * fluid panel that grows to fill the remaining space. Exactly one fluid
   * panel is expected (typically the center).
   */
  size: number | null;
  /** Lower bound (px) when this panel is resizable. Default 160. */
  min?: number;
  /** Upper bound (px) when this panel is resizable. Default 720. */
  max?: number;
};

/**
 * Horizontally resizable column group with draggable dividers. Fixed-width
 * (non-null `size`) panels can be dragged; the fluid (`size: null`) panel
 * absorbs the slack. Widths are persisted to localStorage under `storageKey`
 * so the user's preferred layout survives reloads.
 */
export function ResizableColumns({
  panels,
  storageKey,
  className,
}: {
  panels: Panel[];
  storageKey: string;
  className?: string;
}) {
  // Per-panel widths; null entries stay fluid (flex-1).
  const [widths, setWidths] = useState<(number | null)[]>(() =>
    panels.map((p) => p.size),
  );

  // Hydrate persisted widths on mount (client-only; avoids SSR mismatch).
  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as (number | null)[];
      if (
        Array.isArray(saved) &&
        saved.length === panels.length &&
        saved.every((v, i) => (panels[i].size === null ? v === null : typeof v === "number"))
      ) {
        // Applied post-mount on purpose: reading localStorage in the initial
        // render would diverge from server-rendered HTML and trip hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWidths(saved);
      }
    } catch {
      /* ignore malformed persisted layout */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback(
    (next: (number | null)[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage may be full or blocked; layout still works in-session */
      }
    },
    [storageKey],
  );

  // Active drag state lives in a ref so the window listeners read fresh values.
  const drag = useRef<{
    handle: number;
    startX: number;
    startWidth: number;
    panelIdx: number;
    sign: 1 | -1;
    min: number;
    max: number;
  } | null>(null);

  const startDrag = useCallback(
    (handleIdx: number, e: React.PointerEvent) => {
      e.preventDefault();
      // The handle sits between panels handleIdx and handleIdx+1. Resize the
      // adjacent fixed panel: prefer the left one, else the right (inverted).
      const leftFixed = widths[handleIdx] !== null;
      const panelIdx = leftFixed ? handleIdx : handleIdx + 1;
      const sign: 1 | -1 = leftFixed ? 1 : -1;
      const startWidth = widths[panelIdx];
      if (startWidth === null) return;
      drag.current = {
        handle: handleIdx,
        startX: e.clientX,
        startWidth,
        panelIdx,
        sign,
        min: panels[panelIdx].min ?? 160,
        max: panels[panelIdx].max ?? 720,
      };
    },
    [widths, panels],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      const delta = (e.clientX - d.startX) * d.sign;
      const w = Math.max(d.min, Math.min(d.max, d.startWidth + delta));
      setWidths((prev) => {
        if (prev[d.panelIdx] === w) return prev;
        const next = [...prev];
        next[d.panelIdx] = w;
        return next;
      });
    }
    function onUp() {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setWidths((cur) => {
        persist(cur);
        return cur;
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [persist]);

  return (
    <div className={cn("flex h-full w-full overflow-hidden", className)}>
      {panels.map((p, i) => {
        const w = widths[i];
        return (
          <div key={i} className="contents">
            <div
              className={cn("min-h-0 min-w-0", w === null && "flex-1")}
              style={w === null ? undefined : { width: w, flex: "0 0 auto" }}
            >
              {p.content}
            </div>
            {i < panels.length - 1 && (
              <div
                role="separator"
                aria-orientation="vertical"
                onPointerDown={(e) => {
                  startDrag(i, e);
                  document.body.style.cursor = "col-resize";
                  document.body.style.userSelect = "none";
                }}
                className="group relative z-10 flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-zinc-200 transition-colors hover:bg-blue-400 active:bg-blue-500"
                title="Drag to resize"
              >
                {/* Wider invisible hit area for easier grabbing */}
                <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
