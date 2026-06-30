// OpenAI-compatible provider presets. Pure data + small pure helpers — safe to
// import from BOTH server (config/settings) and client (SettingsForm) code, so
// it carries no "server-only" marker and imports nothing server-bound.
//
// A preset implies its base URL, so the user only supplies a key + model. The
// "custom" id reads an explicit AI_OPENAI_BASE_URL instead.

export type AIProviderId =
  | "auto"
  | "anthropic"
  | "groq"
  | "openrouter"
  | "gemini"
  | "ollama"
  | "custom";

export interface AIPreset {
  label: string;
  baseURL: string;
  exampleAnalyze: string;
  exampleChat: string;
  keyHint: string;
}

// Keyed by AIProviderId. Only the OpenAI-compatible presets appear here;
// "auto"/"anthropic"/"custom" are intentionally absent.
export const AI_PRESETS: Record<string, AIPreset> = {
  groq: {
    label: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    exampleAnalyze: "llama-3.3-70b-versatile",
    exampleChat: "llama-3.1-8b-instant",
    keyHint: "Free key from console.groq.com",
  },
  openrouter: {
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    exampleAnalyze: "meta-llama/llama-3.3-70b-instruct",
    exampleChat: "google/gemini-2.0-flash-exp:free",
    keyHint: "Key from openrouter.ai/keys (has free models)",
  },
  gemini: {
    label: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    exampleAnalyze: "gemini-2.0-flash",
    exampleChat: "gemini-2.0-flash",
    keyHint: "Free key from aistudio.google.com/apikey",
  },
  ollama: {
    label: "Ollama (local)",
    baseURL: "http://localhost:11434/v1",
    exampleAnalyze: "llama3.1:8b",
    exampleChat: "llama3.1:8b",
    keyHint: "No key needed — runs locally",
  },
};

// The base URL implied by a provider id, or null for ids that supply their own
// (auto/anthropic) or read AI_OPENAI_BASE_URL (custom).
export function presetBaseURL(provider: string): string | null {
  return AI_PRESETS[provider]?.baseURL ?? null;
}

// True for localhost-style URLs, where an API key is optional (Ollama).
export function isLocalhostURL(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "::1" ||
      h === "0.0.0.0"
    );
  } catch {
    return false;
  }
}
