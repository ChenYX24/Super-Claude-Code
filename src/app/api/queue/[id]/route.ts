/**
 * Individual queued session API.
 *
 * GET /api/queue/:id - Get session status + result
 * DELETE /api/queue/:id - Cancel a pending session
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, cancelSession } from "@/lib/bot/session-queue";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ session });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot cancel session with status "${session.status}". Only pending sessions can be cancelled.` },
      { status: 409 },
    );
  }

  const cancelled = cancelSession(id);
  if (!cancelled) {
    return NextResponse.json(
      { error: "Failed to cancel session (may have already started)" },
      { status: 409 },
    );
  }

  return NextResponse.json({
    success: true,
    message: `Session #${id} cancelled`,
  });
}
