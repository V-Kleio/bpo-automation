"use client";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { useStore, selectCompany, selectStakeholdersFor } from "@/lib/store";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TierBadge } from "./TierBadge";
import { IntentSignalList } from "./IntentSignalChip";
import { StatusPill } from "./StatusPill";
import { ROLE_LABEL, type Stakeholder } from "@/lib/types";
import { Mail, ExternalLink, Brain } from "lucide-react";
import { LinkedinIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const ROLE_BADGE_VARIANT: Record<
  Stakeholder["role"],
  "accent" | "purple" | "warning" | "info"
> = {
  champion: "accent",
  economic_buyer: "warning",
  technical_gatekeeper: "purple",
  ceo: "info",
};

export function LeadDetailDrawer({
  companyId,
  onClose,
}: {
  companyId: string | null;
  onClose: () => void;
}) {
  const company = useStore((s) =>
    companyId ? selectCompany(companyId)(s) : undefined,
  );
  const stakeholders = useStore(
    useShallow((s) =>
      companyId ? selectStakeholdersFor(companyId)(s) : [],
    ),
  );

  return (
    <Drawer
      open={!!companyId && !!company}
      onClose={onClose}
      title={company?.name}
      description={company?.industry.join(" · ")}
    >
      {company && (
        <div className="space-y-6 p-6">
          {/* Top metadata strip */}
          <div className="flex flex-wrap items-center gap-2">
            <TierBadge tier={company.tier} />
            <StatusPill status={company.status} />
            <Badge variant="outline">{company.size}</Badge>
            <Badge variant="outline">HQ: {company.hq}</Badge>
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Website <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Why target */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Why Target
            </h3>
            <p className="text-sm leading-relaxed text-zinc-700">
              {company.whyTarget}
            </p>
          </section>

          {/* Intent signals */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Intent Signals
            </h3>
            <IntentSignalList signals={company.intentSignals} max={10} />
          </section>

          {/* Stakeholders */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Decision Makers ({stakeholders.length})
            </h3>
            <ul className="space-y-2">
              {stakeholders
                .slice()
                .sort(
                  (a, b) =>
                    ["champion", "economic_buyer", "technical_gatekeeper", "ceo"].indexOf(
                      a.role,
                    ) -
                    ["champion", "economic_buyer", "technical_gatekeeper", "ceo"].indexOf(
                      b.role,
                    ),
                )
                .map((st) => (
                  <li
                    key={st.id}
                    className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        st.priority === "high"
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-700",
                      )}
                    >
                      {initials(st.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 truncate">
                          {st.name}
                        </span>
                        <Badge variant={ROLE_BADGE_VARIANT[st.role]}>
                          {ROLE_LABEL[st.role]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-600 line-clamp-2">
                        {st.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                        {st.whyTarget}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {st.linkedinUrl && (
                          <a
                            href={st.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-6 items-center gap-1 rounded border border-zinc-200 px-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            <LinkedinIcon className="h-3 w-3" />
                            LinkedIn
                          </a>
                        )}
                        {st.email && (
                          <a
                            href={`mailto:${st.email}`}
                            className="inline-flex h-6 items-center gap-1 rounded border border-zinc-200 px-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            <Mail className="h-3 w-3" />
                            Email
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          </section>

          {/* Actions */}
          <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-zinc-200 bg-white px-6 py-4">
            {company.analysis ? (
              <Link href={`/intelligence?companyId=${company.id}`}>
                <Button variant="primary" size="md" className="w-full">
                  <Brain className="h-4 w-4" />
                  View Full AI Analysis
                </Button>
              </Link>
            ) : (
              <p className="text-center text-xs text-zinc-500">
                Run AI analysis from the table to unlock the full intelligence report.
              </p>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
