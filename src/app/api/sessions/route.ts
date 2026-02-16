import { NextResponse } from "next/server";
import { getProjectsSummary } from "@/lib/session-reader";

export const dynamic = "force-dynamic";

export function GET() {
  const summary = getProjectsSummary();
  return NextResponse.json(summary);
}
