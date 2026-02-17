import { NextResponse } from "next/server";
import { getToolboxData } from "@/lib/toolbox-reader";
import { readMCPServers } from "@/lib/claude-reader";

export const dynamic = "force-dynamic";

export function GET() {
  const toolbox = getToolboxData();
  const mcp = readMCPServers();
  return NextResponse.json({ ...toolbox, mcp });
}
