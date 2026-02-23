/**
 * Feishu (Lark) Bot webhook endpoint.
 *
 * Setup:
 * 1. Create a Feishu app at https://open.feishu.cn/
 * 2. Enable "Bot" capability and "Event Subscription"
 * 3. Set env vars: FEISHU_APP_ID, FEISHU_APP_SECRET
 * 4. Set webhook URL in Feishu app: <YOUR_DOMAIN>/api/bot/feishu
 * 5. Optional: FEISHU_VERIFICATION_TOKEN for event verification
 * 6. Optional: FEISHU_ALLOWED_CHATS for access control
 *
 * Environment variables:
 * - FEISHU_APP_ID: App ID from Feishu Open Platform (required)
 * - FEISHU_APP_SECRET: App Secret (required)
 * - FEISHU_VERIFICATION_TOKEN: Event verification token (optional)
 * - SCC_BASE_URL: Dashboard base URL (default: http://localhost:3000)
 * - FEISHU_ALLOWED_CHATS: Comma-separated chat IDs to allow (empty = allow all)
 */

import { NextRequest, NextResponse } from "next/server";
import { getFeishuBot } from "@/lib/bot/feishu-bot";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const bot = getFeishuBot();

  if (!bot) {
    return NextResponse.json(
      { error: "Feishu bot not configured. Set FEISHU_APP_ID and FEISHU_APP_SECRET env vars." },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();

    // Handle URL verification challenge (return challenge immediately)
    if (bot.isChallenge(body)) {
      return NextResponse.json({ challenge: body.challenge });
    }

    await bot.handleWebhook(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Feishu Webhook] Error:", err);
    // Return 200 to avoid Feishu retries on application errors
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  const bot = getFeishuBot();
  const configured = bot !== null;

  return NextResponse.json({
    platform: "feishu",
    configured,
    webhook: "/api/bot/feishu",
    commands: ["/sessions", "/chat", "/status", "/help", "/bg", "/queue"],
  });
}
