import "server-only";
// MCP (Model Context Protocol) plug-in adapter. Configure LINKEDIN_MCP_URL
// in .env.local to point at a LinkedIn MCP server (community-hosted or
// self-hosted). This is currently a STUB — wire the actual MCP client
// here when integrating with a specific MCP server. The selector still
// picks this adapter when LINKEDIN_MCP_URL is set so the integration
// surface is reserved.

import { getServerConfig } from "@/lib/services/config";
import type {
  LinkedInAdapter,
  SendConnectionInput,
  SendMessageInput,
  SendResult,
} from "./types";

export class McpLinkedInAdapter implements LinkedInAdapter {
  readonly provider = "mcp" as const;

  isConfigured(): boolean {
    return !!getServerConfig().linkedin.mcp.url;
  }

  isAuthenticated(): boolean {
    return this.isConfigured();
  }

  async sendConnectionRequest(
    _input: SendConnectionInput,
  ): Promise<SendResult> {
    return {
      success: false,
      provider: this.provider,
      error:
        "MCP LinkedIn adapter is a stub. Implement the MCP client call in lib/services/linkedin/adapter-mcp.ts.",
    };
  }

  async sendDirectMessage(_input: SendMessageInput): Promise<SendResult> {
    return {
      success: false,
      provider: this.provider,
      error:
        "MCP LinkedIn adapter is a stub. Implement the MCP client call in lib/services/linkedin/adapter-mcp.ts.",
    };
  }
}
