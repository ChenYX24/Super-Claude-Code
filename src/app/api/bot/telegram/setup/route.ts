/**
 * Telegram Bot webhook setup endpoint.
 *
 * POST /api/bot/telegram/setup
 * Body: { url: string }
 *
 * Registers the given URL as the Telegram webhook for this bot.
 * Requires TELEGRAM_BOT_TOKEN to be set.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN not configured" },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing required field: url" },
        { status: 400 },
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
    }

    // Call Telegram Bot API to set the webhook
    const telegramUrl = `https://api.telegram.org/bot${token}/setWebhook`;
    const res = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        allowed_updates: ["message", "callback_query"],
      }),
    });

    const data = await res.json();

    if (data.ok) {
      return NextResponse.json({
        success: true,
        message: "Webhook set successfully",
        webhookUrl: url,
        description: data.description,
      });
    } else {
      return NextResponse.json(
        { error: data.description || "Failed to set webhook" },
        { status: 400 },
      );
    }
  } catch (err) {
    console.error("[Telegram Setup] Error:", err);
    return NextResponse.json(
      { error: "Failed to set webhook" },
      { status: 500 },
    );
  }
}

/** GET: check current webhook info */
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN not configured" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await res.json();

    if (data.ok) {
      return NextResponse.json({
        configured: true,
        url: data.result.url || null,
        pendingUpdateCount: data.result.pending_update_count,
        lastErrorDate: data.result.last_error_date || null,
        lastErrorMessage: data.result.last_error_message || null,
      });
    } else {
      return NextResponse.json({ configured: false, error: data.description });
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to check webhook status" },
      { status: 500 },
    );
  }
}
