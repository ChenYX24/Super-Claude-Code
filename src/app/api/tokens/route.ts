import { NextResponse } from "next/server";
import { getTokenSummary } from "@/lib/session-reader";

export const dynamic = "force-dynamic";

export function GET() {
  const summary = getTokenSummary();
  return NextResponse.json(summary);
}
