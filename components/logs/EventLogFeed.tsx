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
  ai_call: { label: "AI", icon: Brain, classes: "text-blue-600 bg-blue-50 border-blue-200" },
  channel_send: { label: "Send", icon: Send, classes: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  reply: { label: "Reply", icon: CornerDownRight, classes: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  crm_sync: { label: "CRM", icon: RefreshCw, classes: "text-violet-600 bg-violet-50 border-violet-200" },
  notification: { label: "Alert", icon: Bell, classes: "text-amber-600 bg-amber-50 border-amber-200" },
  stage_change: { label: "Stage", icon: ArrowRightLeft, classes: "text-zinc-700 bg-zinc-100 border-zinc-200" },
  user_action: { label: "User", icon: User, classes: "text-zinc-700 bg-zinc-100 border-zinc-200" },
};

const LAYER_BADGE: Record<1 | 2 | 3 | 4, string> = {
  1: "L1",
  2: "L2",
  3: "L3",
  4: "L4",
};

const LAYER_COLOR: Record<1 | 2 | 3 | 4, string> = {
  1: "text-teal-700 bg-teal-50",
  2: "text-blue-700 bg-blue-50",
  3: "text-green-700 bg-green-50",
  4: "text-violet-700 bg-violet-50",
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
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2">
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
          <span className="ml-auto text-xs text-zinc-500">
            {filtered.length} event{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white">
        {shown.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No events yet — run an analysis or send a LinkedIn message to fill this feed.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
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
                  <span className="flex-1 leading-relaxed text-zinc-800">
                    {e.summary}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
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
