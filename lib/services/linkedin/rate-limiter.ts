import "server-only";
import fs from "fs";
import path from "path";
import { getServerConfig } from "@/lib/services/config";

const USAGE_FILE = path.resolve(process.cwd(), ".data/linkedin/usage.json");

interface UsageData {
  date: string; // YYYY-MM-DD
  count: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readUsage(): UsageData {
  try {
    if (!fs.existsSync(USAGE_FILE)) {
      return { date: todayKey(), count: 0 };
    }
    const raw = fs.readFileSync(USAGE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as UsageData;
    if (parsed.date !== todayKey()) {
      return { date: todayKey(), count: 0 };
    }
    return parsed;
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

function writeUsage(data: UsageData): void {
  fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
  fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export interface RateLimitState {
  used: number;
  cap: number;
  remaining: number;
}

export function getUsage(): RateLimitState {
  const cap = getServerConfig().linkedin.dailyCap;
  const usage = readUsage();
  return {
    used: usage.count,
    cap,
    remaining: Math.max(0, cap - usage.count),
  };
}

export class RateLimitExceededError extends Error {
  constructor(public state: RateLimitState) {
    super(
      `LinkedIn daily cap reached: ${state.used} of ${state.cap}. Try again tomorrow.`,
    );
    this.name = "RateLimitExceededError";
  }
}

export function acquireSlot(): RateLimitState {
  const cap = getServerConfig().linkedin.dailyCap;
  const usage = readUsage();
  if (usage.count >= cap) {
    throw new RateLimitExceededError({
      used: usage.count,
      cap,
      remaining: 0,
    });
  }
  const next = { date: usage.date, count: usage.count + 1 };
  writeUsage(next);
  return {
    used: next.count,
    cap,
    remaining: cap - next.count,
  };
}
