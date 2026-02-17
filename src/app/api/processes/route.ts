import { NextResponse } from "next/server";
import { getClaudeProcesses } from "@/lib/process-reader";

export const dynamic = "force-dynamic";

export function GET() {
  const processes = getClaudeProcesses();
  return NextResponse.json({ processes, count: processes.length });
}
