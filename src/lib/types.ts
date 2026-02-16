/**
 * Shared types for Super Claude Code Dashboard
 */

// Navigation
export type PageId = "home" | "team" | "sessions" | "tokens" | "projects" | "mcp" | "editor";

// Status
export type AgentStatus = "working" | "idle" | "completed" | "error";
export type TaskStatus = "pending" | "in_progress" | "completed";

// Token pricing (USD per million tokens, Feb 2026)
export const MODEL_PRICING: Record<string, { input: number; output: number }> =
  {
    "claude-opus-4-6": { input: 15.0, output: 75.0 },
    "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
    "claude-haiku-4-5": { input: 0.8, output: 4.0 },
  };

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const p = MODEL_PRICING[model] || MODEL_PRICING["claude-sonnet-4-5"];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
