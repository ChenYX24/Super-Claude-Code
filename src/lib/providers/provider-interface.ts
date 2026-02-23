import type { ChildProcess } from "child_process";

/** Options for spawning a CLI provider process */
export interface SpawnOptions {
  cwd?: string;
  permissionMode?: "default" | "trust" | "acceptEdits" | "readOnly" | "plan";
  allowedTools?: string[];
  model?: string;
  sessionId?: string;
}

/** Describes what a provider supports */
export interface ProviderCapabilities {
  streaming: boolean;
  thinking: boolean;
  toolUse: boolean;
  models: string[];
}

/** Normalized event emitted from a provider's stdout stream */
export interface ProviderEvent {
  type: "system" | "assistant" | "result" | "error";
  /** Raw parsed JSON from the CLI line */
  raw: Record<string, unknown>;
}

/** Result of spawning a provider process */
export interface SpawnResult {
  process: ChildProcess;
  /** Provider-specific environment cleanup already applied */
  binary: string;
  args: string[];
}

/**
 * A CLI provider abstracts the details of spawning and communicating
 * with a specific AI CLI tool (Claude, Codex, etc.).
 */
export interface CliProvider {
  /** Unique identifier, e.g. "claude" or "codex" */
  readonly name: string;
  /** Human-readable name, e.g. "Claude Code" */
  readonly displayName: string;

  /** Check if the CLI binary is available on this system */
  isAvailable(): boolean;

  /** Return capabilities of this provider */
  getCapabilities(): ProviderCapabilities;

  /** Build the args array and env for spawning the CLI */
  buildCommand(prompt: string, options: SpawnOptions): {
    binary: string;
    args: string[];
    env: Record<string, string | undefined>;
  };

  /**
   * Parse a single JSON line from stdout into a normalized ProviderEvent.
   * Returns null if the line should be skipped (e.g. not valid JSON).
   */
  parseEvent(line: string): ProviderEvent | null;
}
