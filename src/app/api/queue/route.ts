/**
 * Background session queue API.
 *
 * GET /api/queue - List queued sessions + stats
 * POST /api/queue - Enqueue a new session
 */

import { NextRequest, NextResponse } from "next/server";
import {
  enqueueSession,
  listSessions,
  getQueueStats,
  startWorker,
  isWorkerRunning,
} from "@/lib/bot/session-queue";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as "pending" | "running" | "completed" | "failed" | null;
  const chatId = url.searchParams.get("chatId");
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  const sessions = listSessions({
    status: status || undefined,
    chatId: chatId || undefined,
    limit: Math.min(limit, 100),
  });
  const stats = getQueueStats();

  return NextResponse.json({
    sessions,
    stats,
    workerRunning: isWorkerRunning(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, provider, cwd, chatId, platform } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Missing required field: prompt" },
        { status: 400 },
      );
    }

    const session = enqueueSession({
      prompt: prompt.trim(),
      chatId: chatId || "web",
      platform: platform || "web",
      provider: provider || "claude",
      cwd: cwd || undefined,
    });

    // Ensure worker is running
    if (!isWorkerRunning()) {
      startWorker();
    }

    return NextResponse.json({
      success: true,
      id: session.id,
      status: session.status,
      message: `Session #${session.id} queued`,
    });
  } catch (err) {
    console.error("[Queue API] Error:", err);
    return NextResponse.json(
      { error: "Failed to enqueue session" },
      { status: 500 },
    );
  }
}
