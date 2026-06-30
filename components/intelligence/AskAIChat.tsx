"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { streamAskAI } from "@/lib/services/ai-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Send, Sparkles, MessageSquare, RotateCcw, Copy, Check } from "lucide-react";
import { uid } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SUGGESTED_PROMPTS = [
  "Why is this lead a priority fit?",
  "Draft a follow-up message",
  "Rank the qualified companies",
  "What should I do next?",
];

export function AskAIChat({ companyId }: { companyId: string | null }) {
  const messages = useStore((s) => s.chat);
  const appendChatMessage = useStore((s) => s.appendChatMessage);
  const updateChatMessage = useStore((s) => s.updateChatMessage);
  const log = useStore((s) => s.log);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  // Filter to context-specific thread when companyId is set; otherwise show recent
  const visible = companyId
    ? messages.filter(
        (m) =>
          !m.contextCompanyIds || m.contextCompanyIds.includes(companyId),
      )
    : messages;

  const last = visible[visible.length - 1];
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
    // Re-pin to bottom as tokens stream in (content + streaming flag change).
  }, [visible.length, last?.content, last?.streaming]);

  async function send(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setInput("");

    const ctxIds = companyId ? [companyId] : [];
    const now = new Date().toISOString();

    appendChatMessage({
      id: uid("chat"),
      role: "user",
      content: trimmed,
      at: now,
      contextCompanyIds: ctxIds,
    });

    const assistantId = uid("chat");
    appendChatMessage({
      id: assistantId,
      role: "assistant",
      content: "",
      at: new Date().toISOString(),
      contextCompanyIds: ctxIds,
      streaming: true,
    });

    log({
      layer: 2,
      type: "ai_call",
      summary: `Ask-AI: "${trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed}"`,
      companyId: companyId ?? undefined,
    });

    let acc = "";
    try {
      for await (const chunk of streamAskAI(trimmed, ctxIds)) {
        acc += chunk;
        updateChatMessage(assistantId, { content: acc });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateChatMessage(assistantId, {
        content: acc + (acc ? "\n\n" : "") + `_(Stream error: ${msg})_`,
      });
      toast.error("Ask-AI stream failed", { description: msg });
    } finally {
      updateChatMessage(assistantId, { streaming: false });
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-surface-2">
      {confirmDialog}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-fg">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">Ask AI</div>
            <div className="mt-0.5 text-[11px] text-fg-muted">
              {companyId ? "Scoped to the selected company" : "Pick a company to ground the chat"}
            </div>
          </div>
        </div>
        {visible.length > 0 && (
          <Button
            variant="ghost"
            size="iconSm"
            onClick={async () => {
              if (
                await confirm({
                  title: "Clear this chat?",
                  description:
                    "All messages in this thread will be removed. This can't be undone.",
                  confirmLabel: "Clear chat",
                  destructive: true,
                })
              ) {
                useStore.setState({ chat: [] });
              }
            }}
            title="Clear chat"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {visible.length === 0 && (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface p-6 text-center">
            <MessageSquare className="mx-auto mb-2 h-5 w-5 text-fg-subtle" />
            <p className="text-xs text-fg-muted">
              Ask the AI anything about the selected company — qualification,
              messaging strategy, next moves.
            </p>
          </div>
        )}
        {visible.map((m) => (
          <div
            key={m.id}
            className={cn(
              "group flex",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "relative max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed shadow-sm",
                m.role === "user"
                  ? "bg-primary text-primary-fg"
                  : "bg-surface text-fg border border-border",
              )}
            >
              <pre
                className={cn(
                  "whitespace-pre-wrap font-sans",
                  m.streaming && "stream-cursor",
                )}
              >
                {m.content || (m.streaming ? "" : "…")}
              </pre>
              {m.role === "assistant" && !m.streaming && m.content && (
                <CopyMessageButton text={m.content} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border bg-surface px-4 py-3">
        {visible.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={busy}
                className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-fg-muted hover:bg-surface-2 disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this lead…"
            rows={2}
            className="resize-none text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            disabled={busy}
          />
          <Button
            variant="primary"
            size="icon"
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        toast.success("Response copied");
      }}
      title="Copy response"
      className="absolute -bottom-2 -right-2 rounded-md border border-border bg-surface p-1 text-fg-muted opacity-0 shadow-sm transition-opacity hover:text-fg group-hover:opacity-100"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}
