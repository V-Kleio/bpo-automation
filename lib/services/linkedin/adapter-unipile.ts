import "server-only";
// Unipile 3rd-party REST adapter. Endpoint shapes follow Unipile's
// public LinkedIn integration API. Configure via UNIPILE_API_KEY and
// UNIPILE_ACCOUNT_ID in .env.local.
//
// Reference: https://developer.unipile.com/reference

import { uid } from "@/lib/utils";
import { getServerConfig } from "@/lib/services/config";
import type {
  LinkedInAdapter,
  SendConnectionInput,
  SendMessageInput,
  SendResult,
} from "./types";

function profileIdFromUrl(url: string): string | null {
  const m = url.match(/linkedin\.com\/in\/([\w\-_%.]+)/i);
  return m ? m[1].replace(/\/$/, "") : null;
}

const BASE_URL = "https://api2.unipile.com:13511/api/v1";

interface UnipileError {
  title?: string;
  detail?: string;
  status?: number;
}

async function unipileFetch<T>(
  path: string,
  init: RequestInit,
  apiKey: string,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "X-API-KEY": apiKey,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    let err: UnipileError = {};
    try {
      err = (await response.json()) as UnipileError;
    } catch {
      // ignore
    }
    throw new Error(
      err.detail ?? err.title ?? `Unipile HTTP ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

export class UnipileLinkedInAdapter implements LinkedInAdapter {
  readonly provider = "unipile" as const;

  isConfigured(): boolean {
    const cfg = getServerConfig();
    return cfg.linkedin.unipile.hasKey && !!cfg.linkedin.unipile.accountId;
  }

  isAuthenticated(): boolean {
    return this.isConfigured();
  }

  async sendConnectionRequest(
    input: SendConnectionInput,
  ): Promise<SendResult> {
    const cfg = getServerConfig().linkedin.unipile;
    if (!cfg.hasKey || !cfg.accountId) {
      return {
        success: false,
        provider: this.provider,
        error: "UNIPILE_API_KEY and UNIPILE_ACCOUNT_ID are required.",
      };
    }
    const profileId = profileIdFromUrl(input.profileUrl);
    if (!profileId) {
      return {
        success: false,
        provider: this.provider,
        error: `Could not parse profile id from URL ${input.profileUrl}`,
      };
    }
    try {
      const result = await unipileFetch<{ id?: string }>(
        "/users/invite",
        {
          method: "POST",
          body: JSON.stringify({
            account_id: cfg.accountId,
            provider_id: profileId,
            message: input.note,
          }),
        },
        cfg.apiKey,
      );
      return {
        success: true,
        externalId: result.id ?? uid("uni-conn"),
        provider: this.provider,
      };
    } catch (err) {
      return {
        success: false,
        provider: this.provider,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sendDirectMessage(input: SendMessageInput): Promise<SendResult> {
    const cfg = getServerConfig().linkedin.unipile;
    if (!cfg.hasKey || !cfg.accountId) {
      return {
        success: false,
        provider: this.provider,
        error: "UNIPILE_API_KEY and UNIPILE_ACCOUNT_ID are required.",
      };
    }
    const profileId = profileIdFromUrl(input.profileUrl);
    if (!profileId) {
      return {
        success: false,
        provider: this.provider,
        error: `Could not parse profile id from URL ${input.profileUrl}`,
      };
    }
    try {
      const result = await unipileFetch<{ id?: string }>(
        "/chats",
        {
          method: "POST",
          body: JSON.stringify({
            account_id: cfg.accountId,
            attendees_ids: [profileId],
            text: input.body,
          }),
        },
        cfg.apiKey,
      );
      return {
        success: true,
        externalId: result.id ?? uid("uni-dm"),
        provider: this.provider,
      };
    } catch (err) {
      return {
        success: false,
        provider: this.provider,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
