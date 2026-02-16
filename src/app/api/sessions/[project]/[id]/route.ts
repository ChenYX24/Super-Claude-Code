import { NextRequest, NextResponse } from "next/server";
import { getSessionDetail } from "@/lib/session-reader";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ project: string; id: string }> }
) {
  const { project, id } = await params;
  const detail = getSessionDetail(project, id);
  if (!detail) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
