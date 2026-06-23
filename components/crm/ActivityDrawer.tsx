"use client";
import { useState } from "react";
import { useStore, selectCompany, selectDeal } from "@/lib/store";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { TierBadge } from "@/components/leads/TierBadge";
import { Badge } from "@/components/ui/badge";
import {
  DEAL_STAGE_LABEL,
  type DealActivity,
} from "@/lib/types";
import { addManualDealNote } from "@/lib/mock/crm-sync";
import { formatRelative } from "@/lib/utils";
import {
  StickyNote,
  RefreshCw,
  Send,
  ArrowRightLeft,
  MessageSquareReply,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIVITY_ICON: Record<DealActivity["type"], typeof StickyNote> = {
  stage_change: ArrowRightLeft,
  touchpoint: Send,
  reply: MessageSquareReply,
  note: StickyNote,
  sync: RefreshCw,
};

export function ActivityDrawer({
  companyId,
  onClose,
}: {
  companyId: string | null;
  onClose: () => void;
}) {
  const company = useStore((s) =>
    companyId ? selectCompany(companyId)(s) : undefined,
  );
  const deal = useStore((s) =>
    companyId ? selectDeal(companyId)(s) : undefined,
  );
  const now = useStore((s) => s.clock.simulatedTime);
  const [note, setNote] = useState("");

  function saveNote() {
    if (!companyId || !note.trim()) return;
    addManualDealNote(companyId, note.trim());
    setNote("");
  }

  return (
    <Drawer
      open={!!companyId && !!company && !!deal}
      onClose={onClose}
      title={company?.name}
      description={deal ? `HubSpot Deal · ${DEAL_STAGE_LABEL[deal.stage]}` : undefined}
      width="max-w-xl"
    >
      {company && deal && (
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Stage" value={DEAL_STAGE_LABEL[deal.stage]} />
            <Stat
              label="Amount"
              value={deal.amount ? `$${(deal.amount / 1000).toFixed(0)}k` : "—"}
            />
            <Stat label="Assigned AE" value={deal.assignedAE ?? "—"} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <TierBadge tier={company.tier} />
            {deal.notifiedAt && (
              <Badge variant="success">
                Sales notified {formatRelative(deal.notifiedAt, now)}
              </Badge>
            )}
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Add Note
            </div>
            <div className="flex items-start gap-2">
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Drop a quick note on this deal…"
                className="text-xs"
              />
              <Button
                variant="primary"
                size="md"
                onClick={saveNote}
                disabled={!note.trim()}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Activity Feed
            </div>
            {deal.activities.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-surface p-4 text-center text-xs text-fg-muted">
                No activity yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {deal.activities.map((a) => {
                  const Icon = ACTIVITY_ICON[a.type];
                  return (
                    <li
                      key={a.id}
                      className={cn(
                        "flex items-start gap-2 rounded-md border bg-surface px-3 py-2 text-xs",
                        a.type === "reply" && "border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/40",
                        a.type === "stage_change" && "border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/40",
                      )}
                    >
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="text-fg">{a.summary}</div>
                        <div className="mt-0.5 text-[10px] text-fg-muted">
                          {formatRelative(a.at, now)} ·{" "}
                          {a.type.replace("_", " ")}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold text-fg">
        {value}
      </div>
    </div>
  );
}
