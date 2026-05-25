"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TierBadge } from "./TierBadge";
import { IntentSignalList } from "./IntentSignalChip";
import { StatusPill } from "./StatusPill";
import { LeadDetailDrawer } from "./LeadDetailDrawer";
import { ImportLeadsButton } from "./ImportLeadsButton";
import { HubSpotSyncButton } from "./HubSpotSyncButton";
import { analyzeLeads } from "@/lib/services/ai-router";
import { Brain, Search, Filter } from "lucide-react";
import type { Tier, LeadStatus } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TierFilter = Tier | "all";
type StatusFilter = LeadStatus | "all";

export function LeadTable() {
  const companies = useStore((s) => s.companies);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (tierFilter !== "all" && c.tier !== tierFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q) {
        const hay = `${c.name} ${c.industry.join(" ")} ${c.hq}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [companies, search, tierFilter, statusFilter]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const someSelected = !allFilteredSelected && filtered.some((c) => selected.has(c.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((c) => next.delete(c.id));
      } else {
        filtered.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runAnalysis() {
    if (selected.size === 0) {
      toast.warning("Select at least one company first.");
      return;
    }
    setRunning(true);
    const ids = Array.from(selected);
    toast.loading(`Sending ${ids.length} lead(s) to Claude…`, {
      id: "analyze",
      duration: 2000,
    });
    try {
      await analyzeLeads(ids);
      toast.success(`Analysis complete — ${ids.length} lead(s) qualified.`, {
        id: "analyze",
      });
      setSelected(new Set());
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, industry, HQ…"
              className="h-9 w-64 pl-8"
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-zinc-400" />
            <Select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as TierFilter)}
              className="h-9"
            >
              <option value="all">All Tiers</option>
              <option value="priority">Priority</option>
              <option value="warm">Warm</option>
              <option value="nurture">Nurture</option>
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9"
            >
              <option value="all">All Statuses</option>
              <option value="pending_analysis">Pending</option>
              <option value="analyzing">Analyzing</option>
              <option value="qualified">Qualified</option>
              <option value="disqualified">Disqualified</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            {selected.size > 0 ? `${selected.size} selected · ` : ""}
            {filtered.length} of {companies.length} leads
          </span>
          <ImportLeadsButton />
          <HubSpotSyncButton />
          <Button
            variant="accent"
            size="md"
            onClick={runAnalysis}
            disabled={running || selected.size === 0}
          >
            <Brain className="h-4 w-4" />
            {running ? "Analyzing…" : `Run AI Analysis${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={
                    allFilteredSelected
                      ? true
                      : someSelected
                      ? "indeterminate"
                      : false
                  }
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2.5">Company</th>
              <th className="px-3 py-2.5">Industry</th>
              <th className="px-3 py-2.5">Size</th>
              <th className="px-3 py-2.5">Tier</th>
              <th className="px-3 py-2.5">Intent Signals</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-12 text-center text-sm text-zinc-500"
                >
                  No leads match your filters.
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const isSelected = selected.has(c.id);
              return (
                <tr
                  key={c.id}
                  onClick={() => setOpenDrawerId(c.id)}
                  className={cn(
                    "border-b border-zinc-100 text-sm transition-colors hover:bg-zinc-50 cursor-pointer",
                    isSelected && "bg-blue-50/40 hover:bg-blue-50/60",
                    c.status === "analyzing" && "animate-pulse",
                  )}
                >
                  <td
                    className="px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(c.id)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-zinc-900">{c.name}</div>
                    <div className="text-xs text-zinc-500">{c.hq}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.industry.slice(0, 2).map((i) => (
                        <span
                          key={i}
                          className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700"
                        >
                          {i}
                        </span>
                      ))}
                      {c.industry.length > 2 && (
                        <span className="text-[11px] text-zinc-500">
                          +{c.industry.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-600">
                    {c.headcount.toLocaleString()} emp
                  </td>
                  <td className="px-3 py-3">
                    <TierBadge tier={c.tier} />
                  </td>
                  <td className="px-3 py-3">
                    <IntentSignalList signals={c.intentSignals} max={2} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <StatusPill status={c.status} />
                      {c.analysis && (
                        <span className="text-[11px] font-semibold text-blue-700">
                          {c.analysis.priorityScore}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <LeadDetailDrawer
        companyId={openDrawerId}
        onClose={() => setOpenDrawerId(null)}
      />
    </div>
  );
}
