import "server-only";
import { uid } from "@/lib/utils";
import type {
  LinkedInAdapter,
  SendConnectionInput,
  SendMessageInput,
  SendResult,
} from "./types";

export class MockLinkedInAdapter implements LinkedInAdapter {
  readonly provider = "mock" as const;

  isConfigured(): boolean {
    return true;
  }

  isAuthenticated(): boolean {
    return true;
  }

  async sendConnectionRequest(_input: SendConnectionInput): Promise<SendResult> {
    return {
      success: true,
      externalId: uid("mock-conn"),
      provider: this.provider,
    };
  }

  async sendDirectMessage(_input: SendMessageInput): Promise<SendResult> {
    return {
      success: true,
      externalId: uid("mock-dm"),
      provider: this.provider,
    };
  }
}
