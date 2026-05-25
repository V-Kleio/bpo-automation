import "server-only";
import fs from "fs";
import path from "path";
import { getServerConfig } from "@/lib/services/config";

export function getSessionPath(): string {
  return getServerConfig().linkedin.playwright.sessionPath;
}

export function hasSavedSession(): boolean {
  return fs.existsSync(getSessionPath());
}

export function clearSavedSession(): void {
  const p = getSessionPath();
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
}

export function ensureSessionDir(): void {
  const p = getSessionPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
}
