/**
 * Telegram Bot approval endpoint for Claude Code permission hooks.
 *
 * Called by notify.ps1 (or similar hook) when Claude Code needs tool permission.
 * Sends an inline keyboard to Telegram, waits for user response, returns decision.
 *
 * POST { tool_name, tool_input, req_id }
 *   → { hookSpecificOutput: { permissionDecision, permissionDecisionReason } }
 */

import { NextRequest, NextResponse } from "next/server";
import { getTelegramBot } from "@/lib/bot/telegram-bot";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const bot = getTelegramBot();

  if (!bot) {
    return NextResponse.json(
      { error: "Telegram bot not configured" },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const { tool_name, tool_input, req_id } = body;

    if (!tool_name || !req_id) {
      return NextResponse.json(
        { error: "Missing required fields: tool_name, req_id" },
        { status: 400 },
      );
    }

    const decision = await bot.handleApproval(
      req_id,
      tool_name,
      tool_input || {},
    );

    const reason =
      decision === "allow"
        ? "Approved via Telegram"
        : "Denied via Telegram";

    return NextResponse.json({
      hookSpecificOutput: {
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    });
  } catch (err) {
    console.error("[Telegram Approval] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approval failed" },
      { status: 500 },
    );
  }
}

/** GET: check approval endpoint status */
export async function GET() {
  const bot = getTelegramBot();

  return NextResponse.json({
    available: bot !== null,
    chatId: bot?.getChatId() || null,
    endpoint: "/api/bot/telegram/approval",
  });
}
