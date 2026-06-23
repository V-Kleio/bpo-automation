"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Mail } from "lucide-react";
import { LinkedinIcon } from "@/components/ui/icons";
import { ROLE_LABEL, type GeneratedMessage, type Stakeholder } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STEP_INFO: Record<
  1 | 2 | 3 | 4,
  { label: string; subline: string; ring: string }
> = {
  1: {
    label: "Step 1 · Operational Champion",
    subline: "Feels the pain — entry point for the sequence.",
    ring: "border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/40",
  },
  2: {
    label: "Step 2 · Economic Buyer",
    subline: "CDO / COO — unlocks the budget after Champion validates.",
    ring: "border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/40",
  },
  3: {
    label: "Step 3 · Technical Gatekeeper",
    subline: "CTO / IT — looped in early to avoid last-minute veto.",
    ring: "border-violet-200 dark:border-violet-900 bg-violet-50/40 dark:bg-violet-950/40",
  },
  4: {
    label: "Step 4 · CEO / Final Sign-off",
    subline: "Only triggered for deals >$50k or enterprise-level contracts.",
    ring: "border-cyan-200 dark:border-cyan-900 bg-cyan-50/40 dark:bg-cyan-950/40",
  },
};

export function GeneratedMessages({
  messages,
  stakeholders,
}: {
  messages: GeneratedMessage[];
  stakeholders: Stakeholder[];
}) {
  const [step, setStep] = useState<"1" | "2" | "3" | "4">("1");

  const stepNum = Number(step) as 1 | 2 | 3 | 4;
  const stepMessages = messages.filter((m) => m.step === stepNum);
  const info = STEP_INFO[stepNum];

  // Group by stakeholder for this step
  const byStakeholder = new Map<string, GeneratedMessage[]>();
  for (const m of stepMessages) {
    if (!byStakeholder.has(m.stakeholderId))
      byStakeholder.set(m.stakeholderId, []);
    byStakeholder.get(m.stakeholderId)!.push(m);
  }

  return (
    <Tabs value={step} onValueChange={(v) => setStep(v as "1" | "2" | "3" | "4")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="1">Step 1</TabsTrigger>
          <TabsTrigger value="2">Step 2</TabsTrigger>
          <TabsTrigger value="3">Step 3</TabsTrigger>
          <TabsTrigger value="4">Step 4</TabsTrigger>
        </TabsList>
        <div className="text-right">
          <div className="text-xs font-semibold text-fg">{info.label}</div>
          <div className="text-[11px] text-fg-muted">{info.subline}</div>
        </div>
      </div>

      {(["1", "2", "3", "4"] as const).map((s) => (
        <TabsContent key={s} value={s}>
          {byStakeholder.size === 0 ? (
            <div className="rounded-lg border border-dashed border-border-strong bg-surface p-8 text-center text-sm text-fg-muted">
              No stakeholder mapped to this step for this company.
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from(byStakeholder.entries()).map(([stId, msgs]) => {
                const st = stakeholders.find((x) => x.id === stId);
                if (!st) return null;
                return (
                  <div
                    key={stId}
                    className={cn(
                      "rounded-lg border bg-surface p-3",
                      STEP_INFO[stepNum].ring,
                    )}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-fg">
                        {st.name
                          .split(" ")
                          .filter(Boolean)
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-fg">
                          {st.name}
                        </div>
                        <div className="text-[11px] text-fg-muted truncate">
                          {st.title}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {ROLE_LABEL[st.role]}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {msgs.map((m) => (
                        <MessageCard key={m.id} msg={m} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function MessageCard({ msg }: { msg: GeneratedMessage }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const text = msg.subject
      ? `Subject: ${msg.subject}\n\n${msg.body}`
      : msg.body;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Message copied to clipboard");
  }

  const isEmail = msg.channel === "email";
  const Icon = isEmail ? Mail : LinkedinIcon;

  return (
    <div className="flex flex-col rounded-md border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
          <Icon className="h-3.5 w-3.5" />
          {isEmail ? "Email" : "LinkedIn DM"}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="iconSm" onClick={copy}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <div className="space-y-2 px-3 py-2.5">
        {msg.subject && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
              Subject
            </div>
            <div className="text-xs font-medium text-fg">
              {msg.subject}
            </div>
          </div>
        )}
        <div>
          {msg.subject && (
            <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
              Body
            </div>
          )}
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-fg">
            {msg.body}
          </pre>
        </div>
      </div>
    </div>
  );
}
