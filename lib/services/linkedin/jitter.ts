import "server-only";
import { getServerConfig } from "@/lib/services/config";

export function randomDelayMs(): number {
  const cfg = getServerConfig();
  const min = cfg.linkedin.minDelayMs;
  const max = cfg.linkedin.maxDelayMs;
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min));
}

export function keystrokeDelay(): number {
  return 60 + Math.floor(Math.random() * 120);
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
