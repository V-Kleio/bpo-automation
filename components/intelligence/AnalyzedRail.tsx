"use client";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "@/lib/store";
import { TierBadge } from "@/components/leads/TierBadge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnalyzedRail({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const allCompanies = useStore(
    useShallow((s) =>
      s.companies
        .filter((c) => c.analysis)
        .sort(
          (a, b) =>
            (b.analysis?.priorityScore ?? 0) -
            (a.analysis?.priorityScore ?? 0),
        ),
    ),
  );
  const [query, setQuery] = useState("");

  const companies = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCompanies;
    return allCompanies.filter((c) =>
      `${c.name} ${c.industry.join(" ")}`.toLowerCase().includes(q),
    );
  }, [allCompanies, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Analyzed Companies
        </div>
        <div className="text-[11px] text-zinc-400">
          {query
            ? `${companies.length} of ${allCompanies.length} match`
            : `${allCompanies.length} ready for outreach`}
        </div>
        {allCompanies.length > 0 && (
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or industry…"
              className="h-7 pl-7 text-xs"
            />
          </div>
        )}
      </div>
      <ul className="flex-1 overflow-y-auto p-2 space-y-1">
        {allCompanies.length === 0 && (
          <li className="rounded-md border border-dashed border-zinc-300 bg-white p-4 text-center text-[11px] text-zinc-500">
            No companies analyzed yet. Run AI Analysis from the Leads page.
          </li>
        )}
        {allCompanies.length > 0 && companies.length === 0 && (
          <li className="rounded-md border border-dashed border-zinc-300 bg-white p-4 text-center text-[11px] text-zinc-500">
            No analyzed companies match “{query}”.
          </li>
        )}
        {companies.map((c) => {
          const active = c.id === selectedId;
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className={cn(
                  "w-full rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-transparent bg-white text-zinc-700 hover:border-zinc-200 hover:bg-zinc-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold truncate">{c.name}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-zinc-100 text-zinc-700",
                    )}
                  >
                    {c.analysis?.priorityScore}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {!active && <TierBadge tier={c.tier} />}
                  {active && (
                    <span className="inline-flex items-center rounded border border-white/30 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                      {c.tier}
                    </span>
                  )}
                  <span
                    className={cn(
                      "truncate text-[10px]",
                      active ? "text-white/70" : "text-zinc-500",
                    )}
                  >
                    {c.industry[0]}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
