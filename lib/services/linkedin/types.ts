import type { LinkedInProvider } from "@/lib/services/config";

export interface SendConnectionInput {
  profileUrl: string;
  firstName: string;
  note?: string;
}

export interface SendMessageInput {
  profileUrl: string;
  firstName: string;
  body: string;
  subject?: string;
}

export interface SendResult {
  success: boolean;
  externalId?: string;
  error?: string;
  provider: LinkedInProvider;
}

export interface LinkedInAdapter {
  readonly provider: LinkedInProvider;
  isConfigured(): boolean | Promise<boolean>;
  isAuthenticated(): boolean | Promise<boolean>;
  sendConnectionRequest(input: SendConnectionInput): Promise<SendResult>;
  sendDirectMessage(input: SendMessageInput): Promise<SendResult>;
  shutdown?(): Promise<void>;
}

export interface LinkedInStatus {
  provider: LinkedInProvider;
  configured: boolean;
  authenticated: boolean;
  dailyUsage: number;
  dailyCap: number;
  reason: string;
}

export type { LinkedInProvider };

// LinkedIn caps connection-request notes at 200 characters for free
// accounts (300 for Premium). We target the free-account limit so notes
// never arrive truncated mid-sentence on the recipient's side.
export const LINKEDIN_FREE_NOTE_MAX_LENGTH = 200;

// Trim a note to LinkedIn's character limit on a word boundary so it
// reads cleanly instead of being chopped mid-word. Adds an ellipsis only
// when the note actually had to be shortened.
export function truncateNote(
  note: string,
  max = LINKEDIN_FREE_NOTE_MAX_LENGTH,
): string {
  const clean = note.trim();
  if (clean.length <= max) return clean;
  // Reserve one char for the ellipsis, then back up to the last word
  // boundary (unless that would discard too much of the text).
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const body = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${body.trimEnd()}…`;
}
