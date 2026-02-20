import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Allow long-running Claude Code invocations
export const maxDuration = 300;

/** Find claude executable — prefer full path over PATH lookup for Windows reliability */
function findClaudeBinary(): string {
  const exe = process.platform === "win32" ? "claude.exe" : "claude";
  const localBin = join(homedir(), ".local", "bin", exe);
  if (existsSync(localBin)) return localBin;
  return "claude"; // fallback to PATH
}

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // stream-json requires --verbose with -p
    const args = ["-p", message.trim(), "--output-format", "stream-json", "--verbose"];

    if (sessionId) {
      args.push("--resume", sessionId);
    }

    // Prepare clean environment: remove ALL Claude Code env vars
    // that would make the child process connect to the parent session
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

    const claudeBin = findClaudeBinary();
    console.log(`[Chat API] Spawning: ${claudeBin} ${args.join(" ")}`);

    const child = spawn(claudeBin, args, {
      env: env as NodeJS.ProcessEnv,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end(); // close stdin so CLI doesn't wait for input

    // Kill child process if client disconnects
    req.signal.addEventListener("abort", () => {
      child.kill();
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let buffer = "";

        child.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf-8");
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // keep incomplete last line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            // Forward each JSON event as SSE data frame
            controller.enqueue(encoder.encode(`data: ${trimmed}\n\n`));
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          const errText = chunk.toString("utf-8").trim();
          if (errText) {
            console.error("Claude CLI stderr:", errText);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", error: errText })}\n\n`)
            );
          }
        });

        child.on("error", (err) => {
          console.error("Claude CLI spawn error:", err);
          const msg = (err as NodeJS.ErrnoException).code === "ENOENT"
            ? `Claude Code CLI not found at "${claudeBin}". Make sure claude is installed.`
            : err.message;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        });

        child.on("close", (code) => {
          console.log(`[Chat API] Claude CLI exited with code ${code}`);
          // Flush remaining buffer
          if (buffer.trim()) {
            controller.enqueue(encoder.encode(`data: ${buffer.trim()}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
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
