import { NextResponse } from "next/server";
import { getAllTeamsSummary } from "@/lib/claude-reader";

export const dynamic = "force-dynamic";

export function GET() {
  const summary = getAllTeamsSummary();
  return NextResponse.json(summary);
}
