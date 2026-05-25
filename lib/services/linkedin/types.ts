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
