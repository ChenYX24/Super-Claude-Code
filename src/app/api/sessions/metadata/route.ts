import { NextRequest, NextResponse } from "next/server";
import { getAllSessionMeta, updateSessionMeta } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const meta = getAllSessionMeta();
  // Return as a map keyed by session_id for easy client-side lookup
  const metaMap: Record<string, {
    displayName: string | null;
    pinned: boolean;
    tags: string[];
    deleted: boolean;
  }> = {};
  for (const m of meta) {
    metaMap[m.session_id] = {
      displayName: m.display_name,
      pinned: m.pinned === 1,
      tags: JSON.parse(m.tags || "[]"),
      deleted: m.deleted === 1,
    };
  }
  return NextResponse.json(metaMap);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { sessionId, displayName, pinned, tags, deleted } = body;

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const updates: {
    displayName?: string | null;
    pinned?: boolean;
    tags?: string[];
    deleted?: boolean;
  } = {};

  if (displayName !== undefined) updates.displayName = displayName;
  if (pinned !== undefined) updates.pinned = pinned;
  if (tags !== undefined) updates.tags = tags;
  if (deleted !== undefined) updates.deleted = deleted;

  const result = updateSessionMeta(sessionId, updates);
  return NextResponse.json({
    sessionId: result.session_id,
    displayName: result.display_name,
    pinned: result.pinned === 1,
    tags: JSON.parse(result.tags || "[]"),
    deleted: result.deleted === 1,
  });
}
