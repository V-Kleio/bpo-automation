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
import { DatabaseSyncButton } from "./DatabaseSyncButton";
import { MultiSelectDropdown } from "./MultiSelectDropdown";
import { analyzeLeads } from "@/lib/services/ai-router";
import {
  Brain,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Mail,
} from "lucide-react";
import { LinkedinIcon } from "@/components/ui/icons";
import { useLocalStorageState } from "@/lib/hooks/use-local-storage-state";
import type { Tier, LeadStatus } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Channel = "linkedin" | "email";
const PAGE_SIZES = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number] | "all";

// Sortable columns and the rank maps for the categorical ones.
type SortKey = "name" | "headcount" | "tier" | "status" | "score";
type SortDir = "asc" | "desc";
const TIER_RANK: Record<Tier, number> = { priority: 3, warm: 2, nurture: 1 };
const STATUS_RANK: Record<LeadStatus, number> = {
  qualified: 4,
  analyzing: 3,
  pending_analysis: 2,
  disqualified: 1,
};

export function LeadTable() {
  const companies = useStore((s) => s.companies);
  const stakeholders = useStore((s) => s.stakeholders);
  // View preferences persist across reloads/navigation. Sets aren't
  // JSON-serializable, so filters are stored as arrays and adapted to Sets for
  // the filter UI and lookups.
  const [search, setSearch] = useLocalStorageState("leads.search", "");
  const [tierArr, setTierArr] = useLocalStorageState<Tier[]>("leads.tiers", []);
  const [statusArr, setStatusArr] = useLocalStorageState<LeadStatus[]>(
    "leads.statuses",
    [],
  );
  const [channelArr, setChannelArr] = useLocalStorageState<Channel[]>(
    "leads.channels",
    [],
  );
  const [pageSize, setPageSize] = useLocalStorageState<PageSize>(
    "leads.pageSize",
    25,
  );
  const [sort, setSort] = useLocalStorageState<{
    key: SortKey;
    dir: SortDir;
  } | null>("leads.sort", null);
  const tierFilter = useMemo(() => new Set(tierArr), [tierArr]);
  const statusFilter = useMemo(() => new Set(statusArr), [statusArr]);
  const channelFilter = useMemo(() => new Set(channelArr), [channelArr]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [page, setPage] = useState(1);

  // companyId -> { linkedin, email } presence flags, derived from stakeholders
  const channelByCompany = useMemo(() => {
    const map = new Map<string, { linkedin: boolean; email: boolean }>();
    for (const sh of stakeholders) {
      const entry = map.get(sh.companyId) ?? { linkedin: false, email: false };
      if (sh.linkedinUrl && sh.linkedinUrl.trim()) entry.linkedin = true;
      if (sh.email && sh.email.trim()) entry.email = true;
      map.set(sh.companyId, entry);
    }
    return map;
  }, [stakeholders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (q) {
        const hay = `${c.name} ${c.industry.join(" ")} ${c.hq}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tierFilter.size > 0 && !tierFilter.has(c.tier)) return false;
      if (statusFilter.size > 0 && !statusFilter.has(c.status)) return false;
      if (channelFilter.size > 0) {
        const has = channelByCompany.get(c.id) ?? {
          linkedin: false,
          email: false,
        };
        let matches = false;
        if (channelFilter.has("linkedin") && has.linkedin) matches = true;
        if (channelFilter.has("email") && has.email) matches = true;
        if (!matches) return false;
      }
      return true;
    });
  }, [
    companies,
    search,
    tierFilter,
    statusFilter,
    channelFilter,
    channelByCompany,
  ]);

  // Sorting — applied after filtering, before pagination.
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (c: (typeof filtered)[number]): number | string => {
      switch (sort.key) {
        case "name":
          return c.name.toLowerCase();
        case "headcount":
          return c.headcount;
        case "tier":
          return TIER_RANK[c.tier];
        case "status":
          return STATUS_RANK[c.status];
        case "score":
          return c.analysis?.priorityScore ?? -1;
      }
    };
    return [...filtered].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort]);

  // Pagination
  const totalPages =
    pageSize === "all" ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = pageSize === "all" ? 0 : (safePage - 1) * pageSize;
  const endIdx =
    pageSize === "all" ? sorted.length : startIdx + (pageSize as number);
  const visible = sorted.slice(startIdx, endIdx);

  // Filter handlers — also reset to page 1 when the active filter set changes
  function applyTierFilter(next: Set<Tier>) {
    setTierArr([...next]);
    setPage(1);
  }
  function applyStatusFilter(next: Set<LeadStatus>) {
    setStatusArr([...next]);
    setPage(1);
  }
  function applyChannelFilter(next: Set<Channel>) {
    setChannelArr([...next]);
    setPage(1);
  }
  function applySearch(v: string) {
    setSearch(v);
    setPage(1);
  }
  function applyPageSize(v: PageSize) {
    setPageSize(v);
    setPage(1);
  }

  // Cycle a column through asc → desc → unsorted; switching columns starts asc.
  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
    setPage(1);
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const someSelected =
    !allFilteredSelected && filtered.some((c) => selected.has(c.id));

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
    toast.loading(`Sending ${ids.length} lead(s) to the AI provider…`, {
      id: "analyze",
      duration: 2000,
    });
    try {
      const result = await analyzeLeads(ids);
      const succeeded = result.succeeded.length;
      const failed = result.failed.length;

      if (succeeded > 0 && failed === 0) {
        toast.success(`Analysis complete — ${succeeded} lead(s) qualified.`, {
          id: "analyze",
        });
        setSelected(new Set());
      } else if (succeeded > 0 && failed > 0) {
        toast.warning(
          `${succeeded} qualified, ${failed} failed. First error: ${result.failed[0].error}`,
          { id: "analyze", duration: 10000 },
        );
      } else {
        // Every lead failed — surface the first error so the user can act.
        const first = result.failed[0];
        toast.error(
          first ? `AI failed: ${first.error}` : "AI analysis failed.",
          { id: "analyze", duration: 12000 },
        );
      }
    } catch (err) {
      // analyzeLeads only throws on transport/auth issues (it already toasted).
      console.error("[runAnalysis]", err);
      toast.dismiss("analyze");
    } finally {
      setRunning(false);
    }
  }

  const showingFrom = sorted.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(endIdx, sorted.length);

  // Page-number jump input: keep a local draft so the user can type freely,
  // committing (clamped to [1, totalPages]) on Enter or blur.
  const [pageDraft, setPageDraft] = useState("");
  function commitPageDraft() {
    const n = Number(pageDraft);
    if (Number.isFinite(n) && n >= 1) {
      setPage(Math.min(Math.floor(n), totalPages));
    }
    setPageDraft("");
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              value={search}
              onChange={(e) => applySearch(e.target.value)}
              placeholder="Search company, industry, HQ…"
              className="h-9 w-64 pl-8"
            />
          </div>
          <MultiSelectDropdown<Channel>
            label="Channels"
            selected={channelFilter}
            onChange={applyChannelFilter}
            options={[
              {
                value: "linkedin",
                label: "Has LinkedIn",
                icon: <LinkedinIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />,
              },
              {
                value: "email",
                label: "Has Email",
                icon: <Mail className="h-3.5 w-3.5 text-fg-muted" />,
              },
            ]}
          />
          <MultiSelectDropdown<Tier>
            label="Tiers"
            selected={tierFilter}
            onChange={applyTierFilter}
            options={[
              { value: "priority", label: "Priority" },
              { value: "warm", label: "Warm" },
              { value: "nurture", label: "Nurture" },
            ]}
          />
          <MultiSelectDropdown<LeadStatus>
            label="Statuses"
            selected={statusFilter}
            onChange={applyStatusFilter}
            options={[
              { value: "pending_analysis", label: "Pending" },
              { value: "analyzing", label: "Analyzing" },
              { value: "qualified", label: "Qualified" },
              { value: "disqualified", label: "Disqualified" },
            ]}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-muted">
            {selected.size > 0 ? `${selected.size} selected · ` : ""}
            {filtered.length} of {companies.length} leads
          </span>
          <ImportLeadsButton />
          <HubSpotSyncButton />
          <DatabaseSyncButton />
          <Button
            variant="accent"
            size="md"
            onClick={runAnalysis}
            disabled={running || selected.size === 0}
          >
            <Brain className="h-4 w-4" />
            {running
              ? "Analyzing…"
              : `Run AI Analysis${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-left text-xs font-semibold uppercase tracking-wider text-fg-muted">
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
              <SortHeader label="Company" sortKey="name" sort={sort} onSort={toggleSort} />
              <th className="px-3 py-2.5">Industry</th>
              <SortHeader label="Size" sortKey="headcount" sort={sort} onSort={toggleSort} />
              <SortHeader label="Tier" sortKey="tier" sort={sort} onSort={toggleSort} />
              <th className="px-3 py-2.5">Channels</th>
              <th className="px-3 py-2.5">Intent Signals</th>
              <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-12 text-center text-sm text-fg-muted"
                >
                  {companies.length === 0
                    ? "No leads yet — import a CSV/XLSX or sync from HubSpot to get started."
                    : "No leads match your filters."}
                </td>
              </tr>
            )}
            {visible.map((c) => {
              const isSelected = selected.has(c.id);
              const channels = channelByCompany.get(c.id) ?? {
                linkedin: false,
                email: false,
              };
              return (
                <tr
                  key={c.id}
                  onClick={() => setOpenDrawerId(c.id)}
                  className={cn(
                    "border-b border-border text-sm transition-colors hover:bg-surface-2 cursor-pointer",
                    isSelected && "bg-blue-50/40 dark:bg-blue-950/40 hover:bg-blue-50/60 dark:bg-blue-950/40",
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
                    <div className="font-medium text-fg">{c.name}</div>
                    <div className="text-xs text-fg-muted">{c.hq}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.industry.slice(0, 2).map((i) => (
                        <span
                          key={i}
                          className="inline-block rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg"
                        >
                          {i}
                        </span>
                      ))}
                      {c.industry.length > 2 && (
                        <span className="text-[11px] text-fg-muted">
                          +{c.industry.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-fg-muted">
                    {c.headcount.toLocaleString()} emp
                  </td>
                  <td className="px-3 py-3">
                    <TierBadge tier={c.tier} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      {channels.linkedin && (
                        <LinkedinIcon
                          className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400"
                        />
                      )}
                      {channels.email && (
                        <Mail
                          className="h-3.5 w-3.5 text-fg-muted"
                          aria-label="Has Email"
                        />
                      )}
                      {!channels.linkedin && !channels.email && (
                        <span className="text-[11px] text-fg-subtle">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <IntentSignalList signals={c.intentSignals} max={2} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <StatusPill status={c.status} />
                      {c.analysis && (
                        <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
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

        {/* Pagination footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2/50 px-3 py-2">
          <div className="flex items-center gap-3 text-xs text-fg-muted">
            <span className="tabular-nums">
              Showing {showingFrom}–{showingTo} of {filtered.length}
            </span>
            <span className="text-fg-subtle">·</span>
            <label className="flex items-center gap-1.5">
              <span>Rows per page</span>
              <Select
                value={String(pageSize)}
                onChange={(e) => {
                  const v = e.target.value;
                  applyPageSize(
                    v === "all" ? "all" : (Number(v) as (typeof PAGE_SIZES)[number]),
                  );
                }}
                className="h-7 text-xs"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="all">All</option>
              </Select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="flex items-center gap-1.5 px-2 text-xs tabular-nums text-fg">
              Page
              <Input
                type="number"
                min={1}
                max={totalPages}
                value={pageDraft === "" ? String(safePage) : pageDraft}
                onChange={(e) => setPageDraft(e.target.value)}
                onFocus={(e) => {
                  setPageDraft(String(safePage));
                  e.target.select();
                }}
                onBlur={commitPageDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitPageDraft();
                    e.currentTarget.blur();
                  } else if (e.key === "Escape") {
                    setPageDraft("");
                    e.currentTarget.blur();
                  }
                }}
                disabled={totalPages <= 1}
                className="h-7 w-14 px-1.5 text-center text-xs tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Go to page"
              />
              of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <LeadDetailDrawer
        companyId={openDrawerId}
        onClose={() => setOpenDrawerId(null)}
      />
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir } | null;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className="px-3 py-2.5">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-surface-2/60",
          active ? "text-fg" : "text-fg-muted",
        )}
        title={`Sort by ${label}`}
      >
        {label}
        {!active && <ChevronsUpDown className="h-3 w-3 opacity-50" />}
        {active && sort?.dir === "asc" && <ChevronUp className="h-3 w-3" />}
        {active && sort?.dir === "desc" && <ChevronDown className="h-3 w-3" />}
      </button>
    </th>
  );
}
