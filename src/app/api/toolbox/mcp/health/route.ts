import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");
  const command = request.nextUrl.searchParams.get("command");

  if (!name || !command) {
    return NextResponse.json({ status: "error", message: "Missing name or command" });
  }

  try {
    const result = await new Promise<{ status: string; message: string }>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill();
        resolve({ status: "timeout", message: "Process did not respond within 3s" });
      }, 3000);

      const child = spawn(command, ["--version"], {
        shell: true,
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
