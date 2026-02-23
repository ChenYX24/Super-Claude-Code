import { NextRequest, NextResponse } from "next/server";
import {
  getNotifications,
  addNotification,
  markRead,
  markAllRead,
  clearAll,
  getLastUpdated,
} from "@/lib/event-bus/notification-queue";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications
 *
 * Query params:
 *   - unread: "true" to filter unread only
 *   - limit: max items (default 50)
 *   - offset: pagination offset
 *   - since: timestamp to get notifications newer than
 *   - stream: "true" for SSE stream
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // SSE streaming mode
  if (searchParams.get("stream") === "true") {
    return createSSEStream(req);
  }

  const unreadOnly = searchParams.get("unread") === "true";
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const since = searchParams.get("since") ? parseInt(searchParams.get("since")!, 10) : undefined;

  const result = getNotifications({ unreadOnly, limit, offset, since });
  return NextResponse.json(result);
}

/**
 * POST /api/notifications
 *
 * Body: { action: "add" | "markRead" | "markAllRead" | "clear", ... }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "add": {
      const { type, title, message, source, meta } = body;
      if (!type || !title || !message) {
        return NextResponse.json(
          { error: "Missing required fields: type, title, message" },
          { status: 400 }
        );
      }
      const notification = addNotification(type, title, message, { source, meta });
      return NextResponse.json({ success: true, notification });
    }

    case "markRead": {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
      }
      const found = markRead(id);
      return NextResponse.json({ success: found });
    }

    case "markAllRead": {
      const count = markAllRead();
      return NextResponse.json({ success: true, count });
    }

    case "clear": {
      const count = clearAll();
      return NextResponse.json({ success: true, count });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: "${action}". Use "add", "markRead", "markAllRead", or "clear".` },
        { status: 400 }
      );
  }
}

/**
 * SSE stream for real-time notification updates.
 * Polls the queue file every 2 seconds and sends updates when changes are detected.
 */
function createSSEStream(req: NextRequest): Response {
  const encoder = new TextEncoder();
  let lastKnownUpdate = getLastUpdated();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const initial = getNotifications({ limit: 20 });
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "init", ...initial })}\n\n`)
      );

      const interval = setInterval(() => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          const currentUpdate = getLastUpdated();
          if (currentUpdate > lastKnownUpdate) {
            lastKnownUpdate = currentUpdate;
            const data = getNotifications({ limit: 20 });
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "update", ...data })}\n\n`)
            );
          } else {
            // Keep-alive
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          }
        } catch {
          clearInterval(interval);
          try { controller.close(); } catch { /* already closed */ }
        }
      }, 2000);

      // Clean up on abort
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
