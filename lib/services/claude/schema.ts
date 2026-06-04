// JSON Schema for the AIAnalysis output, used as the input_schema of the
// `submit_lead_analysis` tool. Mirrors lib/types.ts AIAnalysis 1:1 minus the
// `analyzedAt` and `generatedMessages.id` fields (the route fills those in
// server-side after the call returns).

import { WIZ_CRITERIA } from "./wiz-criteria";
import { LINKEDIN_FREE_NOTE_MAX_LENGTH } from "@/lib/services/linkedin/types";

const dimension = {
  type: "object",
  properties: {
    score: {
      type: "integer",
      minimum: 0,
      maximum: 10,
      description: "Score 0-10 (integer) for this WIZ.AI criterion.",
    },
    reasoning: {
      type: "string",
      description:
        "1-2 sentence justification grounded in the company's provided facts and the public information you retrieved via web_search.",
    },
  },
  required: ["score", "reasoning"],
  additionalProperties: false,
} as const;

// Build the qualification object dynamically so the schema can never drift
// from WIZ_CRITERIA. Order matches the PDF (1..9).
const qualificationProperties = Object.fromEntries(
  WIZ_CRITERIA.map((c) => [
    c.key,
    {
      ...dimension,
      description: `Criterion ${c.no}: ${c.label} — ${c.whatToLookFor}. Score 0-10.`,
    },
  ]),
) as Record<string, typeof dimension>;

const qualificationRequired = WIZ_CRITERIA.map((c) => c.key);

export const ANALYZE_TOOL_NAME = "submit_lead_analysis";

export const ANALYZE_TOOL_DESCRIPTION =
  "Submit the completed WIZ.AI lead analysis. Call exactly once with the full structured payload after you have finished any web research. Do not return narrative outside this tool call.";

export const ANALYZE_TOOL_SCHEMA = {
  type: "object",
  properties: {
    priorityScore: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description:
        "Overall priority score 0-100. Compute as round(average(9 criterion scores) * 10).",
    },
    qualification: {
      type: "object",
      properties: qualificationProperties,
      required: qualificationRequired,
      additionalProperties: false,
    },
    partnership: {
      type: "object",
      properties: {
        strategicAlignment: {
          type: "string",
          description:
            "1-2 sentences: how WIZ.AI's AI Inbound + Talkbot Outbound map to this company's specific operations.",
        },
        aiReadiness: {
          type: "string",
          description:
            "High / Medium / Low + the single fact (from research or input) that drives the rating.",
        },
        growthPotential: {
          type: "string",
          description:
            "Concrete account-expansion path from a pilot use case to broader rollout.",
        },
        localizationFit: {
          type: "string",
          description:
            "Note WIZ.AI's Bahasa Indonesia + regional dialect coverage relative to this company's language need.",
        },
      },
      required: [
        "strategicAlignment",
        "aiReadiness",
        "growthPotential",
        "localizationFit",
      ],
      additionalProperties: false,
    },
    webResearchSummary: {
      type: "string",
      description:
        "1-3 sentence summary of what you actually learned about this company from web_search (recent news, headcount range, regulatory posture, etc.). Leave blank if you did not search.",
    },
    generatedMessages: {
      type: "array",
      description:
        "Two messages per stakeholder (one LinkedIn DM + one Email), 4-step sequence — Champion (1) → Economic Buyer (2) → Technical Gatekeeper (3) → CEO (4).",
      items: {
        type: "object",
        properties: {
          stakeholderId: {
            type: "string",
            description:
              "ID of the stakeholder this message targets — must match one of the IDs provided in the input.",
          },
          channel: {
            type: "string",
            enum: ["linkedin", "email"],
          },
          step: {
            type: "integer",
            enum: [1, 2, 3, 4],
          },
          subject: {
            type: "string",
            description: "Email subject line. Omit for LinkedIn messages.",
          },
          body: {
            type: "string",
            description: `Message body. LinkedIn DM: MUST be ≤${LINKEDIN_FREE_NOTE_MAX_LENGTH} characters (LinkedIn's hard limit for a free-account connection note; longer notes get truncated), aim for ~${LINKEDIN_FREE_NOTE_MAX_LENGTH - 20}. Email: full multi-paragraph copy.`,
          },
        },
        required: ["stakeholderId", "channel", "step", "body"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "priorityScore",
    "qualification",
    "partnership",
    "generatedMessages",
  ],
  additionalProperties: false,
} as const;
