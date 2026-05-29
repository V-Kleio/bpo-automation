"use client";
import { useShallow } from "zustand/react/shallow";
import { useStore, selectCompany } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Bell, CalendarCheck } from "lucide-react";
import { formatRelative } from "@/lib/utils";

export function NotifySalesPanel() {
  const meetingDeals = useStore(
    useShallow((s) => s.deals.filter((d) => d.stage === "meeting_scheduled")),
  );
  const now = useStore((s) => s.clock.simulatedTime);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <Bell className="h-3.5 w-3.5" />
          </div>
          <div>
            <CardTitle>Sales Team Notifications</CardTitle>
            <CardDescription>
              Deals handed off for offline meetings.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {meetingDeals.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-200 bg-white p-6 text-center text-xs text-zinc-500">
            No meetings booked yet. Mark a stakeholder as replied to advance the deal.
          </div>
        ) : (
          <ul className="space-y-2">
            {meetingDeals.map((d) => (
              <NotifyRow key={d.id} companyId={d.companyId} ae={d.assignedAE} at={d.notifiedAt} now={now} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function NotifyRow({
  companyId,
  ae,
  at,
  now,
}: {
  companyId: string;
  ae?: string;
  at?: string;
  now: string;
}) {
  const company = useStore((s) => selectCompany(companyId)(s));
  if (!company) return null;
  return (
    <li className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50/30 px-3 py-2">
      <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-zinc-900">{company.name}</div>
        <div className="text-[11px] text-zinc-600">
          Assigned AE: <span className="font-medium text-zinc-800">{ae ?? "—"}</span>
        </div>
      </div>
      {at && (
        <span className="shrink-0 text-[10px] text-zinc-500">
          Notified {formatRelative(at, now)}
        </span>
      )}
    </li>
  );
}
