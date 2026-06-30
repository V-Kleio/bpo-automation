import "server-only";
// Helpers for the JSON-mode structured-output fallback used by providers that
// don't support (or have flaky) function/tool calling. We embed the analyze
// JSON Schema into the prompt and tolerantly extract the first balanced JSON
// object from the model's text response.

// Appended to the analyze system prompt for the json_object path: instruct the
// model to emit ONLY a JSON object matching the analyze schema.
export function buildAnalyzeJsonInstruction(schema: unknown): string {
  return (
    "\n\nOUTPUT FORMAT\n" +
    "Respond with ONLY a single JSON object that conforms to this JSON Schema. " +
    "Do not wrap it in markdown code fences, and do not write any prose before or " +
    "after it. Use the exact property names from the schema.\n" +
    JSON.stringify(schema)
  );
}

// Tolerant extraction of the first balanced top-level JSON object from a model
// response: strips ```json fences, skips any leading prose, and respects
// strings/escapes when balancing braces. Throws a descriptive error if no
// valid object is found.
export function extractJsonObject(text: string): Record<string, unknown> {
  if (!text || !text.trim()) {
    throw new Error(
      "Model returned an empty response (expected a JSON object).",
    );
  }

  let s = text.trim();

  // Prefer a fenced ```json … ``` block if present.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  // Fast path: the whole thing is already a JSON object.
  try {
    const direct = JSON.parse(s) as unknown;
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      return direct as Record<string, unknown>;
    }
  } catch {
    // fall through to the balanced scan
  }

  const start = s.indexOf("{");
  if (start === -1) {
    throw new Error(
      `Model response did not contain a JSON object. Preview: ${text.slice(0, 200)}`,
    );
  }

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = s.slice(start, i + 1);
        try {
          return JSON.parse(candidate) as Record<string, unknown>;
        } catch (err) {
          throw new Error(
            `Found a JSON-like block but failed to parse it: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  throw new Error(
    `Model response had an unterminated JSON object. Preview: ${text.slice(0, 200)}`,
  );
}
