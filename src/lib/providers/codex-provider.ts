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
  readonly displayName = "OpenAI Codex CLI";

  isAvailable(): boolean {
    const binary = findCodexBinary();
    if (binary === "codex" || binary === "codex.exe") {
      return true; // Assume PATH lookup will work; spawn will fail if not
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
    const args: string[] = [];

    // Codex CLI uses: codex --full-auto "prompt" or codex -q "prompt"
    // Approval mode mapping
    if (options.permissionMode === "trust") {
      args.push("--full-auto");
    } else if (options.permissionMode === "acceptEdits") {
      args.push("--auto-edit");
    }

    if (options.model) {
      args.push("--model", options.model);
    }

    // The prompt is the positional argument
    args.push("-q", prompt);

    const env: Record<string, string | undefined> = { ...process.env };

    return { binary, args, env };
  }

  parseEvent(line: string): ProviderEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);

      // Map Codex event types to normalized ProviderEvent types
      const codexType = parsed.type as string;

      if (codexType === "error") {
        return { type: "error", raw: parsed };
      }

      // Codex uses different event names — normalize to our schema
      // "message.start", "message.delta", "message.complete" etc.
      if (codexType?.startsWith("message") || codexType === "response") {
        // Map to assistant event with content structure
        return {
          type: "assistant",
          raw: {
            type: "assistant",
            message: {
              content: [
                {
                  type: "text",
                  text: parsed.content || parsed.text || parsed.delta?.text || "",
                },
              ],
            },
          },
        };
      }

      if (codexType === "tool_call" || codexType === "function_call") {
        return {
          type: "assistant",
          raw: {
            type: "assistant",
            message: {
              content: [
                {
                  type: "tool_use",
                  name: parsed.name || parsed.function?.name || "unknown_tool",
                  input: parsed.arguments || parsed.function?.arguments || {},
                },
              ],
            },
          },
        };
      }

      if (codexType === "done" || codexType === "complete") {
        return {
          type: "result",
          raw: {
            type: "result",
            result: parsed.result || parsed.output || "",
            cost_usd: parsed.cost_usd,
            duration_ms: parsed.duration_ms,
            session_id: parsed.session_id,
          },
        };
      }

      // Fallback: forward as-is
      return { type: "assistant", raw: parsed };
    } catch {
      // Not JSON — treat as plain text response
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
