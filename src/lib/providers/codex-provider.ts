import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type {
  CliProvider,
  ProviderCapabilities,
  ProviderEvent,
  SpawnOptions,
} from "./provider-interface";

/** Find codex executable */
function findCodexBinary(): string {
  const exe = process.platform === "win32" ? "codex.exe" : "codex";
  // Check common install locations
  const localBin = join(homedir(), ".local", "bin", exe);
  if (existsSync(localBin)) return localBin;
  const npmGlobal = join(homedir(), ".npm-global", "bin", exe);
  if (existsSync(npmGlobal)) return npmGlobal;
  return "codex";
}

export class CodexProvider implements CliProvider {
  readonly name = "codex";
  readonly displayName = "OpenAI Codex";

  isAvailable(): boolean {
    const binary = findCodexBinary();
    if (binary === "codex" || binary === "codex.exe") {
      // PATH fallback — check if it actually exists via common paths
      try {
        const { execSync } = require("child_process");
        const which = process.platform === "win32" ? "where" : "which";
        execSync(`${which} codex`, { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    }
    return existsSync(binary);
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      thinking: false,
      toolUse: true,
      models: ["o4-mini", "o3", "gpt-4.1"],
    };
  }

  buildCommand(
    prompt: string,
    options: SpawnOptions
  ): { binary: string; args: string[]; env: Record<string, string | undefined> } {
    const binary = findCodexBinary();
    // Non-interactive mode: codex exec [options] "prompt"
    const args: string[] = ["exec", "--json", "--skip-git-repo-check"];

    // Approval mode mapping
    if (options.permissionMode === "trust") {
      args.push("--full-auto");
    }

    if (options.model) {
      args.push("--model", options.model);
    }

    // Prompt is the positional argument (must come last)
    args.push(prompt);

    const env: Record<string, string | undefined> = { ...process.env };

    return { binary, args, env };
  }

  parseEvent(line: string): ProviderEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      const codexType = parsed.type as string;

      // Codex JSONL event types:
      // thread.started, turn.started, item.completed, turn.completed, error

      if (codexType === "error") {
        return { type: "error", raw: { type: "error", error: parsed.message || parsed.error || "Codex error" } };
      }

      if (codexType === "thread.started") {
        // Map to system init event
        return {
          type: "system",
          raw: {
            type: "system",
            session_id: parsed.thread_id,
          },
        };
      }

      if (codexType === "item.completed") {
        const item = parsed.item;
        if (!item) return null;

        if (item.type === "agent_message") {
          return {
            type: "assistant",
            raw: {
              type: "assistant",
              message: {
                content: [{ type: "text", text: item.text || "" }],
              },
            },
          };
        }

        if (item.type === "reasoning") {
          return {
            type: "assistant",
            raw: {
              type: "assistant",
              message: {
                content: [{ type: "thinking", thinking: item.text || "" }],
              },
            },
          };
        }

        if (item.type === "tool_call" || item.type === "function_call") {
          return {
            type: "assistant",
            raw: {
              type: "assistant",
              message: {
                content: [
                  {
                    type: "tool_use",
                    name: item.name || item.function?.name || "tool",
                    input: JSON.stringify(item.arguments || item.input || {}),
                  },
                ],
              },
            },
          };
        }

        // Other item types — skip
        return null;
      }

      if (codexType === "turn.completed") {
        const usage = parsed.usage;
        return {
          type: "result",
          raw: {
            type: "result",
            result: "",
            session_id: parsed.thread_id,
            usage: usage ? {
              input_tokens: usage.input_tokens,
              output_tokens: usage.output_tokens,
              cache_read_input_tokens: usage.cached_input_tokens,
            } : undefined,
          },
        };
      }

      // Skip: turn.started, etc.
      return null;
    } catch {
      // Not JSON — treat as plain text
      if (trimmed.startsWith("Not inside a trusted")) {
        return { type: "error", raw: { type: "error", error: trimmed } };
      }
      return {
        type: "assistant",
        raw: {
          type: "assistant",
          message: {
            content: [{ type: "text", text: trimmed }],
          },
        },
      };
    }
  }
}
