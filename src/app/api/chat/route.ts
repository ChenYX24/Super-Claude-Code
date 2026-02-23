import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { existsSync, realpathSync } from "fs";
import { homedir } from "os";
import { resolve } from "path";
import { registry } from "@/lib/providers";

// Allow long-running CLI invocations
export const maxDuration = 300;

/** Allowed root paths for cwd — same as /api/browse */
const ALLOWED_ROOTS = [
  homedir(),
  "C:\\",
  "D:\\",
  "E:\\",
  "F:\\",
  "/home",
  "/Users",
  "/mnt",
  "/opt",
];

function isPathAllowed(targetPath: string): boolean {
  try {
    const real = realpathSync(targetPath);
    return ALLOWED_ROOTS.some((root) => real.startsWith(resolve(root)));
  } catch {
    return false;
  }
}

const VALID_PERMISSION_MODES = ["default", "trust", "acceptEdits", "readOnly", "plan"] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, cwd, permissionMode, allowedTools, provider: providerName, model } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate cwd if provided
    if (cwd && typeof cwd === "string") {
      if (!existsSync(cwd)) {
        return new Response(
          JSON.stringify({ error: "Working directory does not exist" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (!isPathAllowed(cwd)) {
        return new Response(
          JSON.stringify({ error: "Working directory is not in an allowed root" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Validate permissionMode
    if (permissionMode && !VALID_PERMISSION_MODES.includes(permissionMode)) {
      return new Response(
        JSON.stringify({ error: "Invalid permission mode" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Resolve provider (default: claude)
    const provider = providerName
      ? registry.get(providerName)
      : registry.getDefault();

    if (!provider) {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${providerName}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify provider CLI is available
    if (!provider.isAvailable()) {
      return new Response(
        JSON.stringify({ error: `${provider.displayName} CLI is not installed or not found on your system. Please install it first.` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build command using provider
    const { binary, args, env } = provider.buildCommand(message.trim(), {
      sessionId,
      cwd,
      permissionMode,
      allowedTools,
      model: model || undefined,
    });

    console.log(`[Chat API] Provider: ${provider.displayName} | Spawning: ${binary} ${args.join(" ")}`);

    const child = spawn(binary, args, {
      cwd: cwd || undefined,
      env: env as NodeJS.ProcessEnv,
      windowsHide: true,
      shell: process.platform === "win32", // Windows needs shell to resolve .cmd wrappers
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end(); // close stdin so CLI doesn't wait for input

    // Kill child process if client disconnects — graceful then forced
    req.signal.addEventListener("abort", () => {
      child.kill("SIGTERM");
      setTimeout(() => {
        try { child.kill("SIGKILL"); } catch { /* already dead */ }
      }, 3000);
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let buffer = "";
        let closed = false;
        let stderrBuffer = "";
        let hasOutput = false;

        const safeEnqueue = (data: string) => {
          if (closed) return;
          try { controller.enqueue(encoder.encode(data)); } catch { /* already closed */ }
        };

        const safeClose = () => {
          if (closed) return;
          closed = true;
          safeEnqueue("data: [DONE]\n\n");
          try { controller.close(); } catch { /* already closed */ }
        };

        child.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf-8");
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // keep incomplete last line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Let the provider parse and normalize the event
            const event = provider.parseEvent(trimmed);
            if (event) {
              hasOutput = true;
              safeEnqueue(`data: ${JSON.stringify(event.raw)}\n\n`);
            }
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          const errText = chunk.toString("utf-8").trim();
          if (errText) {
            console.error(`[Chat API] ${provider.displayName} stderr:`, errText);
            stderrBuffer += (stderrBuffer ? "\n" : "") + errText;
          }
        });

        child.on("error", (err) => {
          console.error(`[Chat API] ${provider.displayName} spawn error:`, err);
          const msg = (err as NodeJS.ErrnoException).code === "ENOENT"
            ? `${provider.displayName} CLI not found at "${binary}". Make sure it is installed.`
            : err.message;
          safeEnqueue(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`);
          safeClose();
        });

        child.on("close", (code) => {
          console.log(`[Chat API] ${provider.displayName} exited with code ${code}`);
          // Flush remaining buffer
          if (buffer.trim()) {
            const event = provider.parseEvent(buffer.trim());
            if (event) {
              hasOutput = true;
              safeEnqueue(`data: ${JSON.stringify(event.raw)}\n\n`);
            }
          }
          // If CLI exited with error, always send error event
          if (code !== 0) {
            const errorMsg = stderrBuffer || `CLI exited with code ${code}`;
            safeEnqueue(`data: ${JSON.stringify({ type: "error", error: errorMsg })}\n\n`);
          } else if (code === 0 && !hasOutput) {
            // CLI exited OK but produced no parseable output — likely a resume issue
            const hint = stderrBuffer ? stderrBuffer : "CLI produced no output. The session may not be resumable.";
            safeEnqueue(`data: ${JSON.stringify({ type: "error", error: hint })}\n\n`);
          }
          safeClose();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
