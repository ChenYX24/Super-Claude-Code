/**
 * Telegram Bot polling control endpoint.
 *
 * GET  → { polling: boolean, uptime: number | null }
 * POST { action: "start" } → Start polling mode
 * POST { action: "stop" }  → Stop polling mode
 */

import { NextRequest, NextResponse } from "next/server";
import { getTelegramBot } from "@/lib/bot/telegram-bot";

export const dynamic = "force-dynamic";

export async function GET() {
  const bot = getTelegramBot();

  if (!bot) {
    return NextResponse.json(
      { error: "Telegram bot not configured" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    polling: bot.isPolling(),
    uptime: bot.getPollingUptime(),
  });
}

export async function POST(req: NextRequest) {
  const bot = getTelegramBot();

  if (!bot) {
    return NextResponse.json(
      { error: "Telegram bot not configured. Set TELEGRAM_BOT_TOKEN or configure telegram_config.json." },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "start") {
      if (bot.isPolling()) {
        return NextResponse.json({ success: true, message: "Already polling" });
      }
      await bot.startPolling();
      return NextResponse.json({ success: true, message: "Polling started" });
    }

    if (action === "stop") {
      if (!bot.isPolling()) {
        return NextResponse.json({ success: true, message: "Already stopped" });
      }
      await bot.stopPolling();
      return NextResponse.json({ success: true, message: "Polling stopped" });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "start" or "stop".' },
      { status: 400 },
    );
  } catch (err) {
    console.error("[Telegram Polling] Error:", err);
    return NextResponse.json(
      { error: "Failed to control polling" },
      { status: 500 },
    );
  }
}
