// JSON Schema for the AIAnalysis output, used as the input_schema of the
// `submit_lead_analysis` tool. Mirrors lib/types.ts AIAnalysis 1:1 minus the
// `analyzedAt` and `generatedMessages.id` fields (the route fills those in
// server-side after the call returns).

const dimension = {
  type: "object",
  properties: {
    score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Score 0-100 for this qualification dimension.",
    },
    reasoning: {
      type: "string",
      description:
        "1-2 sentence justification grounded in the company's provided facts.",
    },
  },
  required: ["score", "reasoning"],
  additionalProperties: false,
} as const;

export const ANALYZE_TOOL_NAME = "submit_lead_analysis";

export const ANALYZE_TOOL_DESCRIPTION =
  "Submit the completed BPO lead analysis. Call exactly once with the full structured payload — do not return narrative outside this tool call.";

export const ANALYZE_TOOL_SCHEMA = {
  type: "object",
  properties: {
    priorityScore: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description:
        "Overall priority score 0-100 weighted across tier, signals, headcount, and ICP fit.",
    },
    qualification: {
      type: "object",
      properties: {
        industryFit: dimension,
        operationalPain: dimension,
        digitalMaturity: dimension,
        buyingSignals: dimension,
        budgetPotential: dimension,
      },
      required: [
        "industryFit",
        "operationalPain",
        "digitalMaturity",
        "buyingSignals",
        "budgetPotential",
      ],
      additionalProperties: false,
    },
    partnership: {
      type: "object",
      properties: {
        strategicAlignment: { type: "string" },
        aiReadiness: { type: "string" },
        growthPotential: { type: "string" },
        localizationFit: { type: "string" },
      },
      required: [
        "strategicAlignment",
        "aiReadiness",
        "growthPotential",
        "localizationFit",
      ],
      additionalProperties: false,
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
            description:
              "Message body. LinkedIn DM: ≤300 chars; Email: full multi-paragraph copy.",
          },
        },
        required: ["stakeholderId", "channel", "step", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["priorityScore", "qualification", "partnership", "generatedMessages"],
  additionalProperties: false,
} as const;
