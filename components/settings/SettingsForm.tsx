"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { invalidateClientConfig } from "@/lib/services/public-config-client";

// Mirrors the sanitized view served by /api/settings. Secrets carry only
// isSet + mask — the server never sends cleartext secret values.
type SettingGroup =
  | "ai"
  | "hubspot"
  | "linkedin_provider"
  | "linkedin_pacing"
  | "database";

interface SanitizedField {
  key: string;
  label: string;
  group: SettingGroup;
  type: "string" | "secret" | "boolean" | "number" | "enum";
  enumValues?: string[];
  placeholder?: string;
  help?: string;
  isSet: boolean;
  mask?: string;
  value?: string;
}

interface SettingsView {
  fields: SanitizedField[];
  ai: { provider: string; kind: string; reason: string; configured: boolean };
  linkedin: { provider: string; reason: string };
  anthropic: {
    configured: boolean;
    webSearchEffective: boolean;
    mixedAuth: boolean;
  };
}

const GROUPS: Array<{
  id: SettingGroup;
  title: string;
  description: string;
}> = [
  {
    id: "ai",
    title: "AI Intelligence",
    description:
      "Pick a reasoning provider for Layer 2 analysis and the Ask-AI chat. Anthropic, or any OpenAI-compatible endpoint — Groq, OpenRouter, Gemini, Ollama, DeepSeek.",
  },
  {
    id: "hubspot",
    title: "HubSpot",
    description: "Token for the contact sync on the Leads page.",
  },
  {
    id: "linkedin_provider",
    title: "LinkedIn Provider",
    description:
      "Which adapter sends connection requests. Precedence: Unipile → MCP → Playwright → none.",
  },
  {
    id: "linkedin_pacing",
    title: "LinkedIn Pacing",
    description:
      "Daily cap and inter-send jitter for the send queue. Changes apply to the next queued item.",
  },
  {
    id: "database",
    title: "MySQL Database",
    description:
      "Local MySQL container for Layer 1 lead acquisition. Credentials connect to the bpo-mysql Docker container.",
  },
];

const PROVIDER_BADGE: Record<
  string,
  "success" | "info" | "warning" | "outline"
> = {
  unipile: "info",
  mcp: "info",
  playwright: "success",
  mock: "warning",
};

export function SettingsForm() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Draft edits keyed by env key. Absent = untouched (use server value).
  const [draft, setDraft] = useState<Record<string, string>>({});
  // Secrets explicitly marked for clearing on the next save.
  const [clears, setClears] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingGroup, setSavingGroup] = useState<SettingGroup | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setView((await res.json()) as SettingsView);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    // Mount-time fetch; setState happens only after the response resolves
    // (same accepted pattern as the queue panel's polling refresh).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const fieldsByGroup = useMemo(() => {
    const map = new Map<SettingGroup, SanitizedField[]>();
    for (const f of view?.fields ?? []) {
      const list = map.get(f.group) ?? [];
      list.push(f);
      map.set(f.group, list);
    }
    return map;
  }, [view]);

  const isDirty = useCallback(
    (f: SanitizedField): boolean => {
      if (clears.has(f.key)) return true;
      const d = draft[f.key];
      if (d === undefined) return false;
      if (f.type === "secret") return d.trim().length > 0;
      return d !== (f.value ?? "");
    },
    [draft, clears],
  );

  const saveGroup = useCallback(
    async (group: SettingGroup) => {
      if (!view) return;
      const updates: Record<string, string | null> = {};
      for (const f of view.fields) {
        if (f.group !== group || !isDirty(f)) continue;
        updates[f.key] = clears.has(f.key) ? null : (draft[f.key] ?? "");
      }
      if (Object.keys(updates).length === 0) {
        toast.info("No changes to save.");
        return;
      }
      setSavingGroup(group);
      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        });
        const body = (await res.json()) as
          | SettingsView
          | { error: string; fieldErrors?: Record<string, string> };
        if (!res.ok) {
          const errBody = body as {
            error: string;
            fieldErrors?: Record<string, string>;
          };
          setFieldErrors((prev) => ({ ...prev, ...errBody.fieldErrors }));
          toast.error(errBody.error || "Failed to save settings.");
          return;
        }
        setView(body as SettingsView);
        // Drop drafts/clears/errors for the saved group only.
        const groupKeys = new Set(
          (body as SettingsView).fields
            .filter((f) => f.group === group)
            .map((f) => f.key),
        );
        setDraft((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(([k]) => !groupKeys.has(k)),
          ),
        );
        setClears((prev) => new Set([...prev].filter((k) => !groupKeys.has(k))));
        setFieldErrors((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(([k]) => !groupKeys.has(k)),
          ),
        );
        invalidateClientConfig();
        toast.success("Settings saved.");
      } catch (err) {
        toast.error(
          `Failed to save: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setSavingGroup(null);
      }
    },
    [view, draft, clears, isDirty],
  );

  if (loadError) {
    return (
      <Card>
        <CardContent className="text-sm text-red-600 dark:text-red-400">
          Failed to load settings: {loadError}
        </CardContent>
      </Card>
    );
  }
  if (!view) {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {GROUPS.map((group) => {
        const fields = fieldsByGroup.get(group.id) ?? [];
        const dirtyCount = fields.filter(isDirty).length;
        return (
          <Card key={group.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{group.title}</CardTitle>
                {group.id === "ai" && (
                  <Badge variant={view.ai.configured ? "success" : "warning"}>
                    {view.ai.provider} · {view.ai.reason}
                  </Badge>
                )}
                {group.id === "linkedin_provider" && (
                  <Badge
                    variant={PROVIDER_BADGE[view.linkedin.provider] ?? "outline"}
                  >
                    {view.linkedin.provider} · {view.linkedin.reason}
                  </Badge>
                )}
              </div>
              <CardDescription>{group.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {group.id === "ai" && view.anthropic.mixedAuth && (
                <p className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800">
                  Both an API key and an OAuth token are set — the gateway
                  rejects mixed auth. Clear one of them.
                </p>
              )}
              {fields.map((f) => (
                <FieldRow
                  key={f.key}
                  field={f}
                  value={draft[f.key]}
                  markedForClear={clears.has(f.key)}
                  error={fieldErrors[f.key]}
                  onChange={(v) =>
                    setDraft((prev) => ({ ...prev, [f.key]: v }))
                  }
                  onToggleClear={() =>
                    setClears((prev) => {
                      const next = new Set(prev);
                      if (next.has(f.key)) next.delete(f.key);
                      else next.add(f.key);
                      return next;
                    })
                  }
                />
              ))}
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button
                size="sm"
                onClick={() => void saveGroup(group.id)}
                disabled={savingGroup !== null || dirtyCount === 0}
              >
                {savingGroup === group.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
      <p className="text-xs text-fg-subtle">
        Saves write to <code>.env.local</code> and take effect immediately —
        no restart needed.
      </p>
    </div>
  );
}

function FieldRow({
  field,
  value,
  markedForClear,
  error,
  onChange,
  onToggleClear,
}: {
  field: SanitizedField;
  value: string | undefined;
  markedForClear: boolean;
  error?: string;
  onChange: (v: string) => void;
  onToggleClear: () => void;
}) {
  const effective = value ?? field.value ?? "";

  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[220px_1fr] sm:items-start sm:gap-4">
      <label className="pt-1.5 text-sm font-medium text-fg">
        {field.label}
      </label>
      <div className="min-w-0 space-y-1">
        {field.type === "boolean" ? (
          <div className="flex h-9 items-center gap-2">
            <Checkbox
              checked={effective === "1"}
              onCheckedChange={(v) => onChange(v ? "1" : "0")}
              aria-label={field.label}
            />
            <span className="text-sm text-fg-muted">
              {effective === "1" ? "Enabled" : "Disabled"}
            </span>
          </div>
        ) : field.type === "enum" ? (
          <Select
            value={effective}
            onChange={(e) => onChange(e.target.value)}
            className="w-48"
          >
            {(field.enumValues ?? []).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        ) : field.type === "secret" ? (
          <div className="flex items-center gap-2">
            <Input
              type="password"
              value={value ?? ""}
              disabled={markedForClear}
              onChange={(e) => onChange(e.target.value)}
              placeholder={
                markedForClear
                  ? "will be cleared on save"
                  : field.isSet
                    ? `${field.mask} — leave blank to keep`
                    : "not set"
              }
              autoComplete="off"
            />
            {field.isSet && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggleClear}
                title={markedForClear ? "Keep the saved value" : "Clear the saved value"}
              >
                {markedForClear ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" /> Keep
                  </>
                ) : (
                  <>
                    <X className="h-3.5 w-3.5" /> Clear
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <Input
            value={effective}
            inputMode={field.type === "number" ? "numeric" : undefined}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        )}
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : field.help ? (
          <p className="text-xs text-fg-muted">{field.help}</p>
        ) : null}
      </div>
    </div>
  );
}
