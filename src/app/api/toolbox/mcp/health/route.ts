import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

export const dynamic = "force-dynamic";

// Whitelist of allowed command names for MCP server health checks.
// Only simple executable names are permitted — no paths, no flags, no shell metacharacters.
const ALLOWED_COMMANDS = new Set([
  "npx", "node", "python", "python3", "uvx", "uv", "docker",
  "deno", "bun", "ruby", "go", "cargo", "pip", "pip3", "npm",
]);

// Server names must be alphanumeric with hyphens, underscores, dots, or @/slashes (scoped packages).
const SAFE_NAME_PATTERN = /^[a-zA-Z0-9@._\/-]{1,128}$/;

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");
  const command = request.nextUrl.searchParams.get("command");

  if (!name || !command) {
    return NextResponse.json({ status: "error", message: "Missing name or command" });
  }

  // Validate server name to prevent log injection or downstream abuse
  if (!SAFE_NAME_PATTERN.test(name)) {
    return NextResponse.json(
      { status: "error", message: "Invalid server name" },
      { status: 400 },
    );
  }

  // Only allow whitelisted command basenames — block arbitrary executables and paths
  const commandBasename = command.replace(/\\/g, "/").split("/").pop() || "";
  if (!ALLOWED_COMMANDS.has(commandBasename)) {
    return NextResponse.json(
      { status: "error", message: `Command "${commandBasename}" is not in the allowed list` },
      { status: 400 },
    );
  }

  try {
    const result = await new Promise<{ status: string; message: string }>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill();
        resolve({ status: "timeout", message: "Process did not respond within 3s" });
      }, 3000);

      // Use array-form args and shell:false to prevent injection.
      // The command is already validated against the whitelist above.
      const child = spawn(commandBasename, ["--version"], {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 3000,
      });

      child.on("error", () => {
        clearTimeout(timeout);
        resolve({ status: "error", message: "Failed to spawn process" });
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ status: "healthy", message: "Process executable found" });
        } else {
          resolve({ status: "warning", message: `Process exited with code ${code}` });
        }
      });
    });

    return NextResponse.json({ name, ...result });
  } catch {
    return NextResponse.json({ name, status: "error", message: "Health check failed" });
  }
}
