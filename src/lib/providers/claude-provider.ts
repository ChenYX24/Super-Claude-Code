import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type {
  CliProvider,
  ProviderCapabilities,
  ProviderEvent,
  SpawnOptions,
} from "./provider-interface";

const TOOL_NAME_RE = /^[A-Za-z0-9_-]+$/;

/** Auto-detect git-bash path on Windows */
function findGitBash(env: Record<string, string | undefined>): string | undefined {
  const candidates = [
    env.EXEPATH ? `${env.EXEPATH}\\bash.exe` : "",
    "E:\\App_Code\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

/** Find claude executable — prefer full path over PATH lookup for Windows reliability */
function findClaudeBinary(): string {
  const exe = process.platform === "win32" ? "claude.exe" : "claude";
  const localBin = join(homedir(), ".local", "bin", exe);
  if (existsSync(localBin)) return localBin;
  return "claude";
}

export class ClaudeProvider implements CliProvider {
  readonly name = "claude";
  readonly displayName = "Claude Code";

  isAvailable(): boolean {
    const binary = findClaudeBinary();
    if (binary === "claude" || binary === "claude.exe") {
      // Fallback to PATH — assume available (spawn will fail if not)
      return true;
    }
    return existsSync(binary);
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      thinking: true,
      toolUse: true,
      models: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
    };
  }

  buildCommand(
    prompt: string,
    options: SpawnOptions
  ): { binary: string; args: string[]; env: Record<string, string | undefined> } {
    const binary = findClaudeBinary();
    const args = ["-p", prompt, "--output-format", "stream-json", "--verbose"];

    if (options.sessionId) {
      args.push("--resume", options.sessionId);
    }

    if (options.model) {
      args.push("--model", options.model);
    }

    // Permission mode -> CLI flags
    if (options.permissionMode === "trust") {
      args.push("--dangerously-skip-permissions");
    } else if (options.permissionMode === "acceptEdits") {
      args.push("--permission-mode", "acceptEdits");
    } else if (options.permissionMode === "readOnly") {
      args.push("--allowedTools", "Read", "Glob", "Grep", "WebSearch", "WebFetch");
    } else if (options.permissionMode === "plan") {
      args.push("--permission-mode", "plan");
    }

    // Custom allowed tools (skip if readOnly or trust already set)
    if (
      Array.isArray(options.allowedTools) &&
      options.allowedTools.length > 0 &&
      options.permissionMode !== "readOnly" &&
      options.permissionMode !== "trust"
    ) {
      const safeTools = options.allowedTools.filter((t) => TOOL_NAME_RE.test(t));
      if (safeTools.length > 0) {
        args.push("--allowedTools", ...safeTools);
      }
    }

    // Clean environment: remove Claude Code env vars that would bind to parent session
    const env: Record<string, string | undefined> = { ...process.env };
    for (const key of Object.keys(env)) {
      if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE")) {
        delete env[key];
      }
    }
    // Re-add git-bash path for Windows
    if (process.platform === "win32") {
      const bashPath = findGitBash(env);
      if (bashPath) env.CLAUDE_CODE_GIT_BASH_PATH = bashPath;
    }

    return { binary, args, env };
  }

  parseEvent(line: string): ProviderEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      const type = parsed.type as string;

      if (type === "system" || type === "assistant" || type === "result" || type === "error") {
        return { type, raw: parsed };
      }

      // Unknown event type — still forward it
      return { type: "assistant", raw: parsed };
    } catch {
      return null;
    }
  }
}
