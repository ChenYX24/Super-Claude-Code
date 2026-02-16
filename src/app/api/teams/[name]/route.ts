import { NextRequest, NextResponse } from "next/server";
import { getTeamOverview } from "@/lib/claude-reader";

export const dynamic = "force-dynamic";

export function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  return params.then(({ name }) => {
    const overview = getTeamOverview(name);
    if (!overview) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    return NextResponse.json(overview);
  });
}
