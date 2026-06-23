"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useLocalStorageState } from "@/lib/hooks/use-local-storage-state";

interface SidebarCtx {
  /** Desktop icon-rail collapse state (persisted). */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Mobile slide-out drawer open state (transient). */
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const Ctx = createContext<SidebarCtx | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useLocalStorageState(
    "sidebar.collapsed",
    false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleCollapsed = useCallback(
    () => setCollapsed((c) => !c),
    [setCollapsed],
  );
  return (
    <Ctx.Provider
      value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSidebar(): SidebarCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
