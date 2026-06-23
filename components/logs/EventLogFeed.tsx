"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Select } from "@/components/ui/select";
import { formatRelative } from "@/lib/utils";
import type { LogEvent } from "@/lib/types";
import {
  Brain,
  Send,
  CornerDownRight,
  RefreshCw,
  Bell,
  ArrowRightLeft,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_META: Record<
  LogEvent["type"],
  { label: string; icon: typeof Brain; classes: string }
> = {
  ai_call: { label: "AI", icon: Brain, classes: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900" },
  channel_send: { label: "Send", icon: Send, classes: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900" },
  reply: { label: "Reply", icon: CornerDownRight, classes: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900" },
  crm_sync: { label: "CRM", icon: RefreshCw, classes: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900" },
  notification: { label: "Alert", icon: Bell, classes: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900" },
  stage_change: { label: "Stage", icon: ArrowRightLeft, classes: "text-fg bg-surface-2 border-border" },
  user_action: { label: "User", icon: User, classes: "text-fg bg-surface-2 border-border" },
};

const LAYER_BADGE: Record<1 | 2 | 3 | 4, string> = {
  1: "L1",
  2: "L2",
  3: "L3",
  4: "L4",
};

const LAYER_COLOR: Record<1 | 2 | 3 | 4, string> = {
  1: "text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40",
  2: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40",
  3: "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40",
  4: "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40",
};

export function EventLogFeed({ limit }: { limit?: number }) {
  const logs = useStore((s) => s.logs);
  const now = useStore((s) => s.clock.simulatedTime);
  const [layerFilter, setLayerFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (layerFilter !== "all" && String(l.layer) !== layerFilter) return false;
      if (typeFilter !== "all" && l.type !== typeFilter) return false;
      return true;
    });
  }, [logs, layerFilter, typeFilter]);

  const shown = limit ? filtered.slice(0, limit) : filtered;

  return (
    <div className="space-y-3">
      {!limit && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2">
          <Select
            value={layerFilter}
            onChange={(e) => setLayerFilter(e.target.value)}
          >
            <option value="all">All Layers</option>
            <option value="1">L1 · Data</option>
            <option value="2">L2 · AI Brain</option>
            <option value="3">L3 · Engagement</option>
            <option value="4">L4 · CRM</option>
          </Select>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Event Types</option>
            <option value="ai_call">AI calls</option>
            <option value="channel_send">Channel sends</option>
            <option value="reply">Replies</option>
            <option value="crm_sync">CRM syncs</option>
            <option value="notification">Notifications</option>
            <option value="stage_change">Stage changes</option>
            <option value="user_action">User actions</option>
          </Select>
          <span className="ml-auto text-xs text-fg-muted">
            {filtered.length} event{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface">
        {shown.length === 0 ? (
          <div className="p-8 text-center text-sm text-fg-muted">
            No events yet — run an analysis or send a LinkedIn message to fill this feed.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((e) => {
              const meta = TYPE_META[e.type];
              const Icon = meta.icon;
              return (
                <li
                  key={e.id}
                  className="flex items-start gap-3 px-4 py-2.5 text-xs"
                >
                  <span
                    className={cn(
                      "inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[10px] font-semibold uppercase tracking-wider",
                      LAYER_COLOR[e.layer],
                    )}
                  >
                    {LAYER_BADGE[e.layer]}
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-5 shrink-0 items-center gap-1 rounded border px-1.5 text-[10px] font-medium",
                      meta.classes,
                    )}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {meta.label}
                  </span>
                  <span className="flex-1 leading-relaxed text-fg">
                    {e.summary}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-fg-muted">
                    {formatRelative(e.at, now)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
