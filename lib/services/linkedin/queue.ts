import "server-only";
import { randomUUID } from "crypto";
import { selectAdapter } from "./selector";
import {
  acquireSlot,
  getUsage,
  RateLimitExceededError,
} from "./rate-limiter";
import { randomDelayMs, sleep } from "./jitter";

export type QueueKind = "connect" | "dm";
export type QueueStatus = "pending" | "sending" | "sent" | "failed";

export interface QueueItem {
  id: string;
  companyId: string;
  stakeholderId: string;
  step: 1 | 2 | 3 | 4;
  kind: QueueKind;
  profileUrl: string;
  firstName: string;
  note?: string;
  body?: string;
  enqueuedAt: string;
  status: QueueStatus;
  startedAt?: string;
  finishedAt?: string;
  externalId?: string;
  error?: string;
}

export interface EnqueueInput {
  companyId: string;
  stakeholderId: string;
  step: 1 | 2 | 3 | 4;
  kind: QueueKind;
  profileUrl: string;
  firstName: string;
  note?: string;
  body?: string;
}

interface QueueState {
  items: QueueItem[];
  running: boolean;
  nextEligibleAt: number | null; // epoch ms — earliest time the worker will run again
  workerPromise: Promise<void> | null;
}

const GLOBAL_KEY = "__linkedin_queue_state_v1__";

declare global {
  // Survives HMR in `next dev`.
  var __linkedin_queue_state_v1__: QueueState | undefined;
}

function getState(): QueueState {
  let state = globalThis[GLOBAL_KEY as keyof typeof globalThis] as
    | QueueState
    | undefined;
  if (!state) {
    state = {
      items: [],
      running: false,
      nextEligibleAt: null,
      workerPromise: null,
    };
    (globalThis as unknown as Record<string, unknown>)[GLOBAL_KEY] = state;
  }
  return state;
}

export function enqueue(inputs: EnqueueInput[]): { enqueued: string[]; skipped: number } {
  const state = getState();
  const enqueued: string[] = [];
  let skipped = 0;

  for (const input of inputs) {
    // Dedupe: skip if there's already a pending/sending/sent item for the same
    // stakeholder+kind+step. Failed items can be retried — they don't block.
    const dup = state.items.find(
      (i) =>
        i.stakeholderId === input.stakeholderId &&
        i.step === input.step &&
        i.kind === input.kind &&
        (i.status === "pending" ||
          i.status === "sending" ||
          i.status === "sent"),
    );
    if (dup) {
      skipped += 1;
      continue;
    }
    const item: QueueItem = {
      id: randomUUID(),
      companyId: input.companyId,
      stakeholderId: input.stakeholderId,
      step: input.step,
      kind: input.kind,
      profileUrl: input.profileUrl,
      firstName: input.firstName,
      note: input.note,
      body: input.body,
      enqueuedAt: new Date().toISOString(),
      status: "pending",
    };
    state.items.push(item);
    enqueued.push(item.id);
  }

  if (enqueued.length > 0) {
    startWorker();
  }
  return { enqueued, skipped };
}

export function getSnapshot(): {
  running: boolean;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  nextAtIso: string | null;
  dailyUsage: number;
  dailyCap: number;
  remaining: number;
  items: QueueItem[];
} {
  const state = getState();
  const usage = getUsage();
  const counts = state.items.reduce(
    (acc, i) => {
      acc[i.status] += 1;
      return acc;
    },
    { pending: 0, sending: 0, sent: 0, failed: 0 } as Record<QueueStatus, number>,
  );
  return {
    running: state.running,
    pending: counts.pending,
    sending: counts.sending,
    sent: counts.sent,
    failed: counts.failed,
    nextAtIso:
      state.nextEligibleAt && state.nextEligibleAt > Date.now()
        ? new Date(state.nextEligibleAt).toISOString()
        : null,
    dailyUsage: usage.used,
    dailyCap: usage.cap,
    remaining: usage.remaining,
    items: state.items.slice(-100),
  };
}

export function clearFinished(): number {
  const state = getState();
  const before = state.items.length;
  state.items = state.items.filter(
    (i) => i.status === "pending" || i.status === "sending",
  );
  return before - state.items.length;
}

export function clearAll(): number {
  const state = getState();
  const removed = state.items.filter((i) => i.status === "pending").length;
  state.items = state.items.filter((i) => i.status !== "pending");
  return removed;
}

function startWorker(): void {
  const state = getState();
  if (state.workerPromise) return;
  state.running = true;
  state.workerPromise = runWorker().finally(() => {
    state.running = false;
    state.nextEligibleAt = null;
    state.workerPromise = null;
  });
}

async function runWorker(): Promise<void> {
  const state = getState();
  // Re-check provider on each tick so config changes during a long run
  // are picked up (e.g., user disconnects mid-queue).
  while (true) {
    const next = state.items.find((i) => i.status === "pending");
    if (!next) return; // nothing to do
    const { provider } = selectAdapter();
    if (provider === "mock") {
      // Fail all remaining items rather than silently looping forever.
      const now = new Date().toISOString();
      for (const item of state.items) {
        if (item.status === "pending") {
          item.status = "failed";
          item.finishedAt = now;
          item.error = "LinkedIn provider not configured.";
        }
      }
      return;
    }
    await sendOne(next);
    // Pace between items only if more remain.
    if (state.items.some((i) => i.status === "pending")) {
      const delay = randomDelayMs();
      state.nextEligibleAt = Date.now() + delay;
      await sleep(delay);
    }
  }
}

async function sendOne(item: QueueItem): Promise<void> {
  item.status = "sending";
  item.startedAt = new Date().toISOString();

  try {
    acquireSlot();
  } catch (err) {
    item.status = "failed";
    item.finishedAt = new Date().toISOString();
    item.error =
      err instanceof RateLimitExceededError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return;
  }

  try {
    const { adapter } = selectAdapter();
    const result =
      item.kind === "connect"
        ? await adapter.sendConnectionRequest({
            profileUrl: item.profileUrl,
            firstName: item.firstName,
            note: item.note,
          })
        : await adapter.sendDirectMessage({
            profileUrl: item.profileUrl,
            firstName: item.firstName,
            body: item.body ?? "",
          });

    item.finishedAt = new Date().toISOString();
    if (result.success) {
      item.status = "sent";
      item.externalId = result.externalId;
    } else {
      item.status = "failed";
      item.error = result.error ?? "send failed";
    }
  } catch (err) {
    item.status = "failed";
    item.finishedAt = new Date().toISOString();
    item.error = err instanceof Error ? err.message : String(err);
  }
}
