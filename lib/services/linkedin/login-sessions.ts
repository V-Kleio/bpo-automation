import "server-only";
// In-memory tracking of in-flight Playwright login sessions. The connect
// route kicks off a headed browser and writes session.json when the user
// finishes logging in. Status polling reads from this map.
//
// Notes:
// - State only lives in this process. If next dev restarts mid-login, the
//   user has to start the flow again.
// - This is intentionally not persisted — login is a one-shot.

import { uid } from "@/lib/utils";

export type LoginState = "pending" | "success" | "failed" | "cancelled";

export interface LoginSession {
  id: string;
  state: LoginState;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  cancel?: () => Promise<void>;
}

const sessions = new Map<string, LoginSession>();

export function createLoginSession(
  cancel: () => Promise<void>,
): LoginSession {
  const id = uid("login");
  const s: LoginSession = {
    id,
    state: "pending",
    startedAt: new Date().toISOString(),
    cancel,
  };
  sessions.set(id, s);
  return s;
}

export function getLoginSession(id: string): LoginSession | undefined {
  return sessions.get(id);
}

export function markLoginSession(
  id: string,
  state: LoginState,
  error?: string,
): void {
  const s = sessions.get(id);
  if (!s) return;
  s.state = state;
  s.finishedAt = new Date().toISOString();
  if (error) s.error = error;
}

export function deleteLoginSession(id: string): void {
  sessions.delete(id);
}
