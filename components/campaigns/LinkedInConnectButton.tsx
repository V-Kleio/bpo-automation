"use client";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  LinkIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  getClientConfig,
  invalidateClientConfig,
} from "@/lib/services/public-config-client";
import type { LinkedInProvider } from "@/lib/services/config";

interface LinkedInStatus {
  provider: LinkedInProvider;
  configured: boolean;
  authenticated: boolean;
  reason: string;
  dailyUsage: number;
  dailyCap: number;
}

export function LinkedInConnectButton() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    refreshStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function refreshStatus() {
    invalidateClientConfig();
    try {
      const [cfg, statusResp] = await Promise.all([
        getClientConfig(),
        fetch("/api/linkedin/status", { cache: "no-store" }).then(
          (r) => r.json() as Promise<LinkedInStatus>,
        ),
      ]);
      setStatus(statusResp);
      // Only show the button when Playwright is the active path.
      // Mock = hidden, Unipile/MCP = shown as badges only (no connect needed).
      setAvailable(cfg.linkedin.provider === "playwright");
    } catch {
      setAvailable(false);
    }
  }

  async function startConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/linkedin/connect", { method: "POST" });
      const data = (await res.json()) as {
        sessionId?: string;
        error?: string;
      };
      if (!res.ok || !data.sessionId) {
        toast.error("Could not start LinkedIn login", {
          description: data.error,
        });
        setConnecting(false);
        return;
      }
      toast.info("LinkedIn login window opened", {
        description: "Log in there; we'll save the session when you reach the feed.",
        duration: 5000,
      });
      pollLogin(data.sessionId);
    } catch (err) {
      toast.error("Could not start LinkedIn login", {
        description: err instanceof Error ? err.message : String(err),
      });
      setConnecting(false);
    }
  }

  function pollLogin(sessionId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/linkedin/connect/status?sessionId=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          state: "pending" | "success" | "failed" | "cancelled";
          error?: string;
        };
        if (data.state === "success") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setConnecting(false);
          toast.success("LinkedIn connected", {
            description: "Outreach is now using the saved session.",
          });
          refreshStatus();
        } else if (data.state === "failed" || data.state === "cancelled") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setConnecting(false);
          toast.error("LinkedIn login failed", {
            description: data.error ?? "Closed before reaching the feed.",
          });
        }
      } catch {
        // keep polling
      }
    }, 2000);
  }

  async function disconnect() {
    if (!confirm("Disconnect LinkedIn session?")) return;
    try {
      await fetch("/api/linkedin/session", { method: "DELETE" });
      toast.success("LinkedIn session cleared");
      refreshStatus();
    } catch (err) {
      toast.error("Failed to disconnect", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (available === null || !status) return null;
  if (!available) return null;

  if (status.authenticated) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="font-semibold">LinkedIn · Live</span>
        <span className="text-emerald-600">
          {status.dailyUsage}/{status.dailyCap} today
        </span>
        <button
          onClick={disconnect}
          className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-emerald-700 hover:bg-emerald-100"
          title="Disconnect LinkedIn"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={startConnect}
      disabled={connecting}
    >
      {connecting ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Waiting for LinkedIn login…
        </>
      ) : (
        <>
          <LinkIcon className="h-3.5 w-3.5" />
          Connect LinkedIn
        </>
      )}
    </Button>
  );
}
