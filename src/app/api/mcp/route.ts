import { NextResponse } from "next/server";
import { readMCPServers } from "@/lib/claude-reader";

export const dynamic = "force-dynamic";

export function GET() {
  const data = readMCPServers();
  return NextResponse.json(data);
}
