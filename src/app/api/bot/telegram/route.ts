/**
 * Telegram Bot webhook endpoint.
 *
 * Setup:
 * 1. Set env vars: TELEGRAM_BOT_TOKEN, SCC_BASE_URL (optional), TELEGRAM_ALLOWED_CHATS (optional)
 * 2. Set webhook URL via Telegram API:
 *    curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_DOMAIN>/api/bot/telegram"
 *
 * Environment variables:
 * - TELEGRAM_BOT_TOKEN: Bot API token from @BotFather (required)
 * - SCC_BASE_URL: Dashboard base URL (default: http://localhost:3000)
 * - TELEGRAM_ALLOWED_CHATS: Comma-separated chat IDs to allow (empty = allow all)
 */

import { NextRequest, NextResponse } from "next/server";
import { getTelegramBot } from "@/lib/bot/telegram-bot";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const bot = getTelegramBot();

  if (!bot) {
    return NextResponse.json(
      { error: "Telegram bot not configured. Set TELEGRAM_BOT_TOKEN env var." },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    await bot.handleWebhook(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Telegram Webhook] Error:", err);
    // Return 200 to Telegram to avoid retries on application errors
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  const bot = getTelegramBot();
  const configured = bot !== null;

  return NextResponse.json({
    platform: "telegram",
    configured,
    webhook: "/api/bot/telegram",
    commands: ["/sessions", "/chat", "/status", "/help"],
  });
}
